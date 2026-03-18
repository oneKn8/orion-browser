/**
 * Gemini Computer Use Agent
 * Implements the agent loop that calls Gemini API and executes actions
 * Uses UIMessageStreamEvent format for logging compatibility
 */

import { randomUUID } from 'node:crypto'
import { ActionMapper } from './action-mapper'
import {
  type ComputerUseAction,
  DEFAULTS,
  type GeminiComputerUseAgentConfig,
  type GeminiContent,
  type GeminiPart,
  type GeminiResponse,
} from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface StreamWriter {
  write: (data: string) => Promise<void>
}

type ActionHook = (
  action: ComputerUseAction,
  result: { success: boolean; message: string },
) => Promise<void>

/**
 * Emit SSE-formatted UIMessageStreamEvent
 */
function emitEvent(
  writer: StreamWriter,
  event: Record<string, unknown>,
): Promise<void> {
  return writer.write(`data: ${JSON.stringify(event)}\n\n`)
}

export class GeminiComputerUseAgent {
  private config: GeminiComputerUseAgentConfig
  private actionMapper: ActionMapper
  private actionHook?: ActionHook
  private contents: GeminiContent[] = []

  constructor(config: GeminiComputerUseAgentConfig) {
    this.config = config
    this.actionMapper = new ActionMapper({
      mcpUrl: config.mcpUrl,
      tabId: config.tabId,
      windowId: config.windowId,
      screenSize: config.screenSize,
    })
  }

  /**
   * Set a hook to be called after each action execution
   */
  setActionHook(hook: ActionHook): void {
    this.actionHook = hook
  }

  /**
   * Call the Gemini Computer Use API
   */
  private async callGeminiApi(): Promise<GeminiResponse> {
    const url = `${GEMINI_API_BASE}/models/${DEFAULTS.model}:generateContent`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: this.contents,
        tools: [
          {
            computer_use: {
              environment: 'ENVIRONMENT_BROWSER',
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText} - ${errorBody}`,
      )
    }

    return response.json()
  }

  /**
   * Extract function calls from a Gemini response
   */
  private extractFunctionCalls(response: GeminiResponse): ComputerUseAction[] {
    const candidate = response.candidates?.[0]
    if (!candidate?.content?.parts) {
      return []
    }

    const actions: ComputerUseAction[] = []
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        const { name, args } = part.functionCall
        // Construct action object
        actions.push({ name, args: args ?? {} } as ComputerUseAction)
      }
    }

    return actions
  }

  /**
   * Extract text response from Gemini response
   */
  private extractTextResponse(response: GeminiResponse): string | null {
    const candidate = response.candidates?.[0]
    if (!candidate?.content?.parts) {
      return null
    }

    const textParts = candidate.content.parts
      .map((p) => p.text)
      .filter((text): text is string => text !== undefined)
    return textParts.length > 0 ? textParts.join('\n') : null
  }

  /**
   * Build function response parts for the next turn
   */
  private buildFunctionResponses(
    actions: ComputerUseAction[],
    currentUrl: string,
    screenshotBase64: string | null,
  ): GeminiPart[] {
    const parts: GeminiPart[] = []

    for (const action of actions) {
      parts.push({
        functionResponse: {
          name: action.name,
          response: { url: currentUrl },
        },
      })
    }

    // Add screenshot as inline data
    if (screenshotBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: screenshotBase64,
        },
      })
    }

    return parts
  }

  /**
   * Execute the agent loop
   */
  async execute(
    query: string,
    streamWriter: StreamWriter,
    signal: AbortSignal,
  ): Promise<{ finalText: string | null; totalActions: number }> {
    let totalActions = 0
    let finalText: string | null = null

    // Wait for page to stabilize before first screenshot
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Capture initial screenshot with retries
    let initialScreenshot: string | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      initialScreenshot = await this.actionMapper.captureScreenshot()
      if (initialScreenshot) break
      console.warn(`Initial screenshot attempt ${attempt} failed, retrying...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    if (!initialScreenshot) {
      throw new Error('Failed to capture initial screenshot after 3 attempts')
    }

    // Build initial content
    const initialParts: GeminiPart[] = [
      { text: query },
      { inlineData: { mimeType: 'image/png', data: initialScreenshot } },
    ]
    this.contents.push({ role: 'user', parts: initialParts })

    const messageId = randomUUID()
    await emitEvent(streamWriter, { type: 'start', messageId })

    let finished = false
    for (let turn = 0; turn < this.config.turnLimit; turn++) {
      if (signal.aborted) {
        await emitEvent(streamWriter, { type: 'abort' })
        break
      }

      // Start step (turn)
      await emitEvent(streamWriter, { type: 'start-step' })

      // Call Gemini API
      let response: GeminiResponse
      try {
        response = await this.callGeminiApi()
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        await emitEvent(streamWriter, {
          type: 'error',
          errorText: `API error: ${errorMsg}`,
        })
        throw error
      }

      // Check for API errors
      if (response.error) {
        await emitEvent(streamWriter, {
          type: 'error',
          errorText: response.error.message,
        })
        throw new Error(`Gemini API error: ${response.error.message}`)
      }

      // Extract text response
      const textResponse = this.extractTextResponse(response)
      if (textResponse) {
        finalText = textResponse
        const textId = randomUUID()
        await emitEvent(streamWriter, { type: 'text-start', id: textId })
        await emitEvent(streamWriter, {
          type: 'text-delta',
          id: textId,
          delta: textResponse,
        })
        await emitEvent(streamWriter, { type: 'text-end', id: textId })
      }

      // Extract function calls
      const actions = this.extractFunctionCalls(response)

      // If no actions, task is complete
      if (actions.length === 0) {
        await emitEvent(streamWriter, { type: 'finish-step' })
        await emitEvent(streamWriter, {
          type: 'finish',
          finishReason: 'completed',
        })
        finished = true
        break
      }

      // Add model response to conversation
      const candidate = response.candidates?.[0]
      if (candidate?.content) {
        this.contents.push(candidate.content)
      }

      // Execute each action
      for (const action of actions) {
        if (signal.aborted) break

        const toolCallId = randomUUID()

        // Tool input events
        await emitEvent(streamWriter, {
          type: 'tool-input-start',
          toolCallId,
          toolName: action.name,
        })
        await emitEvent(streamWriter, {
          type: 'tool-input-available',
          toolCallId,
          toolName: action.name,
          input: action.args,
        })

        const result = await this.actionMapper.execute(action)
        totalActions++

        // Tool output event
        await emitEvent(streamWriter, {
          type: 'tool-output-available',
          toolCallId,
          output: result,
        })

        // Call action hook (for screenshot capture)
        if (this.actionHook) {
          await this.actionHook(action, result)
        }
      }

      // Capture new screenshot and URL
      const newScreenshot = await this.actionMapper.captureScreenshot()
      const currentUrl = await this.actionMapper.getCurrentUrl()

      // Build function responses and add to conversation
      const functionResponseParts = this.buildFunctionResponses(
        actions,
        currentUrl,
        newScreenshot,
      )
      this.contents.push({ role: 'user', parts: functionResponseParts })

      // Finish step (turn)
      await emitEvent(streamWriter, { type: 'finish-step' })
    }

    if (!finished && !signal.aborted) {
      await emitEvent(streamWriter, {
        type: 'finish',
        finishReason: 'max_turns',
      })
    }

    return { finalText, totalActions }
  }
}
