# Eval System - Production Grade Implementation Plan

## Overview

This plan outlines the changes needed to make the eval system production-grade with uniform agent observation across all agent patterns (single-agent, orchestrator-executor, future patterns).

**Goal:** All agent evaluators produce consistent `AgentResult` with screenshots, message traces, and verifiable action sequences.

---

## Phase 1: Type System Extensions

### 1.1 Add New Message Types

**File:** `src/types.ts`

Add delegation-specific message types for orchestrator pattern:

```typescript
// After ErrorMessage definition (~line 99)

export interface DelegationMessage extends BaseMessage {
  type: 'delegation'
  instruction: string
  executorId: string
  maxSteps?: number
}

export interface DelegationResultMessage extends BaseMessage {
  type: 'delegation_result'
  executorId: string
  summary: string
  status: 'done' | 'blocked' | 'max_steps'
  stepsUsed: number
  currentUrl?: string
}

// Update Message union (~line 101)
export type Message =
  | UserMessage
  | AssistantMessage
  | ToolCallMessage
  | ToolResultMessage
  | ErrorMessage
  | DelegationMessage      // NEW
  | DelegationResultMessage // NEW

// Add type guards
export function isDelegationMessage(msg: Message): msg is DelegationMessage {
  return msg.type === 'delegation'
}

export function isDelegationResultMessage(msg: Message): msg is DelegationResultMessage {
  return msg.type === 'delegation_result'
}
```

### 1.2 Add Orchestrator Hook Types

**File:** `src/agents/orchestrator-executor/types.ts`

```typescript
// Add after existing types

export interface OrchestratorHooks {
  onDelegation?: (instruction: string, executorId: string, maxSteps?: number) => Promise<void>
  onDelegationResult?: (result: ExecutorResult) => Promise<void>
  onTurnStart?: (turn: number) => Promise<void>
  onTurnComplete?: (turn: number) => Promise<void>
  onComplete?: (answer: string) => Promise<void>
  onFailed?: (reason: string) => Promise<void>
}

export interface ExecutorObservationHooks {
  onBeforeToolCall?: (toolName: string, args: unknown) => Promise<string> // returns toolCallId
  onAfterToolCall?: (toolName: string, toolCallId: string, result: unknown, isError: boolean) => Promise<void>
}
```

---

## Phase 2: Unified Capture Infrastructure

### 2.1 Create EvalCapture Class

**File:** `src/capture/eval-capture.ts` (NEW)

