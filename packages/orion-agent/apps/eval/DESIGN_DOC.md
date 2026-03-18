# Eval System - Production Grade Design Doc

## Current State Analysis

### What's Working Well
1. **Zod validation** - Already exists in `config-validator.ts`, reuses `LLMConfigSchema` from `@orion/shared`
2. **Grader registry pattern** - `createGrader()` factory works well, easy to add new graders
3. **AgentEvaluator interface** - Clean interface: `execute() → AgentResult`
4. **Discriminated unions** - Messages, agent types use proper TypeScript patterns
5. **Capture utilities** - `ScreenshotCapture`, `MessageLogger`, `TrajectorySaver` are modular

### Key Problems

**1. No Agent Registry/Factory**
Agent creation is hardcoded if-else in `task-executor.ts`:
```typescript
// Current approach - not scalable
if (this.config.agent.type === 'single') {
  const evaluator = new SingleAgentEvaluator(...)
} else if (this.config.agent.type === 'orchestrator-executor') {
  const evaluator = new OrchestratorExecutorEvaluator(...)
}
// Adding new agent = modify this file
```

**2. Heavy Server Dependency**
Imports from `@orion/server`:
- `GeminiAgent` - Core agent (necessary)
- `ToolExecutionHooks` - Hook interface
- `ResolvedAgentConfig` - Agent config type
- `AgentExecutionError` - Error type
- `VercelAIContentGenerator` - Provider adapter
- Gateway client functions

**3. Scattered Types**
- `src/types.ts` - Main types
- `agents/types.ts` - Agent interface
- `agents/orchestrator-executor/types.ts` - Orchestrator types
- `runner/types.ts` - Runner types
- `graders/types.ts` - Grader types

**4. Duplicated Capture Logic**
Both agent evaluators duplicate:
- Initialize ScreenshotCapture
- Initialize MessageLogger
- Set up tool hooks
- Handle timeouts
- Collect errors/warnings

**5. No Unified Utils**
Hooks, screenshot capture, message logging code is copy-pasted per agent type.

---

## Design Goals

1. **Easy to add new agents** - Register new agent type, implement interface, done
2. **Shared capture infrastructure** - All agents use same screenshot/logging utils
3. **Type-safe with Zod** - Config validation at entry point
4. **Minimal server coupling** - Only import what's necessary
5. **Clear folder structure** - Types where they belong
6. **Production patterns** - Factory, registry, composition

---

## Proposed Architecture

### Folder Structure

```
eval/src/
├── index.ts                      # Entry point, CLI
├── types/
│   ├── index.ts                  # Re-exports all types
│   ├── config.ts                 # EvalConfig, AgentConfig (Zod schemas + types)
│   ├── task.ts                   # Task, TaskMetadata
│   ├── message.ts                # Message discriminated union
│   ├── result.ts                 # AgentResult, GraderResult
│   └── errors.ts                 # ErrorSource, TaskError, EvalWarning
│
├── agents/
│   ├── index.ts                  # Re-exports + auto-registration
│   ├── registry.ts               # Agent registry + factory
│   ├── types.ts                  # AgentEvaluator interface, AgentContext
│   ├── single/
│   │   └── index.ts              # SingleAgentEvaluator
│   └── orchestrator-executor/
│       ├── index.ts              # OrchestratorExecutorEvaluator
│       ├── types.ts              # Orchestrator-specific types only
│       ├── orchestrator.ts
│       ├── orchestrator-agent.ts
│       ├── orchestrator-tools.ts
│       ├── executor.ts
│       └── executor-store.ts
│
├── capture/
│   ├── index.ts                  # Re-exports
│   ├── types.ts                  # CaptureContext interface
│   ├── context.ts                # CaptureContext class (bundles all capture)
│   ├── hooks.ts                  # createCaptureHooks() utility
│   ├── screenshot.ts             # ScreenshotCapture
│   ├── message-logger.ts         # MessageLogger
│   ├── trajectory-saver.ts       # TrajectorySaver
│   └── window-manager.ts         # WindowManager
│
├── graders/
│   ├── index.ts                  # Re-exports
│   ├── registry.ts               # Grader registry (existing pattern)
│   ├── types.ts                  # Grader interface
│   ├── benchmark/
│   │   ├── webvoyager.ts
│   │   └── mind2web.ts
│   └── fara/
│       ├── alignment.ts
│       ├── rubric.ts
│       ├── multimodal.ts
│       └── combined.ts
│
├── runner/
│   ├── index.ts                  # runEval() main entry
│   ├── types.ts                  # RunEvalOptions, TaskResult, BatchSummary
│   ├── task-loader.ts
│   ├── task-executor.ts
│   └── parallel-executor.ts
│
└── utils/
    ├── env.ts                    # resolveEnvValue() helper
    └── validation.ts             # Config validation logic
```

