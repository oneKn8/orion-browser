import { randomUUID } from 'node:crypto'
import {
  CLADO_REQUEST_TIMEOUT_MS,
  MAX_ACTIONS_PER_DELEGATION,
} from '../../constants'
import { McpClient, type McpToolResult } from '../../utils/mcp-client'
import { sleep } from '../../utils/sleep'
import type { ExecutorCallbacks } from './executor'
import type { ExecutorConfig, ExecutorResult } from './types'

const CLADO_ACTION_PROVIDER = 'clado-action'
const PAGE_SCOPED_TOOLS = new Set<string>([
  'take_screenshot',
  'evaluate_script',
  'click',
  'click_at',
  'hover',
  'hover_at',
  'clear',
  'fill',
  'press_key',
  'type_at',
  'drag',
  'drag_at',
  'scroll',
  'handle_dialog',
  'select_option',
  'navigate_page',
  'close_page',
  'wait_for',
])

interface CladoActionResponse {
  action?: string
  x?: number
  y?: number
  text?: string
  key?: string
  direction?: string
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  amount?: number
  time?: number
  inference_time_seconds?: number
  raw_response?: string
}

interface Viewport {
  width: number
  height: number
}

interface CladoAction {
  action: string
  x?: number
  y?: number
  text?: string
  key?: string
  direction?: string
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  amount?: number
  time?: number
}

type RawActionPayload = Partial<CladoAction>

interface ActionPoint {
  x: number
  y: number
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clampNormalized(value: number): number {
  return Math.min(999, Math.max(0, Math.round(value)))
}

function isCladoProvider(provider: string): boolean {
  return provider === CLADO_ACTION_PROVIDER
}

export class CladoActionExecutor {
  private readonly mcpClient: McpClient
  private readonly pageId: number
  private callbacks: ExecutorCallbacks = {}
  private stepsUsed = 0
  private viewport: Viewport | null = null
  private lastPoint: ActionPoint | null = null
  private currentUrl = ''

  constructor(
    private readonly config: ExecutorConfig,
    serverUrl: string,
    readonly _windowId?: number,
    readonly _tabId?: number,
    initialPageId?: number,
  ) {
    if (!isCladoProvider(config.provider)) {
      throw new Error(
        `CladoActionExecutor requires provider="${CLADO_ACTION_PROVIDER}"`,
      )
    }
    this.mcpClient = new McpClient(`${serverUrl}/mcp`)
    this.pageId = initialPageId ?? 1
  }

  setCallbacks(callbacks: ExecutorCallbacks): void {
    this.callbacks = callbacks
  }

  getTotalSteps(): number {
    return this.stepsUsed
  }

  async close(): Promise<void> {
    await this.mcpClient.close()
  }

