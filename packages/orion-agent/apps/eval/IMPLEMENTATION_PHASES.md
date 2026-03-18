# Implementation Phases - Parallel Execution Plan

## Dependency Graph

```
Phase 1: Types (4 parallel subagents)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  │
Phase 2: Capture    Phase 3: Agent       │
(2 parallel)        Registry             │
    │               (1 subagent)         │
    │                  │                  │
    └────────┬─────────┘                  │
             ▼                            │
Phase 4: Agent Refactors                  │
(2 parallel - after 2+3)                  │
             │                            │
             ▼                            │
Phase 5: Runner Update                    │
(1 subagent - after 4)                    │
             │                            │
             ▼                            │
Phase 6: Cleanup & Test ◄─────────────────┘
(1 subagent)
```

---

## Phase 1: Types (4 Parallel Subagents)

No dependencies - can all run simultaneously.

### Subagent 1A: Config Types
```
Create /apps/eval/src/types/config.ts

Requirements:
1. Import LLMConfigSchema, LLMProviderSchema from @orion/shared/schemas/llm
2. Import z from zod

Create Zod schemas:
- SingleAgentConfigSchema = LLMConfigSchema.extend({ type: z.literal('single') })
- OrchestratorExecutorConfigSchema with orchestrator + executor nested configs
- AgentConfigSchema = z.discriminatedUnion('type', [...])
- EvalConfigSchema with all fields (agent, dataset, output_dir, num_workers, orion, grader_*, timeout_ms)

Export both schemas and inferred types (z.infer<>)

Reference: Current implementation in /apps/eval/src/utils/config-validator.ts (lines 1-42)
```

### Subagent 1B: Message Types
```
Create /apps/eval/src/types/message.ts

Requirements:
1. Use Zod for all schemas
2. Create BaseMessageSchema with timestamp field

Create schemas for:
- UserMessageSchema (type: 'user', content)
- AssistantMessageSchema (type: 'assistant', content)
- ToolCallMessageSchema (type: 'tool_call', tool, toolCallId, params)
- ToolResultMessageSchema (type: 'tool_result', toolCallId, result, isError, screenshot?)
- ErrorMessageSchema (type: 'error', content, errorCode?)
- DelegationMessageSchema (type: 'delegation', instruction, executorId, maxSteps?)
- DelegationResultMessageSchema (type: 'delegation_result', executorId, summary, status, stepsUsed, currentUrl?)

Create MessageSchema = z.discriminatedUnion('type', [...all schemas])

Export schemas, types, and type guards (isToolCallMessage, isDelegationMessage, etc.)

Reference: Current types in /apps/eval/src/types.ts (lines 62-127)
```

### Subagent 1C: Task & Result Types
```
Create /apps/eval/src/types/task.ts

Requirements:
1. Use Zod schemas with inferred types

Create:
- TaskMetadataSchema (original_task_id, website?, category?, additional?)
- TaskSchema (query_id, dataset, query, graders[], start_url?, setup_script?, metadata)

Export schemas and types.

---

Create /apps/eval/src/types/result.ts

Create:
- GraderResultSchema (score, pass, reasoning, details?)
- TaskMetadataSchema (query_id, dataset, query, started_at, completed_at, total_duration_ms, total_steps, termination_reason, final_answer, errors, warnings, agent_config, grader_results)
- AgentResultSchema (metadata, messages, finalAnswer)

Export schemas and types.

Reference: Current types in /apps/eval/src/types.ts (lines 6-20, 156-182)
```

### Subagent 1D: Error Types + Index
```
Create /apps/eval/src/types/errors.ts

Create:
- ErrorSourceSchema = z.enum(['window_creation', 'agent_execution', 'mcp_tool', 'screenshot', 'grader', 'message_logging', 'cleanup', 'unknown'])
- TaskErrorSchema (source, message, timestamp, details?)
- EvalWarningSchema (source, message, timestamp)

Export schemas and types.

---

Create /apps/eval/src/types/index.ts

Re-export everything from:
- ./config
- ./message
- ./task
- ./result
- ./errors

This becomes the single import point: import { EvalConfig, Message, Task } from '../types'

Reference: Current types in /apps/eval/src/types.ts (lines 129-154)
```

---

## Phase 2: Capture Infrastructure (2 Parallel Subagents)

**Depends on:** Phase 1 (types)