---

## Key Components

### 1. Type System (`types/`)

**`types/config.ts`** - Zod schemas + inferred types:
```typescript
import { LLMConfigSchema, LLMProviderSchema } from '@orion/shared/schemas/llm'
import { z } from 'zod'

// Single agent config
export const SingleAgentConfigSchema = LLMConfigSchema.extend({
  type: z.literal('single'),
})
export type SingleAgentConfig = z.infer<typeof SingleAgentConfigSchema>

// Orchestrator-executor config
export const OrchestratorExecutorConfigSchema = z.object({
  type: z.literal('orchestrator-executor'),
  orchestrator: LLMConfigSchema.extend({
    maxTurns: z.number().int().min(1).optional(),
  }),
  executor: LLMConfigSchema.extend({
    maxStepsPerDelegation: z.number().int().min(1).optional(),
  }),
})
export type OrchestratorExecutorConfig = z.infer<typeof OrchestratorExecutorConfigSchema>

// Discriminated union
export const AgentConfigSchema = z.discriminatedUnion('type', [
  SingleAgentConfigSchema,
  OrchestratorExecutorConfigSchema,
])
export type AgentConfig = z.infer<typeof AgentConfigSchema>

// Full eval config
export const EvalConfigSchema = z.object({
  agent: AgentConfigSchema,
  dataset: z.string().min(1),
  output_dir: z.string().optional(),
  num_workers: z.number().int().min(1).max(20).default(1),
  orion: z.object({
    server_url: z.string().url(),
  }),
  grader_model: z.string().optional(),
  grader_api_key_env: z.string().optional(),
  grader_base_url: z.string().url().optional(),
  timeout_ms: z.number().int().min(30000).max(3600000).optional(),
})
export type EvalConfig = z.infer<typeof EvalConfigSchema>
```

**`types/message.ts`** - Message types:
```typescript
import { z } from 'zod'

const BaseMessageSchema = z.object({
  timestamp: z.string().datetime(),
})

export const UserMessageSchema = BaseMessageSchema.extend({
  type: z.literal('user'),
  content: z.string(),
})

export const AssistantMessageSchema = BaseMessageSchema.extend({
  type: z.literal('assistant'),
  content: z.string(),
})

export const ToolCallMessageSchema = BaseMessageSchema.extend({
  type: z.literal('tool_call'),
  tool: z.string(),
  toolCallId: z.string(),
  params: z.record(z.unknown()),
})

export const ToolResultMessageSchema = BaseMessageSchema.extend({
  type: z.literal('tool_result'),
  toolCallId: z.string(),
  result: z.unknown(),
  isError: z.boolean(),
  screenshot: z.number().optional(),
})

export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal('error'),
  content: z.string(),
  errorCode: z.string().optional(),
})

// Orchestrator-specific messages
export const DelegationMessageSchema = BaseMessageSchema.extend({
  type: z.literal('delegation'),
  instruction: z.string(),
  executorId: z.string(),
  maxSteps: z.number().optional(),
})

export const DelegationResultMessageSchema = BaseMessageSchema.extend({
  type: z.literal('delegation_result'),
  executorId: z.string(),
  summary: z.string(),
  status: z.enum(['done', 'blocked', 'max_steps']),
  stepsUsed: z.number(),
  currentUrl: z.string().optional(),
})

export const MessageSchema = z.discriminatedUnion('type', [
  UserMessageSchema,
  AssistantMessageSchema,
  ToolCallMessageSchema,
  ToolResultMessageSchema,
  ErrorMessageSchema,
  DelegationMessageSchema,
  DelegationResultMessageSchema,
])

export type Message = z.infer<typeof MessageSchema>
export type UserMessage = z.infer<typeof UserMessageSchema>
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>
export type ToolCallMessage = z.infer<typeof ToolCallMessageSchema>
export type ToolResultMessage = z.infer<typeof ToolResultMessageSchema>
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>
export type DelegationMessage = z.infer<typeof DelegationMessageSchema>
export type DelegationResultMessage = z.infer<typeof DelegationResultMessageSchema>

// Type guards
export const isToolCallMessage = (m: Message): m is ToolCallMessage => m.type === 'tool_call'
export const isDelegationMessage = (m: Message): m is DelegationMessage => m.type === 'delegation'
// ... etc
```