  async execute(
    instruction: string,
    signal?: AbortSignal,
  ): Promise<ExecutorResult> {
    this.viewport = null
    this.lastPoint = null

    const startSteps = this.stepsUsed
    const toolsUsed = new Set<string>()
    const actionHistory: CladoAction[] = []
    let predictionCalls = 0
    const thinkingTrace: string[] = []

    let status: ExecutorResult['status'] = 'done'
    let reason = 'Goal executed.'

    for (let step = 0; step < MAX_ACTIONS_PER_DELEGATION; step++) {
      if (signal?.aborted) {
        status = 'timeout'
        reason = 'Delegation aborted by timeout or cancellation.'
        break
      }

      let screenshotBase64: string
      try {
        screenshotBase64 = await this.captureScreenshotBase64(signal)
      } catch (error) {
        status = signal?.aborted ? 'timeout' : 'blocked'
        reason = `Could not capture screenshot: ${asErrorMessage(error)}`
        break
      }

      const historyForPrediction = this.formatHistory(actionHistory)
      const actionToolCallId = randomUUID()
      const predictionInput = {
        instruction,
        history: historyForPrediction,
      }

      this.callbacks.onToolCallStart?.({
        toolCallId: actionToolCallId,
        toolName: 'clado_action_predict',
        input: predictionInput,
      })

      let prediction: CladoActionResponse
      try {
        prediction = await this.requestActionPrediction(
          instruction,
          screenshotBase64,
          actionHistory,
          signal,
        )
        predictionCalls++
        const thinking = this.extractThinking(prediction.raw_response)
        if (thinking) {
          const previous = thinkingTrace[thinkingTrace.length - 1]
          if (previous !== thinking) {
            thinkingTrace.push(thinking)
          }
        }
      } catch (error) {
        const message = asErrorMessage(error)
        await this.callbacks.onStepFinish?.({
          toolCalls: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              input: predictionInput,
            },
          ],
          toolResults: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              output: { error: message },
            },
          ],
        })
        status = signal?.aborted ? 'timeout' : 'blocked'
        reason = `Clado action request failed: ${message}`
        break
      }

      const predictedActions = this.parseActions(prediction)
      if (predictedActions.length === 0) {
        await this.callbacks.onStepFinish?.({
          toolCalls: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              input: predictionInput,
            },
          ],
          toolResults: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              output: {
                prediction: this.summarizePrediction(prediction),
                parsedActions: [],
              },
            },
          ],
        })
        status = 'blocked'
        reason = 'Clado action response did not contain a valid action.'
        break
      }

      let requestedStop = false
      const executionNotes: string[] = []
      for (const predictedAction of predictedActions) {
        try {
          reason = await this.executeAction(predictedAction, signal)
          executionNotes.push(reason)
          this.stepsUsed++
          await this.callbacks.onToolCallFinish?.()
        } catch (error) {
          const message = asErrorMessage(error)
          executionNotes.push(`Failed ${predictedAction.action}: ${message}`)
          await this.callbacks.onStepFinish?.({
            toolCalls: [
              {
                toolCallId: actionToolCallId,
                toolName: 'clado_action_predict',
                input: predictionInput,
              },
            ],
            toolResults: [
              {
                toolCallId: actionToolCallId,
                toolName: 'clado_action_predict',
                output: {
                  prediction: this.summarizePrediction(prediction),
                  parsedActions: predictedActions,
                  executed: executionNotes,
                },
              },
            ],
          })
          status = signal?.aborted ? 'timeout' : 'blocked'
          reason = `Action execution failed: ${message}`
          requestedStop = true
          break
        }

        actionHistory.push(predictedAction)
        if (predictedAction.action === 'end') {
          reason = 'Model requested end() and marked task complete.'
          requestedStop = true
          break
        }
      }

      if (status === 'done') {
        toolsUsed.add('clado_action_predict')
        await this.callbacks.onStepFinish?.({
          toolCalls: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              input: predictionInput,
            },
          ],
          toolResults: [
            {
              toolCallId: actionToolCallId,
              toolName: 'clado_action_predict',
              output: {
                prediction: this.summarizePrediction(prediction),
                parsedActions: predictedActions,
                executed: executionNotes,
              },
            },
          ],
        })
      }

      if (requestedStop) break
    }

    if (
      status === 'done' &&
      predictionCalls >= MAX_ACTIONS_PER_DELEGATION &&
      !signal?.aborted
    ) {
      status = 'blocked'
      reason = `Reached max action budget (${MAX_ACTIONS_PER_DELEGATION}) without a clear completion signal.`
    }

    if (signal?.aborted && status === 'done') {
      status = 'timeout'
      reason = 'Delegation aborted by timeout or cancellation.'
    }

    this.currentUrl = await this.getCurrentUrl(signal)

    const observation = this.buildObservation({
      status,
      reason,
      actions: actionHistory,
      url: this.currentUrl,
      thinkingTrace,
    })

    return {
      observation,
      status,
      url: this.currentUrl,
      actionsPerformed: this.stepsUsed - startSteps,
      toolsUsed: [...toolsUsed],
    }
  }

  private async requestActionPrediction(
    instruction: string,
    imageBase64: string,
    actionHistory: CladoAction[],
    signal?: AbortSignal,
  ): Promise<CladoActionResponse> {
    if (!this.config.baseUrl) {
      throw new Error('executor.baseUrl must be set for clado-action provider')
    }

    const requestController = new AbortController()
    const onAbort = () => requestController.abort()
    signal?.addEventListener('abort', onAbort, { once: true })

    const timeoutHandle = setTimeout(() => {
      requestController.abort()
    }, CLADO_REQUEST_TIMEOUT_MS)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`
      }

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instruction,
          image_base64: imageBase64,
          history: this.formatHistory(actionHistory),
        }),
        signal: requestController.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `HTTP ${response.status} ${response.statusText}: ${body.slice(0, 400)}`,
        )
      }

      return (await response.json()) as CladoActionResponse
    } finally {
      clearTimeout(timeoutHandle)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  private parseActions(prediction: CladoActionResponse): CladoAction[] {
    const actionFromField =
      typeof prediction.action === 'string' ? prediction.action : null

    const rawActions = this.parseActionsFromRawResponse(prediction.raw_response)
    const primaryFromRaw = rawActions[0] ?? null
    const mergedPrimary = {
      ...primaryFromRaw,
      ...prediction,
      action: actionFromField ?? primaryFromRaw?.action,
    }

    const normalized: CladoAction[] = []
    const primary = this.normalizeActionPayload(mergedPrimary)
    if (primary) normalized.push(primary)

    for (const candidate of rawActions.slice(1)) {
      const parsed = this.normalizeActionPayload(candidate)
      if (!parsed) continue
      const prev = normalized[normalized.length - 1]
      if (
        !prev ||
        this.getActionSignature(prev) !== this.getActionSignature(parsed)
      ) {
        normalized.push(parsed)
      }
    }

    return normalized
  }

  private normalizeActionPayload(
    payload: RawActionPayload,
  ): CladoAction | null {
    if (!payload.action || typeof payload.action !== 'string') {
      return null
    }
    return {
      action: payload.action,
      x: typeof payload.x === 'number' ? payload.x : undefined,
      y: typeof payload.y === 'number' ? payload.y : undefined,
      text: typeof payload.text === 'string' ? payload.text : undefined,
      key: typeof payload.key === 'string' ? payload.key : undefined,
      direction:
        typeof payload.direction === 'string' ? payload.direction : undefined,
      startX: typeof payload.startX === 'number' ? payload.startX : undefined,
      startY: typeof payload.startY === 'number' ? payload.startY : undefined,
      endX: typeof payload.endX === 'number' ? payload.endX : undefined,
      endY: typeof payload.endY === 'number' ? payload.endY : undefined,
      amount: typeof payload.amount === 'number' ? payload.amount : undefined,
      time: typeof payload.time === 'number' ? payload.time : undefined,
    }
  }

  private parseActionsFromRawResponse(
    rawResponse: string | undefined,
  ): RawActionPayload[] {
    if (!rawResponse) return []
    const matches = [
      ...rawResponse.matchAll(/<answer>\s*([\s\S]*?)\s*<\/answer>/gi),
    ]
    const parsed: RawActionPayload[] = []
    for (const match of matches) {
      try {
        parsed.push(JSON.parse(match[1]) as RawActionPayload)
      } catch {
        // ignore malformed answer blocks
      }
    }
    return parsed
  }

  private async executeAction(
    action: CladoAction,
    signal?: AbortSignal,
  ): Promise<string> {
    switch (action.action) {
      case 'click':
      case 'double_click': {
        const point = await this.resolvePoint(action.x, action.y, signal)
        await this.runTool(
          'click_at',
          {
            x: point.x,
            y: point.y,
            clickCount: action.action === 'double_click' ? 2 : 1,
          },
          signal,
        )
        this.lastPoint = point
        return `Executed ${action.action} at (${point.x}, ${point.y}).`
      }

      case 'right_click': {
        const point = await this.resolvePoint(action.x, action.y, signal)
        await this.runTool(
          'click_at',
          {
            x: point.x,
            y: point.y,
            button: 'right',
            clickCount: 1,
          },
          signal,
        )
        this.lastPoint = point
        return `Executed right_click at (${point.x}, ${point.y}).`
      }

      case 'hover': {
        const point = await this.resolvePoint(action.x, action.y, signal)
        await this.runTool('hover_at', { x: point.x, y: point.y }, signal)
        this.lastPoint = point
        return `Hovered at (${point.x}, ${point.y}).`
      }

      case 'type': {
        const text = action.text ?? ''
        if (!text) throw new Error('type action missing text field')

        if (typeof action.x === 'number' && typeof action.y === 'number') {
          this.lastPoint = await this.resolvePoint(action.x, action.y, signal)
        }

        if (this.lastPoint) {
          await this.runTool(
            'type_at',
            { x: this.lastPoint.x, y: this.lastPoint.y, text, clear: false },
            signal,
          )
        } else {
          throw new Error(
            'type action: no coordinates available — cannot determine where to type. ' +
              'Provide x/y or hover/click the target field first.',
          )
        }
        return `Typed text (${Math.min(text.length, 120)} chars).`
      }

      case 'press_key': {
        const key = this.normalizePressKey(action.key)
        await this.runTool('press_key', { key }, signal)
        return `Pressed key "${key}".`
      }

      case 'scroll': {
        const direction = this.normalizeDirection(action.direction)
        const amountPx = this.normalizeScrollAmount(action.amount)
        const ticks = Math.max(1, Math.round(amountPx / 120))

        await this.runTool('scroll', { direction, amount: ticks }, signal)
        return `Scrolled ${direction} by ${ticks} ticks.`
      }

      case 'drag': {
        if (
          typeof action.startX !== 'number' ||
          typeof action.startY !== 'number' ||
          typeof action.endX !== 'number' ||
          typeof action.endY !== 'number'
        ) {
          throw new Error('drag action missing start/end coordinates')
        }
        const start = await this.resolvePoint(
          action.startX,
          action.startY,
          signal,
        )
        const end = await this.resolvePoint(action.endX, action.endY, signal)

        await this.runTool(
          'drag_at',
          { startX: start.x, startY: start.y, endX: end.x, endY: end.y },
          signal,
        )
        this.lastPoint = end
        return `Dragged from (${start.x}, ${start.y}) to (${end.x}, ${end.y}).`
      }

      case 'wait': {
        const waitSeconds = Math.max(
          1,
          Math.min(10, Math.round(action.time ?? 1)),
        )
        await sleep(waitSeconds * 1000, signal)
        return `Waited ${waitSeconds}s.`
      }

      case 'end': {
        return 'Model requested end().'
      }

      default: {
        throw new Error(`Unsupported Clado action: ${action.action}`)
      }
    }
  }

  private async captureScreenshotBase64(signal?: AbortSignal): Promise<string> {
    const result = await this.runTool(
      'take_screenshot',
      { format: 'webp', quality: 80 },
      signal,
    )

    const image = result.raw.content.find(
      (item) => item.type === 'image' && typeof item.data === 'string',
    )
    if (!image?.data) {
      throw new Error('Screenshot response did not include base64 image data')
    }

    return image.data
  }

  private async getViewport(signal?: AbortSignal): Promise<Viewport> {
    if (this.viewport) return this.viewport

    try {
      const result = await this.runTool(
        'evaluate_script',
        { function: '() => [window.innerWidth, window.innerHeight]' },
        signal,
      )
      const text = result.text
      const match = text.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/s)
      if (match) {
        const width = Number.parseInt(match[1], 10)
        const height = Number.parseInt(match[2], 10)
        if (width > 0 && height > 0) {
          this.viewport = { width, height }
          return this.viewport
        }
      }
    } catch {
      // fallback below
    }

    this.viewport = { width: 1440, height: 900 }
    return this.viewport
  }

  private async resolvePoint(
    normalizedX: number | undefined,
    normalizedY: number | undefined,
    signal?: AbortSignal,
  ): Promise<ActionPoint> {
    const viewport = await this.getViewport(signal)
    const nx = clampNormalized(normalizedX ?? 500)
    const ny = clampNormalized(normalizedY ?? 500)

    return {
      x: Math.round((nx / 1000) * viewport.width),
      y: Math.round((ny / 1000) * viewport.height),
    }
  }

  private async getCurrentUrl(signal?: AbortSignal): Promise<string> {
    try {
      const result = await this.runTool(
        'evaluate_script',
        { function: '() => window.location.href' },
        signal,
      )
      const text = result.text
      const urlMatch = text.match(/https?:\/\/[^\s"`]+/i)
      return urlMatch ? urlMatch[0] : this.currentUrl
    } catch {
      return this.currentUrl
    }
  }

  private async runTool(
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ raw: McpToolResult; text: string }> {
    if (signal?.aborted) {
      throw new Error('aborted')
    }

    const toolArgs = this.prepareToolArgs(toolName, args)

    try {
      const raw = await this.mcpClient.callTool(toolName, toolArgs)
      const text = raw.content
        .map((item) => item.text)
        .filter((value): value is string => typeof value === 'string')
        .join('\n')

      if (raw.isError) {
        throw new Error(text || `${toolName} failed`)
      }

      return { raw, text }
    } catch (error) {
      throw new Error(`${toolName} failed: ${asErrorMessage(error)}`)
    }
  }

  private prepareToolArgs(
    toolName: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = { ...args }

    if (
      toolName === 'evaluate_script' &&
      typeof prepared.function === 'string' &&
      prepared.expression === undefined
    ) {
      prepared.expression = this.toEvaluateExpression(prepared.function)
      delete prepared.function
    }

    if (
      toolName === 'click_at' &&
      typeof prepared.dblClick === 'boolean' &&
      prepared.clickCount === undefined
    ) {
      prepared.clickCount = prepared.dblClick ? 2 : 1
      delete prepared.dblClick
    }

    // Use fixed page ID for all page-scoped tools (single-page operation)
    if (PAGE_SCOPED_TOOLS.has(toolName) && typeof prepared.page !== 'number') {
      prepared.page = this.pageId
    }

    return prepared
  }

  private toEvaluateExpression(rawFunction: unknown): string {
    const source = String(rawFunction).trim()
    if (source.startsWith('() =>') || source.startsWith('async () =>')) {
      return `(${source})()`
    }
    if (source.startsWith('function')) {
      return `(${source})()`
    }
    return source
  }

  private normalizePressKey(key: string | undefined): string {
    const raw = (key ?? '').trim()
    if (!raw) throw new Error('press_key action missing key field')

    const map: Record<string, string> = {
      'C-a': 'Control+A',
      'C-c': 'Control+C',
      'C-v': 'Control+V',
      'C-x': 'Control+X',
      'C-z': 'Control+Z',
      'C-y': 'Control+Y',
      'C-s': 'Control+S',
      'C-t': 'Control+T',
      'C-w': 'Control+W',
      'C-h': 'Control+H',
      'C-f': 'Control+F',
      'C-+': 'Control++',
      'C--': 'Control+-',
      'C-tab': 'Control+Tab',
      'C-S-tab': 'Control+Shift+Tab',
      'C-S-n': 'Control+Shift+N',
      'C-down': 'Control+ArrowDown',
      'M-f4': 'Alt+F4',
    }
    return map[raw] ?? raw
  }

  private normalizeDirection(
    direction: string | undefined,
  ): 'up' | 'down' | 'left' | 'right' {
    if (
      direction === 'up' ||
      direction === 'down' ||
      direction === 'left' ||
      direction === 'right'
    ) {
      return direction
    }
    return 'down'
  }

  private normalizeScrollAmount(amount: number | undefined): number {
    if (typeof amount !== 'number') return 500
    if (amount <= 0) return 100
    const clamped = Math.min(amount, 1000)
    return Math.max(100, Math.round((clamped / 1000) * 900))
  }

  private summarizePrediction(
    prediction: CladoActionResponse,
  ): Record<string, unknown> {
    const preview =
      typeof prediction.raw_response === 'string' &&
      prediction.raw_response.length > 0
        ? prediction.raw_response.slice(0, 240)
        : undefined

    return {
      action: prediction.action,
      x: prediction.x,
      y: prediction.y,
      text: prediction.text,
      key: prediction.key,
      direction: prediction.direction,
      startX: prediction.startX,
      startY: prediction.startY,
      endX: prediction.endX,
      endY: prediction.endY,
      amount: prediction.amount,
      time: prediction.time,
      inference_time_seconds: prediction.inference_time_seconds,
      raw_response_preview: preview,
    }
  }

  private extractThinking(rawResponse: string | undefined): string | undefined {
    if (!rawResponse) return undefined
    const matches = [
      ...rawResponse.matchAll(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/gi),
    ]
    if (matches.length === 0) return undefined

    const merged = matches
      .map((match) => match[1]?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((value) => value.length > 0)
      .join(' ')

    if (!merged) return undefined
    return merged
  }

  private getActionSignature(action: CladoAction): string {
    switch (action.action) {
      case 'click':
      case 'double_click':
      case 'right_click':
      case 'hover':
        return `${action.action}:${action.x ?? 'x'}:${action.y ?? 'y'}`
      case 'type':
        return `${action.action}:${(action.text ?? '').slice(0, 16)}`
      case 'press_key':
        return `${action.action}:${action.key ?? 'key'}`
      case 'scroll':
        return `${action.action}:${action.direction ?? 'down'}:${action.amount ?? 500}`
      case 'drag':
        return `${action.action}:${action.startX}:${action.startY}:${action.endX}:${action.endY}`
      case 'wait':
        return `${action.action}:${action.time ?? 1}`
      case 'end':
        return 'end()'
      default:
        return action.action
    }
  }

  private formatHistory(actions: CladoAction[]): string {
    if (actions.length === 0) return 'None'

    const parts = actions.map((action) => {
      switch (action.action) {
        case 'click':
        case 'double_click':
        case 'right_click':
        case 'hover':
          return `${action.action}(${Math.round(action.x ?? 500)}, ${Math.round(action.y ?? 500)})`
        case 'type': {
          const text = (action.text ?? '').replace(/'/g, "\\'")
          return `type('${text}')`
        }
        case 'press_key':
          return `press_key('${action.key ?? 'Enter'}')`
        case 'scroll':
          return `scroll(${action.direction ?? 'down'})`
        case 'drag':
          return `drag(${Math.round(action.startX ?? 500)},${Math.round(action.startY ?? 500)} -> ${Math.round(action.endX ?? 500)},${Math.round(action.endY ?? 500)})`
        case 'wait':
          return `wait(${Math.round(action.time ?? 1)}s)`
        case 'end':
          return 'end()'
        default:
          return action.action
      }
    })

    return parts.join(' -> ')
  }

  private buildObservation(params: {
    status: ExecutorResult['status']
    reason: string
    actions: CladoAction[]
    url: string
    thinkingTrace: string[]
  }): string {
    const { status, reason, actions, url, thinkingTrace } = params
    const actionSummary =
      actions.length === 0
        ? 'No actions were executed.'
        : actions
            .slice(-5)
            .map(
              (action, idx) => `${idx + 1}. ${this.getActionSignature(action)}`,
            )
            .join('\n')
    const thinkingSummary =
      thinkingTrace.length === 0
        ? ''
        : thinkingTrace
            .map((thinking, idx) => `Step ${idx + 1}: ${thinking}`)
            .join('\n\n')

    return [
      `Status: ${status}`,
      `Reason: ${reason}`,
      `URL: ${url || 'unknown'}`,
      '',
      'Recent actions:',
      actionSummary,
      '',
      `Total model actions: ${actions.length}`,
      '',
      thinkingSummary ? `Model thinking trace:\n${thinkingSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
}