### Subagent 2A: CaptureContext Class
```
Create /apps/eval/src/capture/types.ts

Define interface:
- CaptureContextConfig { serverUrl, outputDir, taskId, tabId, windowId }

---

Create /apps/eval/src/capture/context.ts

Requirements:
1. Import ToolExecutionHooks, ToolExecutionResult from @orion/server/agent
2. Import types from ../types
3. Import existing ScreenshotCapture, MessageLogger, TrajectorySaver

Implement CaptureContext class:
- Constructor takes CaptureContextConfig
- async init() - initializes screenshot, messageLogger, trajectorySaver, returns taskOutputDir
- createToolHooks(): ToolExecutionHooks - returns hooks for GeminiAgent
- addError(source, message, details?)
- addWarning(source, message)
- getErrors(), getWarnings(), getMessages(), getScreenshotCount(), getLastAssistantMessage()
- logDelegation(instruction, executorId, maxSteps?)
- logDelegationResult(executorId, summary, status, stepsUsed, currentUrl?)

Reference implementation details in DESIGN_DOC.md section "4. Capture Context"

Update /apps/eval/src/capture/index.ts to export CaptureContext
```

### Subagent 2B: MessageLogger Extensions
```
Update /apps/eval/src/capture/message-logger.ts

Add two new methods:

1. logDelegation(instruction: string, executorId: string, maxSteps?: number): Promise<void>
   - Creates DelegationMessage with type: 'delegation'
   - Appends to messages

2. logDelegationResult(executorId: string, summary: string, status: 'done' | 'blocked' | 'max_steps', stepsUsed: number, currentUrl?: string): Promise<void>
   - Creates DelegationResultMessage with type: 'delegation_result'
   - Appends to messages

Import DelegationMessage, DelegationResultMessage from ../types

Reference: Current MessageLogger in /apps/eval/src/capture/message-logger.ts
```

---

## Phase 3: Agent Registry (1 Subagent)

**Depends on:** Phase 1 (types)
**Can run parallel with:** Phase 2

### Subagent 3A: Agent Registry + Types
```
Create /apps/eval/src/agents/types.ts

Define:
- AgentContext interface:
  {
    config: EvalConfig
    task: Task
    windowId: number
    tabId: number
    outputDir: string
    taskOutputDir: string
    capture: CaptureContext
  }

- AgentResult interface (re-export from ../types or define here)
- AgentEvaluator interface { execute(): Promise<AgentResult> }

---

Create /apps/eval/src/agents/registry.ts

Implement:
- type AgentFactory = (context: AgentContext) => AgentEvaluator
- const registry = new Map<string, AgentFactory>()
- registerAgent(type: string, factory: AgentFactory): void
- createAgent(context: AgentContext): AgentEvaluator
- getRegisteredAgentTypes(): string[]

Reference: DESIGN_DOC.md section "2. Agent Registry"

---

Update /apps/eval/src/agents/index.ts

- Import registerAgent from ./registry
- Import SingleAgentEvaluator (will be updated later)
- Import OrchestratorExecutorEvaluator (will be updated later)
- Call registerAgent for both
- Re-export createAgent, registerAgent, getRegisteredAgentTypes
- Re-export types

Note: Registration calls will fail initially until agents are refactored.
That's OK - add TODO comments for now.
```

---

## Phase 4: Agent Refactors (2 Parallel Subagents)

**Depends on:** Phase 2 + Phase 3

### Subagent 4A: Single Agent Refactor
```
Refactor /apps/eval/src/agents/single-agent.ts

Changes:
1. Change constructor to accept AgentContext instead of individual params:
   constructor(private ctx: AgentContext) {}

2. Use ctx.capture instead of creating ScreenshotCapture/MessageLogger:
   - Remove local ScreenshotCapture initialization
   - Remove local MessageLogger initialization
   - Remove local hooks setup
   - Use ctx.capture.createToolHooks() for GeminiAgent hooks
   - Use ctx.capture.messageLogger.logUser/logAssistant
   - Use ctx.capture.addError/addWarning
   - Use ctx.capture.getMessages(), getScreenshotCount(), etc.

3. Build metadata using capture methods

4. Remove TrajectorySaver init (done in CaptureContext)

5. Keep the core agent execution logic (GeminiAgent.create, agent.execute)

Reference:
- Current implementation: /apps/eval/src/agents/single-agent.ts
- Target implementation: DESIGN_DOC.md section "5. Single Agent Evaluator"
```