```typescript
/**
 * EvalCapture - Unified capture infrastructure for all agent evaluators
 *
 * Combines screenshot capture, message logging, and provides hooks for
 * both single-agent and orchestrator-executor patterns.
 */

import { randomUUID } from 'node:crypto'
import type {
  AssistantMessage,
  DelegationMessage,
  DelegationResultMessage,
  ErrorMessage,
  Message,
  ToolCallMessage,
  ToolResultMessage,
  UserMessage,
} from '../types'
import { MessageLogger } from './message-logger'
import { ScreenshotCapture } from './screenshot'

export interface EvalCaptureConfig {
  serverUrl: string
  outputDir: string
  tabId: number
  windowId: number
}

export class EvalCapture {
  private screenshotCapture: ScreenshotCapture
  private messageLogger: MessageLogger
  private tabId: number
  private windowId: number
  private currentToolCallId: string | null = null

  constructor(config: EvalCaptureConfig) {
    this.screenshotCapture = new ScreenshotCapture(config.serverUrl, config.outputDir)
    this.messageLogger = new MessageLogger(config.outputDir)
    this.tabId = config.tabId
    this.windowId = config.windowId
  }

  async init(): Promise<void> {
    await this.screenshotCapture.init()
  }

  // ============================================================================
  // Screenshot Capture
  // ============================================================================

  async captureScreenshot(): Promise<number> {
    return this.screenshotCapture.capture(this.tabId, this.windowId)
  }

  getScreenshotCount(): number {
    return this.screenshotCapture.getCount()
  }

  // ============================================================================
  // Message Logging - Basic Types
  // ============================================================================

  async logUser(content: string): Promise<void> {
    await this.messageLogger.logUser(content)
  }

  async logAssistant(content: string): Promise<void> {
    await this.messageLogger.logAssistant(content)
  }

  async logError(content: string, errorCode?: string): Promise<void> {
    await this.messageLogger.logError(content, errorCode)
  }

  // ============================================================================
  // Tool Call Logging (for single-agent and executor)
  // ============================================================================

  async logToolCall(tool: string, params: Record<string, unknown>): Promise<string> {
    const toolCallId = randomUUID()
    this.currentToolCallId = toolCallId
    await this.messageLogger.logToolCall(tool, toolCallId, params)
    return toolCallId
  }

  async logToolResult(
    toolCallId: string,
    result: unknown,
    isError: boolean,
    screenshot?: number,
  ): Promise<void> {
    await this.messageLogger.logToolResult(toolCallId, result, isError, screenshot)
    this.currentToolCallId = null
  }

  getCurrentToolCallId(): string | null {
    return this.currentToolCallId
  }

  // ============================================================================
  // Delegation Logging (for orchestrator-executor)
  // ============================================================================

  async logDelegation(
    instruction: string,
    executorId: string,
    maxSteps?: number,
  ): Promise<void> {
    const message: DelegationMessage = {
      type: 'delegation',
      timestamp: new Date().toISOString(),
      instruction,
      executorId,
      ...(maxSteps !== undefined && { maxSteps }),
    }
    // Extend MessageLogger to handle this, or append directly
    await this.appendMessage(message)
  }

  async logDelegationResult(
    executorId: string,
    summary: string,
    status: 'done' | 'blocked' | 'max_steps',
    stepsUsed: number,
    currentUrl?: string,
  ): Promise<void> {
    const message: DelegationResultMessage = {
      type: 'delegation_result',
      timestamp: new Date().toISOString(),
      executorId,
      summary,
      status,
      stepsUsed,
      ...(currentUrl && { currentUrl }),
    }
    await this.appendMessage(message)
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async appendMessage(message: Message): Promise<void> {
    // Access internal messages array and file
    // This requires either extending MessageLogger or using a shared approach
    const messages = this.messageLogger.getMessages()
    messages.push(message)
    // Write to file - MessageLogger needs extension for this
  }

  getMessages(): Message[] {
    return this.messageLogger.getMessages()
  }

  getLastAssistantMessage(): string | null {
    return this.messageLogger.getLastAssistantMessage()
  }
}
```

### 2.2 Extend MessageLogger for New Types

**File:** `src/capture/message-logger.ts`

Add methods for delegation messages:

```typescript
// Add after logError method

async logDelegation(
  instruction: string,
  executorId: string,
  maxSteps?: number,
): Promise<void> {
  const message: DelegationMessage = {
    type: 'delegation',
    timestamp: new Date().toISOString(),
    instruction,
    executorId,
    ...(maxSteps !== undefined && { maxSteps }),
  }
  await this.append(message)
}

async logDelegationResult(
  executorId: string,
  summary: string,
  status: 'done' | 'blocked' | 'max_steps',
  stepsUsed: number,
  currentUrl?: string,
): Promise<void> {
  const message: DelegationResultMessage = {
    type: 'delegation_result',
    timestamp: new Date().toISOString(),
    executorId,
    summary,
    status,
    stepsUsed,
    ...(currentUrl && { currentUrl }),
  }
  await this.append(message)
}
```

---

## Phase 3: Executor Hook Integration

### 3.1 Modify Executor to Accept External Hooks

**File:** `src/agents/orchestrator-executor/executor.ts`

