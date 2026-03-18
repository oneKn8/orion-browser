/**
 * Yutori Navigator n1 Agent
 *
 * Implements the agent loop that calls Yutori n1 API and executes actions.
 * Uses UIMessageStreamEvent format for logging compatibility.
 *
 * n1 API follows OpenAI Chat Completions interface with special 'observation' role
 * for screenshots. Full conversation history must be maintained.
 */

import { randomUUID } from 'node:crypto'
import { ActionMapper } from './action-mapper'
import {
  DEFAULTS,
  type N1Action,
  type N1ChatCompletionResponse,
  type N1Message,
  N1ResponseSchema,
  YUTORI_API_BASE,
  type YutoriNavigatorAgentConfig,
} from './types'

interface StreamWriter {
  write: (data: string) => Promise<void>
}

type ActionHook = (
  action: N1Action,
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

export class YutoriNavigatorAgent {
  private config: YutoriNavigatorAgentConfig
  private actionMapper: ActionMapper
  private actionHook?: ActionHook
  private messages: N1Message[] = []

  constructor(config: YutoriNavigatorAgentConfig) {
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
   * Build observation message with screenshot and optional URL
   */
  private buildObservationMessage(
    screenshotBase64: string,
    currentUrl?: string,
  ): N1Message {
    const content: N1Message['content'] = []

    // Include URL if available (recommended by Yutori for better attribution)
    if (currentUrl) {
      content.push({
        type: 'text',
        text: `Current URL: ${currentUrl}`,
      })
    }

    // Add screenshot as base64 data URL (WebP for smaller payload)
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/webp;base64,${screenshotBase64}`,
      },
    })

    return {
      role: 'observation',
      content,
    }
  }

  /**
   * Call the Yutori n1 API
   */
  private async callN1Api(): Promise<N1ChatCompletionResponse> {
    const url = `${YUTORI_API_BASE}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULTS.model,
        messages: this.messages,
        temperature: DEFAULTS.temperature,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Yutori n1 API error: ${response.status} ${response.statusText} - ${errorBody}`,
      )
    }

    return response.json()
  }

  /**
   * Parse n1 response content to extract thoughts and actions
   */
  private parseN1Response(
    content: string,
  ): { thoughts: string; actions: N1Action[] } | null {
    try {
      const parsed = JSON.parse(content)
      const validated = N1ResponseSchema.safeParse(parsed)

      if (validated.success) {
        return validated.data
      }

      console.warn('n1 response validation failed:', validated.error.message)
      // Try to extract what we can
      return {
        thoughts: parsed.thoughts ?? '',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      }
    } catch (error) {
      console.warn('Failed to parse n1 response:', error)
      return null
    }
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

    // Get initial URL
    const initialUrl = await this.actionMapper.getCurrentUrl()

    // Build initial messages
    // 1. User message with task
    this.messages.push({
      role: 'user',
      content: [{ type: 'text', text: query }],
    })

    // 2. Initial observation with screenshot
    this.messages.push(
      this.buildObservationMessage(initialScreenshot, initialUrl),
    )

    // Emit start event
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

      // Call n1 API
      let response: N1ChatCompletionResponse
      try {
        response = await this.callN1Api()
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        await emitEvent(streamWriter, {
          type: 'error',
          errorText: `API error: ${errorMsg}`,
        })
        throw error
      }

      // Extract response content
      const choice = response.choices?.[0]
      if (!choice?.message?.content) {
        await emitEvent(streamWriter, {
          type: 'error',
          errorText: 'Empty response from n1 API',
        })
        throw new Error('Empty response from n1 API')
      }

      const assistantContent = choice.message.content

      // Parse the JSON response
      const parsed = this.parseN1Response(assistantContent)
      if (!parsed) {
        await emitEvent(streamWriter, {
          type: 'error',
          errorText: 'Failed to parse n1 response',
        })
        throw new Error('Failed to parse n1 response')
      }

      const { thoughts, actions } = parsed

      // Emit thoughts as text
      if (thoughts) {
        finalText = thoughts
        const textId = randomUUID()
        await emitEvent(streamWriter, { type: 'text-start', id: textId })
        await emitEvent(streamWriter, {
          type: 'text-delta',
          id: textId,
          delta: thoughts,
        })
        await emitEvent(streamWriter, { type: 'text-end', id: textId })
      }

      // Check for stop action or no actions
      const stopAction = actions.find((a) => a.action_type === 'stop')
      if (stopAction && stopAction.action_type === 'stop') {
        finalText = stopAction.answer
        await emitEvent(streamWriter, { type: 'finish-step' })
        await emitEvent(streamWriter, {
          type: 'finish',
          finishReason: 'completed',
        })
        finished = true
        break
      }

      if (actions.length === 0) {
        await emitEvent(streamWriter, { type: 'finish-step' })
        await emitEvent(streamWriter, {
          type: 'finish',
          finishReason: 'completed',
        })
        finished = true
        break
      }

      // Add assistant response to conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantContent,
      })

      // Execute each action
      for (const action of actions) {
        if (signal.aborted) break

        // Skip stop actions (handled above)
        if (action.action_type === 'stop') continue

        const toolCallId = randomUUID()

        // Tool input events
        await emitEvent(streamWriter, {
          type: 'tool-input-start',
          toolCallId,
          toolName: action.action_type,
        })
        await emitEvent(streamWriter, {
          type: 'tool-input-available',
          toolCallId,
          toolName: action.action_type,
          input: action,
        })

        const result = await this.actionMapper.execute(action)
        totalActions++

        // Check if this was a stop action that returned an answer
        if (result.stopAnswer) {
          finalText = result.stopAnswer
        }

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

      // Capture new screenshot and URL for next turn
      const newScreenshot = await this.actionMapper.captureScreenshot()
      const currentUrl = await this.actionMapper.getCurrentUrl()

      // Add observation for next turn (n1 requires full history)
      if (newScreenshot) {
        this.messages.push(
          this.buildObservationMessage(newScreenshot, currentUrl),
        )
      }

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