---

### 2. Agent Registry (`agents/registry.ts`)

```typescript
import type { AgentContext, AgentEvaluator } from './types'

type AgentFactory = (context: AgentContext) => AgentEvaluator

const registry = new Map<string, AgentFactory>()

/**
 * Register an agent type
 */
export function registerAgent(type: string, factory: AgentFactory): void {
  if (registry.has(type)) {
    throw new Error(`Agent type "${type}" already registered`)
  }
  registry.set(type, factory)
}

/**
 * Create agent evaluator from context
 */
export function createAgent(context: AgentContext): AgentEvaluator {
  const factory = registry.get(context.config.agent.type)
  if (!factory) {
    const available = Array.from(registry.keys()).join(', ')
    throw new Error(
      `Unknown agent type: "${context.config.agent.type}". Available: ${available}`
    )
  }
  return factory(context)
}

/**
 * Get all registered agent types
 */
export function getRegisteredAgentTypes(): string[] {
  return Array.from(registry.keys())
}
```

**`agents/index.ts`** - Auto-registration:
```typescript
import { registerAgent } from './registry'
import { SingleAgentEvaluator } from './single'
import { OrchestratorExecutorEvaluator } from './orchestrator-executor'

// Auto-register built-in agents
registerAgent('single', (ctx) => new SingleAgentEvaluator(ctx))
registerAgent('orchestrator-executor', (ctx) => new OrchestratorExecutorEvaluator(ctx))

// Re-exports
export { createAgent, registerAgent, getRegisteredAgentTypes } from './registry'
export type { AgentContext, AgentEvaluator, AgentResult } from './types'
```

---

### 3. Agent Context (`agents/types.ts`)

```typescript
import type { CaptureContext } from '../capture/types'
import type { EvalConfig, Task, TaskMetadata, Message } from '../types'

/**
 * All dependencies an agent needs - passed to factory
 */
export interface AgentContext {
  // Config
  config: EvalConfig
  task: Task

  // Browser window
  windowId: number
  tabId: number

  // Output
  outputDir: string      // Root output dir
  taskOutputDir: string  // Task-specific: outputDir/query_id/

  // Capture infrastructure (pre-initialized)
  capture: CaptureContext
}

/**
 * Result returned by agent execution
 */
export interface AgentResult {
  metadata: TaskMetadata
  messages: Message[]
  finalAnswer: string | null
}

/**
 * Interface all agent evaluators must implement
 */
export interface AgentEvaluator {
  /**
   * Execute the agent on the task
   */
  execute(): Promise<AgentResult>
}
```

---

### 4. Capture Context (`capture/context.ts`)