```typescript
// Add import
import type { ExecutorObservationHooks } from './types'

export class Executor {
  private agent: GeminiAgent | null = null
  private stepsUsed = 0
  private currentUrl = ''
  private config: ExecutorConfig
  private serverUrl: string
  private windowId: number
  private tabId: number
  private observationHooks?: ExecutorObservationHooks  // NEW

  // ... existing constructor ...

  /**
   * Set external observation hooks for capture integration
   */
  setObservationHooks(hooks: ExecutorObservationHooks): void {
    this.observationHooks = hooks
  }

  async execute(
    instruction: string,
    maxSteps?: number,
    signal?: AbortSignal,
  ): Promise<Omit<ExecutorResult, 'executorId'>> {
    // ... existing setup ...

    // Track steps via hooks - MODIFIED to include external observation
    let stepsThisRun = 0
    const hooks: ToolExecutionHooks = {
      onBeforeToolCall: async (toolName: string, args: unknown) => {
        // Call external hook if set (for logging)
        if (this.observationHooks?.onBeforeToolCall) {
          await this.observationHooks.onBeforeToolCall(toolName, args)
        }
      },
      onAfterToolCall: async (toolName: string, result: ToolExecutionResult) => {
        stepsThisRun++
        this.stepsUsed++

        // Call external hook if set (for screenshot capture and logging)
        if (this.observationHooks?.onAfterToolCall) {
          const toolCallId = 'current' // Will be tracked by EvalCapture
          await this.observationHooks.onAfterToolCall(
            toolName,
            toolCallId,
            result.parts,
            result.isError,
          )
        }
      },
    }
    this.agent.setToolHooks(hooks)

    // ... rest of execute method ...
  }
}
```

### 3.2 Pass Hooks Through ExecutorStore

**File:** `src/agents/orchestrator-executor/executor-store.ts`

```typescript
import type { ExecutorObservationHooks } from './types'

export class ExecutorStore {
  private executors = new Map<string, Executor>()
  private observationHooks?: ExecutorObservationHooks  // NEW

  /**
   * Set observation hooks that will be applied to all executors
   */
  setObservationHooks(hooks: ExecutorObservationHooks): void {
    this.observationHooks = hooks
    // Apply to existing executors
    for (const executor of this.executors.values()) {
      executor.setObservationHooks(hooks)
    }
  }

  getOrCreate(
    id: string,
    config: ExecutorConfig,
    serverUrl: string,
    windowId: number,
    tabId: number,
  ): Executor {
    if (!this.executors.has(id)) {
      const executor = new Executor(config, serverUrl, windowId, tabId)
      // Apply observation hooks to new executor
      if (this.observationHooks) {
        executor.setObservationHooks(this.observationHooks)
      }
      this.executors.set(id, executor)
    }
    return this.executors.get(id)!
  }

  // ... rest unchanged ...
}
```

---

## Phase 4: Orchestrator Hook Integration

### 4.1 Add Hooks to OrchestratorAgent

**File:** `src/agents/orchestrator-executor/orchestrator-agent.ts`

```typescript
import type { ExecutorObservationHooks, OrchestratorHooks } from './types'

export class OrchestratorAgent {
  private orchestratorHooks?: OrchestratorHooks  // NEW

  private constructor(
    private client: GeminiClient,
    private geminiConfig: GeminiConfig,
    private state: OrchestratorState,
    private executorStore: ExecutorStore,
    private maxTurns: number,
  ) {}

  /**
   * Set orchestrator-level hooks for delegation tracking
   */
  setHooks(hooks: OrchestratorHooks): void {
    this.orchestratorHooks = hooks
  }

  /**
   * Set executor observation hooks (passed through to ExecutorStore)
   */
  setExecutorObservationHooks(hooks: ExecutorObservationHooks): void {
    this.executorStore.setObservationHooks(hooks)
  }

  /**
   * Get hooks for tool context (used by orchestrator-tools.ts)
   */
  getOrchestratorHooks(): OrchestratorHooks | undefined {
    return this.orchestratorHooks
  }

  async run(taskQuery: string): Promise<OrchestratorAgentResult> {
    let currentParts: Part[] = [{ text: taskQuery }]
    let turns = 0

    while (
      !this.state.isComplete &&
      !this.state.isFailed &&
      turns < this.maxTurns
    ) {
      turns++

      // Fire turn start hook
      await this.orchestratorHooks?.onTurnStart?.(turns)

      // ... existing turn logic ...

      // Fire turn complete hook
      await this.orchestratorHooks?.onTurnComplete?.(turns)
    }

    // Fire completion hooks
    if (this.state.isComplete && this.state.finalAnswer) {
      await this.orchestratorHooks?.onComplete?.(this.state.finalAnswer)
    } else if (this.state.isFailed && this.state.failureReason) {
      await this.orchestratorHooks?.onFailed?.(this.state.failureReason)
    }

    return {
      success: this.state.isComplete,
      answer: this.state.finalAnswer,
      reason: this.state.failureReason,
      delegationCount: this.state.delegationCount,
      totalExecutorSteps: this.state.totalExecutorSteps,
      turns,
    }
  }

  // ... rest unchanged ...
}
```

