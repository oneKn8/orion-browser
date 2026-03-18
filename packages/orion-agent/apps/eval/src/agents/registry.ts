import type { AgentContext, AgentEvaluator } from './types'

/**
 * Factory function signature for creating agents
 */
type AgentFactory = (context: AgentContext) => AgentEvaluator

/**
 * Registry of agent factories by type
 */
const registry = new Map<string, AgentFactory>()

/**
 * Register an agent type with its factory function
 * @throws If type is already registered
 */
export function registerAgent(type: string, factory: AgentFactory): void {
  if (registry.has(type)) {
    throw new Error(`Agent type "${type}" is already registered`)
  }
  registry.set(type, factory)
}

/**
 * Create an agent evaluator from context
 * @throws If agent type is not registered
 */
export function createAgent(context: AgentContext): AgentEvaluator {
  const factory = registry.get(context.config.agent.type)
  if (!factory) {
    const available = Array.from(registry.keys()).join(', ')
    throw new Error(
      `Unknown agent type: "${context.config.agent.type}". Available types: ${available || 'none'}`,
    )
  }
  return factory(context)
}

/**
 * Get list of all registered agent types
 */
export function getRegisteredAgentTypes(): string[] {
  return Array.from(registry.keys())
}

/**
 * Check if an agent type is registered
 */
export function isAgentTypeRegistered(type: string): boolean {
  return registry.has(type)
}