Bundle all capture utilities:
```typescript
import { randomUUID } from 'node:crypto'
import type { ToolExecutionHooks, ToolExecutionResult } from '@orion/server/agent'
import type { Message, TaskError, EvalWarning, ErrorSource } from '../types'
import { MessageLogger } from './message-logger'
import { ScreenshotCapture } from './screenshot'
import { TrajectorySaver } from './trajectory-saver'

export interface CaptureContextConfig {
  serverUrl: string
  outputDir: string
  taskId: string
  tabId: number
  windowId: number
}

/**
 * Unified capture context - bundles screenshot, message logging, errors/warnings
 */
export class CaptureContext {
  readonly screenshot: ScreenshotCapture
  readonly messageLogger: MessageLogger
  readonly trajectorySaver: TrajectorySaver

  private errors: TaskError[] = []
  private warnings: EvalWarning[] = []
  private currentToolCallId: string | null = null

  private readonly tabId: number
  private readonly windowId: number

  constructor(private config: CaptureContextConfig) {
    this.tabId = config.tabId
    this.windowId = config.windowId
    this.trajectorySaver = new TrajectorySaver(config.outputDir, config.taskId)
  }

  /**
   * Initialize - must be called before use
   */
  async init(): Promise<string> {
    const taskOutputDir = await this.trajectorySaver.init()

    this.screenshot = new ScreenshotCapture(this.config.serverUrl, taskOutputDir)
    await this.screenshot.init()

    this.messageLogger = new MessageLogger(taskOutputDir)

    return taskOutputDir
  }

  /**
   * Create tool execution hooks for GeminiAgent
   */
  createToolHooks(): ToolExecutionHooks {
    return {
      onBeforeToolCall: async (toolName: string, args: unknown) => {
        try {
          this.currentToolCallId = randomUUID()
          await this.messageLogger.logToolCall(
            toolName,
            this.currentToolCallId,
            args as Record<string, unknown>
          )
        } catch (err) {
          this.addWarning('message_logging', `Failed to log tool call ${toolName}: ${err}`)
        }
      },

      onAfterToolCall: async (toolName: string, result: ToolExecutionResult) => {
        let screenshotNum = 0

        // Capture screenshot
        try {
          screenshotNum = await this.screenshot.capture(this.tabId, this.windowId)
        } catch (err) {
          this.addWarning('screenshot', `Screenshot after ${toolName} failed: ${err}`)
          screenshotNum = this.screenshot.getCount()
        }

        // Log tool errors
        if (result.isError) {
          this.addWarning('mcp_tool', `Tool ${toolName} error: ${result.errorMessage}`)
        }

        // Log result
        if (this.currentToolCallId) {
          try {
            await this.messageLogger.logToolResult(
              this.currentToolCallId,
              result.isError ? { error: result.errorMessage } : result.parts,
              result.isError,
              screenshotNum
            )
          } catch (err) {
            this.addWarning('message_logging', `Failed to log tool result: ${err}`)
          }
        }

        this.currentToolCallId = null
      },
    }
  }

  // Error/warning collection
  addError(source: ErrorSource, message: string, details?: Record<string, unknown>): void {
    this.errors.push({ source, message, timestamp: new Date().toISOString(), details })
  }

  addWarning(source: ErrorSource, message: string): void {
    this.warnings.push({ source, message, timestamp: new Date().toISOString() })
    console.warn(`[${source}] ${message}`)
  }

  getErrors(): TaskError[] { return [...this.errors] }
  getWarnings(): EvalWarning[] { return [...this.warnings] }
  getMessages(): Message[] { return this.messageLogger.getMessages() }
  getScreenshotCount(): number { return this.screenshot.getCount() }
  getLastAssistantMessage(): string | null { return this.messageLogger.getLastAssistantMessage() }

  // Delegation logging (for orchestrator-executor)
  async logDelegation(instruction: string, executorId: string, maxSteps?: number): Promise<void> {
    await this.messageLogger.logDelegation(instruction, executorId, maxSteps)
  }

  async logDelegationResult(
    executorId: string,
    summary: string,
    status: 'done' | 'blocked' | 'max_steps',
    stepsUsed: number,
    currentUrl?: string
  ): Promise<void> {
    await this.messageLogger.logDelegationResult(executorId, summary, status, stepsUsed, currentUrl)
  }
}
```

---

### 5. Single Agent Evaluator (`agents/single/index.ts`)