### 4.2 Fire Hooks in Orchestrator Tools

**File:** `src/agents/orchestrator-executor/orchestrator-tools.ts`

Modify the delegate tool handler to fire hooks:

```typescript
// In createOrchestratorTools function, modify the delegate tool handler

// Inside the delegate tool's handler:
handler: async (args) => {
  const { instruction, executorId, maxSteps } = args as DelegateParams

  // Fire delegation hook BEFORE execution
  const hooks = context.getOrchestratorHooks?.()
  const actualExecutorId = executorId ?? randomUUID()
  await hooks?.onDelegation?.(instruction, actualExecutorId, maxSteps)

  // Get or create executor
  const executor = context.executorStore.getOrCreate(
    actualExecutorId,
    context.executorConfig,
    context.serverUrl,
    context.windowId,
    context.tabId,
  )

  // Execute
  const result = await executor.execute(instruction, maxSteps)

  // Update state
  context.state.delegationCount++
  context.state.totalExecutorSteps += result.stepsUsed

  // Fire delegation result hook AFTER execution
  await hooks?.onDelegationResult?.({
    ...result,
    executorId: actualExecutorId,
  })

  // Return result to orchestrator
  return {
    executorId: actualExecutorId,
    ...result,
  }
}
```

---

## Phase 5: Update OrchestratorExecutorEvaluator

### 5.1 Full Integration

**File:** `src/agents/orchestrator-executor/index.ts`

