import { GeminiComputerUseEvaluator } from './gemini-computer-use'
import { OrchestratorExecutorEvaluator } from './orchestrator-executor'
import { registerAgent } from './registry'
import { SingleAgentEvaluator } from './single-agent'
import { YutoriNavigatorEvaluator } from './yutori-navigator'

// Register built-in agent types
registerAgent('single', (ctx) => new SingleAgentEvaluator(ctx))
registerAgent(
  'orchestrator-executor',
  (ctx) => new OrchestratorExecutorEvaluator(ctx),
)
registerAgent(
  'gemini-computer-use',
  (ctx) => new GeminiComputerUseEvaluator(ctx),
)
registerAgent('yutori-navigator', (ctx) => new YutoriNavigatorEvaluator(ctx))

// Re-exports
export {
  createAgent,
  getRegisteredAgentTypes,
  isAgentTypeRegistered,
  registerAgent,
} from './registry'
export type { AgentContext, AgentEvaluator, AgentResult } from './types'