Clean implementation using context:
```typescript
import { randomUUID } from 'node:crypto'
import { GeminiAgent } from '@orion/server/agent'
import { AgentExecutionError } from '@orion/server/agent/errors'
import type { ResolvedAgentConfig } from '@orion/server/agent/types'
import { MCPServerConfig } from '@google/gemini-cli-core'
import type { AgentContext, AgentEvaluator, AgentResult } from '../types'
import type { SingleAgentConfig, TaskMetadata } from '../../types'
import { resolveEnvValue } from '../../utils/env'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export class SingleAgentEvaluator implements AgentEvaluator {
  constructor(private ctx: AgentContext) {}

  async execute(): Promise<AgentResult> {
    const startTime = Date.now()
    const { config, task, capture } = this.ctx
    const agentConfig = config.agent as SingleAgentConfig
    const timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS

    // Log initial user message
    await capture.messageLogger.logUser(task.query)

    // Set up timeout
    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs)

    // Create agent
    const resolvedConfig: ResolvedAgentConfig = {
      conversationId: randomUUID(),
      provider: agentConfig.provider,
      model: agentConfig.model ?? 'gemini-2.0-flash',
      apiKey: resolveEnvValue(agentConfig.apiKey),
      baseUrl: agentConfig.baseUrl,
      sessionExecutionDir: '/tmp/orion-eval',
      evalMode: true,
    }

    const mcpServers = {
      'orion-mcp': new MCPServerConfig(
        undefined, undefined, undefined, undefined, undefined,
        `${config.orion.server_url}/mcp`,
        { Accept: 'application/json, text/event-stream', 'X-Orion-Source': 'eval' },
        undefined, undefined, true
      ),
    }

    const agent = await GeminiAgent.create(resolvedConfig, mcpServers)

    // Set capture hooks
    agent.setToolHooks(capture.createToolHooks())

    // Create mock stream to capture assistant messages
    let lastAssistantMessage = ''
    const mockStream = {
      write: async (data: string) => {
        if (data.includes('"type":"text-delta"')) {
          const match = data.match(/"delta":"((?:[^"\\]|\\.)*)"/)
          if (match) lastAssistantMessage += JSON.parse(`"${match[1]}"`)
        } else if (data.includes('"type":"finish"')) {
          if (lastAssistantMessage) {
            await capture.messageLogger.logAssistant(lastAssistantMessage)
            lastAssistantMessage = ''
          }
        }
      },
    }

    // Execute
    let terminationReason: TaskMetadata['termination_reason'] = 'completed'

    try {
      await agent.execute(
        task.query,
        mockStream as Parameters<typeof agent.execute>[1],
        abortController.signal,
        { windowId: this.ctx.windowId, activeTab: { id: this.ctx.tabId, url: task.start_url } }
      )
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      if (abortController.signal.aborted) {
        terminationReason = 'timeout'
        capture.addError('agent_execution', `Task timed out after ${timeoutMs / 1000}s`)
      } else {
        terminationReason = 'error'
        const msg = err instanceof AgentExecutionError && err.originalError
          ? `${error.message}: ${err.originalError.message}`
          : error.message
        capture.addError('agent_execution', msg, { stack: error.stack })
      }
      await capture.messageLogger.logError(error.message)
    } finally {
      clearTimeout(timeoutHandle)
    }

    // Build metadata
    const metadata: TaskMetadata = {
      query_id: task.query_id,
      dataset: task.dataset,
      query: task.query,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      total_duration_ms: Date.now() - startTime,
      total_steps: capture.getScreenshotCount(),
      termination_reason: terminationReason,
      final_answer: capture.getLastAssistantMessage(),
      errors: capture.getErrors(),
      warnings: capture.getWarnings(),
      agent_config: { type: 'single', model: resolvedConfig.model },
      grader_results: {},
    }

    await capture.trajectorySaver.saveMetadata(metadata)

    return {
      metadata,
      messages: capture.getMessages(),
      finalAnswer: metadata.final_answer,
    }
  }
}
```

---

### 6. Task Executor (`runner/task-executor.ts`)

Uses agent registry:
```typescript
import { createAgent } from '../agents'
import type { AgentContext } from '../agents/types'
import { CaptureContext } from '../capture/context'
import type { EvalConfig, Task } from '../types'
import type { WindowManager } from '../capture/window-manager'

export class TaskExecutor {
  constructor(
    private config: EvalConfig,
    private outputDir: string,
    private windowManager: WindowManager,
    private graderOptions: GraderOptions | null,
  ) {}

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()
    let window: { windowId: number; tabId: number } | null = null

    try {
      // Create window
      window = await this.windowManager.createWindow(task.query_id, task.start_url)

      // Initialize capture context
      const capture = new CaptureContext({
        serverUrl: this.config.orion.server_url,
        outputDir: this.outputDir,
        taskId: task.query_id,
        tabId: window.tabId,
        windowId: window.windowId,
      })
      const taskOutputDir = await capture.init()

      // Build agent context
      const context: AgentContext = {
        config: this.config,
        task,
        windowId: window.windowId,
        tabId: window.tabId,
        outputDir: this.outputDir,
        taskOutputDir,
        capture,
      }

      // Create and execute agent (via registry)
      const agent = createAgent(context)
      const agentResult = await agent.execute()

      // Run graders
      const graderResults = await this.runGraders(task, agentResult)

      return {
        status: agentResult.metadata.termination_reason === 'timeout' ? 'timeout' : 'completed',
        task,
        agentResult,
        graderResults,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        status: 'failed',
        task,
        error: error instanceof Error ? error : new Error(String(error)),
        errorSource: 'unknown',
        durationMs: Date.now() - startTime,
      }
    } finally {
      if (window) {
        await this.windowManager.closeWindow(task.query_id)
      }
    }
  }
}
```

---

## Server Dependencies

### What We MUST Import from Server