```typescript
import { ScreenshotCapture } from '../../capture/screenshot'
import { MessageLogger } from '../../capture/message-logger'
import { TrajectorySaver } from '../../capture/trajectory-saver'
import type { ExecutorObservationHooks, OrchestratorHooks } from './types'

export class OrchestratorExecutorEvaluator implements AgentEvaluator {
  constructor(
    private config: EvalConfig,
    private task: Task,
    private windowId: number,
    private tabId: number,
    private outputDir: string,
  ) {}

  async execute(): Promise<AgentResult> {
    const startTime = Date.now()
    const timeoutMs = this.config.timeout_ms ?? DEFAULT_TIMEOUT_MS

    const errors: TaskError[] = []
    const warnings: EvalWarning[] = []

    const addError = (source: TaskError['source'], message: string, details?: Record<string, unknown>) => {
      errors.push({ source, message, timestamp: new Date().toISOString(), details })
    }

    const addWarning = (source: EvalWarning['source'], message: string) => {
      warnings.push({ source, message, timestamp: new Date().toISOString() })
      console.warn(`[${source}] ${message}`)
    }

    // Initialize trajectory saver
    const saver = new TrajectorySaver(this.outputDir, this.task.query_id)
    const taskOutputDir = await saver.init()

    // NEW: Initialize capture infrastructure (same as single-agent)
    const screenshotCapture = new ScreenshotCapture(
      this.config.orion.server_url,
      taskOutputDir,
    )
    await screenshotCapture.init()

    const messageLogger = new MessageLogger(taskOutputDir)

    // Log initial user message
    await messageLogger.logUser(this.task.query)

    // Validate config type
    if (this.config.agent.type !== 'orchestrator-executor') {
      throw new Error('OrchestratorExecutorEvaluator requires orchestrator-executor config')
    }

    const agentConfig = this.config.agent as OrchestratorExecutorConfig
    const { orchestrator: orchestratorConfig, executor: executorConfig } =
      resolveAgentConfig(agentConfig)

    // Create orchestrator
    const orchestrator = new Orchestrator(
      orchestratorConfig,
      executorConfig,
      this.config.orion.server_url,
      this.windowId,
      this.tabId,
    )

    // NEW: Set up executor observation hooks (for tool call/result capture)
    let currentToolCallId: string | null = null

    const executorHooks: ExecutorObservationHooks = {
      onBeforeToolCall: async (toolName: string, args: unknown) => {
        try {
          currentToolCallId = randomUUID()
          await messageLogger.logToolCall(toolName, currentToolCallId, args as Record<string, unknown>)
        } catch (err) {
          addWarning('message_logging', `Failed to log tool call ${toolName}: ${err instanceof Error ? err.message : String(err)}`)
        }
        return currentToolCallId
      },
      onAfterToolCall: async (toolName: string, _toolCallId: string, result: unknown, isError: boolean) => {
        let screenshotNum = 0

        // Capture screenshot after tool execution
        try {
          screenshotNum = await screenshotCapture.capture(this.tabId, this.windowId)
        } catch (err) {
          addWarning('screenshot', `Screenshot after ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`)
          screenshotNum = screenshotCapture.getCount()
        }

        // Log tool errors
        if (isError) {
          addWarning('mcp_tool', `Tool ${toolName} returned error`)
        }

        if (!currentToolCallId) {
          addWarning('message_logging', 'Tool result without matching tool call')
          return
        }

        try {
          await messageLogger.logToolResult(currentToolCallId, result, isError, screenshotNum)
        } catch (err) {
          addWarning('message_logging', `Failed to log tool result: ${err instanceof Error ? err.message : String(err)}`)
        }

        currentToolCallId = null
      },
    }

    // NEW: Set up orchestrator hooks (for delegation tracking)
    const orchestratorHooks: OrchestratorHooks = {
      onDelegation: async (instruction: string, executorId: string, maxSteps?: number) => {
        try {
          await messageLogger.logDelegation(instruction, executorId, maxSteps)
        } catch (err) {
          addWarning('message_logging', `Failed to log delegation: ${err instanceof Error ? err.message : String(err)}`)
        }
      },
      onDelegationResult: async (result) => {
        try {
          await messageLogger.logDelegationResult(
            result.executorId,
            result.summary,
            result.status,
            result.stepsUsed,
            result.currentUrl,
          )
        } catch (err) {
          addWarning('message_logging', `Failed to log delegation result: ${err instanceof Error ? err.message : String(err)}`)
        }
      },
    }

    // Apply hooks to orchestrator
    orchestrator.setHooks(orchestratorHooks)
    orchestrator.setExecutorObservationHooks(executorHooks)

    // Set up timeout
    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => {
      abortController.abort()
    }, timeoutMs)

    let terminationReason: 'completed' | 'max_steps' | 'error' | 'timeout' = 'completed'
    let finalAnswer: string | null = null
    let orchestratorResult: Awaited<ReturnType<typeof orchestrator.run>> | null = null

    try {
      const runPromise = orchestrator.run(this.task.query)

      orchestratorResult = await Promise.race([
        runPromise,
        new Promise<never>((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Timeout'))
          })
        }),
      ])

      if (orchestratorResult.success) {
        finalAnswer = orchestratorResult.answer
        terminationReason = 'completed'
        // Log final assistant message
        if (finalAnswer) {
          await messageLogger.logAssistant(finalAnswer)
        }
      } else {
        terminationReason = 'error'
        addError('agent_execution', orchestratorResult.reason ?? 'Unknown failure')
        await messageLogger.logError(orchestratorResult.reason ?? 'Unknown failure')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      if (error.message === 'Timeout' || abortController.signal.aborted) {
        terminationReason = 'timeout'
        addError('agent_execution', `Task timed out after ${timeoutMs / 1000}s`)
      } else {
        terminationReason = 'error'
        addError('agent_execution', error.message, { stack: error.stack })
      }
      await messageLogger.logError(error.message)
    } finally {
      clearTimeout(timeoutHandle)
      orchestrator.getExecutorStore().clear()
    }

    const endTime = Date.now()

    // Create metadata
    const metadata: TaskMetadata = {
      query_id: this.task.query_id,
      dataset: this.task.dataset,
      query: this.task.query,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      total_duration_ms: endTime - startTime,
      total_steps: screenshotCapture.getCount(),  // Now accurate
      termination_reason: terminationReason,
      final_answer: finalAnswer,
      errors,
      warnings,
      agent_config: {
        type: 'orchestrator-executor',
        model: `${orchestratorConfig.model} / ${executorConfig.model}`,
      },
      grader_results: {},
    }

    await saver.saveMetadata(metadata)

    return {
      metadata,
      messages: messageLogger.getMessages(),  // NOW POPULATED
      finalAnswer,
    }
  }
}
```