### Subagent 4B: Orchestrator-Executor Refactor
```
Refactor /apps/eval/src/agents/orchestrator-executor/index.ts

Changes:
1. Change OrchestratorExecutorEvaluator constructor to accept AgentContext:
   constructor(private ctx: AgentContext) {}

2. Initialize capture from context (already done in runner)

3. Add hook integration:
   - Create executor hooks that use ctx.capture.createToolHooks()
   - Wire hooks through Orchestrator → ExecutorStore → Executor
   - Call ctx.capture.logDelegation() when orchestrator delegates
   - Call ctx.capture.logDelegationResult() when executor returns

4. Update return to include messages:
   return {
     metadata,
     messages: ctx.capture.getMessages(),  // Now populated!
     finalAnswer,
   }

Also update supporting files if needed:
- orchestrator.ts - add setExecutorHooks() method
- executor.ts - accept external hooks via setObservationHooks()
- executor-store.ts - pass hooks to new executors

Reference:
- Current: /apps/eval/src/agents/orchestrator-executor/index.ts
- Target: DESIGN_DOC.md and previous IMPLEMENTATION_PLAN.md
```

---

## Phase 5: Runner Update (1 Subagent)

**Depends on:** Phase 4

### Subagent 5A: Task Executor Update
```
Update /apps/eval/src/runner/task-executor.ts

Changes:
1. Import createAgent from ../agents instead of individual evaluators
2. Import CaptureContext from ../capture

3. In execute() method:
   - Create CaptureContext and call init()
   - Build AgentContext with all required fields
   - Use createAgent(context) instead of if-else switch
   - Remove the if (config.agent.type === 'single') / else if blocks

4. Remove direct imports of SingleAgentEvaluator, OrchestratorExecutorEvaluator

Before:
```typescript
if (this.config.agent.type === 'single') {
  const evaluator = new SingleAgentEvaluator(this.config, task, window.windowId, ...)
} else if (this.config.agent.type === 'orchestrator-executor') {
  const evaluator = new OrchestratorExecutorEvaluator(this.config, task, ...)
}
```

After:
```typescript
const capture = new CaptureContext({ serverUrl, outputDir, taskId, tabId, windowId })
const taskOutputDir = await capture.init()

const context: AgentContext = {
  config: this.config,
  task,
  windowId: window.windowId,
  tabId: window.tabId,
  outputDir: this.outputDir,
  taskOutputDir,
  capture,
}

const agent = createAgent(context)
const agentResult = await agent.execute()
```

Reference:
- Current: /apps/eval/src/runner/task-executor.ts (lines 143-186)
- Target: DESIGN_DOC.md section "6. Task Executor"
```

---

## Phase 6: Cleanup & Test (1 Subagent)

**Depends on:** Phase 5

### Subagent 6A: Cleanup Old Files + Verify
```
Tasks:
1. Delete old /apps/eval/src/types.ts (replaced by types/ folder)

2. Update all imports across the codebase:
   - Change: import { EvalConfig, Task, Message } from '../types'
   - Keep same (types/index.ts re-exports everything)

3. Update /apps/eval/src/utils/config-validator.ts:
   - Import schemas from ../types/config instead of defining locally
   - Remove duplicate schema definitions

4. Verify no TypeScript errors:
   - Run: cd apps/eval && bun run typecheck

5. Test single-agent eval:
   - Run: cd apps/eval && bun run eval -c configs/webvoyager-test.json
   - Verify screenshots captured
   - Verify messages.jsonl populated

6. Test orchestrator-executor eval:
   - Run: cd apps/eval && bun run eval -c configs/orchestrator-executor-test.json
   - Verify screenshots captured
   - Verify messages.jsonl has delegation messages
   - Verify graders pass (no "no_screenshots" error)

Report any issues found.
```

---

## Execution Summary

| Phase | Subagents | Can Parallelize? | Dependencies |
|-------|-----------|------------------|--------------|
| 1 | 4 (1A, 1B, 1C, 1D) | Yes - all parallel | None |
| 2 | 2 (2A, 2B) | Yes - both parallel | Phase 1 |
| 3 | 1 (3A) | Yes - parallel with Phase 2 | Phase 1 |
| 4 | 2 (4A, 4B) | Yes - both parallel | Phase 2 + 3 |
| 5 | 1 (5A) | No | Phase 4 |
| 6 | 1 (6A) | No | Phase 5 |

**Total: 11 subagent tasks**

**Parallel execution timeline:**
```
Time →
─────────────────────────────────────────────────────────────────
Phase 1: [1A] [1B] [1C] [1D]     (4 parallel)
         ─────────────────
Phase 2:                   [2A] [2B]   (2 parallel)
Phase 3:                   [3A]        (parallel with Phase 2)
                           ───────────
Phase 4:                              [4A] [4B]  (2 parallel)
                                      ──────────
Phase 5:                                        [5A]
                                                ────
Phase 6:                                            [6A]
                                                    ────
```

**Maximum parallelism: 4 subagents** (Phase 1)