These are necessary - `GeminiAgent` IS the agent:
```typescript
// Core agent
import { GeminiAgent, type ToolExecutionHooks, type ToolExecutionResult } from '@orion/server/agent'
import { AgentExecutionError } from '@orion/server/agent/errors'
import type { ResolvedAgentConfig } from '@orion/server/agent/types'

// Provider adapter (for orchestrator-agent)
import { VercelAIContentGenerator } from '@orion/server/agent/provider-adapter'

// Gateway client (for orion provider only)
import { fetchOrionConfig, getLLMConfigFromProvider } from '@orion/server/lib/clients/gateway'
```

### What Could Move to Shared (Future)

If we want to decouple more:
```typescript
// These types could be in @orion/shared
export interface ToolExecutionHooks { ... }
export interface ToolExecutionResult { ... }
export interface ResolvedAgentConfig { ... }
```

But for now, importing from server is fine - eval is tightly coupled to server anyway.

---

## Import Guidelines

```typescript
// Shared package - schemas, constants
import { LLMConfigSchema, LLMProviderSchema, LLM_PROVIDERS } from '@orion/shared/schemas/llm'
import { TIMEOUTS } from '@orion/shared/constants/timeouts'
import { AGENT_LIMITS } from '@orion/shared/constants/limits'
import type { BrowserContext } from '@orion/shared/schemas/browser-context'

// Server - only agent-related imports
import { GeminiAgent, type ToolExecutionHooks } from '@orion/server/agent'
import type { ResolvedAgentConfig } from '@orion/server/agent/types'

// Internal eval types - from types/ folder
import type { EvalConfig, Task, Message, AgentResult } from '../types'
import type { AgentContext, AgentEvaluator } from '../agents/types'
```

---

## Adding a New Agent Type

1. Create folder: `agents/my-new-agent/`
2. Implement `AgentEvaluator` interface:

```typescript
// agents/my-new-agent/index.ts
import type { AgentContext, AgentEvaluator, AgentResult } from '../types'

export class MyNewAgentEvaluator implements AgentEvaluator {
  constructor(private ctx: AgentContext) {}

  async execute(): Promise<AgentResult> {
    const { config, task, capture } = this.ctx

    // Use capture.createToolHooks() for screenshot/logging
    // Use capture.messageLogger for messages
    // Use capture.addError/addWarning for errors

    // Return AgentResult
  }
}
```

3. Register in `agents/index.ts`:

```typescript
import { MyNewAgentEvaluator } from './my-new-agent'

registerAgent('my-new-agent', (ctx) => new MyNewAgentEvaluator(ctx))
```

4. Add config schema in `types/config.ts`:

```typescript
export const MyNewAgentConfigSchema = z.object({
  type: z.literal('my-new-agent'),
  // ... specific fields
})

export const AgentConfigSchema = z.discriminatedUnion('type', [
  SingleAgentConfigSchema,
  OrchestratorExecutorConfigSchema,
  MyNewAgentConfigSchema,  // Add here
])
```

Done - no changes to runner code needed.

---

## Implementation Order

1. **Phase 1: Types** (~1 hour)
   - Create `types/` folder with proper structure
   - Move/consolidate all types
   - Add Zod schemas for messages

2. **Phase 2: Capture Context** (~1 hour)
   - Create `CaptureContext` class
   - Add delegation message methods
   - Create `createToolHooks()` utility

3. **Phase 3: Agent Registry** (~30 min)
   - Create `registry.ts`
   - Create `AgentContext` interface
   - Update exports

4. **Phase 4: Refactor Single Agent** (~1 hour)
   - Use `AgentContext`
   - Use `CaptureContext`
   - Clean up code

5. **Phase 5: Refactor Orchestrator-Executor** (~2 hours)
   - Use `AgentContext`
   - Integrate `CaptureContext`
   - Wire up hooks properly

6. **Phase 6: Update Runner** (~30 min)
   - Use `createAgent()` instead of if-else
   - Initialize `CaptureContext` in executor

7. **Phase 7: Testing** (~1 hour)
   - Run single-agent eval
   - Run orchestrator-executor eval
   - Verify screenshots/messages captured

---

## Summary

| Before | After |
|--------|-------|
| If-else agent creation | Registry + factory pattern |
| Duplicated capture code | Shared `CaptureContext` |
| Scattered types | Organized `types/` folder |
| Copy-paste hooks | `createToolHooks()` utility |
| Tight coupling | Clear interfaces |
| Hard to add agents | Register + implement |