---

## Phase 6: Orchestrator Class Updates

### 6.1 Add Hook Passthrough Methods

**File:** `src/agents/orchestrator-executor/orchestrator.ts`

```typescript
import type { ExecutorObservationHooks, OrchestratorHooks } from './types'

export class Orchestrator {
  private agent: OrchestratorAgent | null = null
  private executorStore: ExecutorStore
  private pendingOrchestratorHooks?: OrchestratorHooks
  private pendingExecutorHooks?: ExecutorObservationHooks

  constructor(
    private orchestratorConfig: OrchestratorConfig,
    private executorConfig: ExecutorConfig,
    private serverUrl: string,
    private windowId: number,
    private tabId: number,
  ) {
    this.executorStore = new ExecutorStore()
  }

  /**
   * Set orchestrator-level hooks (must be called before run())
   */
  setHooks(hooks: OrchestratorHooks): void {
    this.pendingOrchestratorHooks = hooks
    if (this.agent) {
      this.agent.setHooks(hooks)
    }
  }

  /**
   * Set executor observation hooks (must be called before run())
   */
  setExecutorObservationHooks(hooks: ExecutorObservationHooks): void {
    this.pendingExecutorHooks = hooks
    this.executorStore.setObservationHooks(hooks)
    if (this.agent) {
      this.agent.setExecutorObservationHooks(hooks)
    }
  }

  async run(taskQuery: string): Promise<OrchestratorAgentResult> {
    this.agent = await OrchestratorAgent.create(
      this.orchestratorConfig,
      this.executorConfig,
      this.serverUrl,
      this.windowId,
      this.tabId,
    )

    // Apply pending hooks
    if (this.pendingOrchestratorHooks) {
      this.agent.setHooks(this.pendingOrchestratorHooks)
    }
    if (this.pendingExecutorHooks) {
      this.agent.setExecutorObservationHooks(this.pendingExecutorHooks)
    }

    const result = await this.agent.run(taskQuery)
    this.executorStore = this.agent.getExecutorStore()

    return result
  }

  getExecutorStore(): ExecutorStore {
    return this.agent?.getExecutorStore() ?? this.executorStore
  }
}
```

---

## Implementation Order

1. **Phase 1** - Type extensions (types.ts) - 30 min
2. **Phase 2** - MessageLogger extensions - 30 min
3. **Phase 3** - Executor hook integration - 1 hour
4. **Phase 4** - OrchestratorAgent hooks - 1 hour
5. **Phase 5** - OrchestratorExecutorEvaluator update - 1.5 hours
6. **Phase 6** - Orchestrator passthrough - 30 min
7. **Testing** - End-to-end verification - 1 hour

**Total estimated time:** ~6 hours

---

## Testing Checklist

- [ ] Single-agent eval still works (regression test)
- [ ] Orchestrator-executor produces screenshots in output folder
- [ ] Orchestrator-executor produces messages.jsonl with:
  - [ ] user message
  - [ ] delegation messages
  - [ ] tool_call messages (from executor)
  - [ ] tool_result messages with screenshot numbers
  - [ ] delegation_result messages
  - [ ] assistant message (final answer)
- [ ] Graders pass with orchestrator-executor (no "no_screenshots" error)
- [ ] metadata.json has accurate `total_steps` count
- [ ] Error/warning capture works for both patterns

---

## Future Considerations

1. **New Agent Patterns:** Any new agent type just needs to:
   - Accept hooks in constructor or via setter
   - Fire hooks at appropriate points
   - Use shared capture infrastructure

2. **Grader Updates:** May need to update graders to understand delegation messages

3. **Parallel Executors:** If orchestrator delegates to multiple executors in parallel, need to handle concurrent screenshot capture

4. **Memory/Performance:** Screenshot capture creates MCP connection per capture - consider connection pooling for high-volume evals
