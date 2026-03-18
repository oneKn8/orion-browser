import {
  fetchOrionConfig,
  getLLMConfigFromProvider,
} from '@orion/server/lib/clients/gateway'
import { LLM_PROVIDERS, type LLMConfig } from '@orion/shared/schemas/llm'
import { resolveEnvValue } from './resolve-env'

export interface ResolvedProviderConfig extends LLMConfig {
  upstreamProvider?: string
}

export async function resolveProviderConfig(
  agent: LLMConfig,
): Promise<ResolvedProviderConfig> {
  if (agent.provider === LLM_PROVIDERS.ORION) {
    const configUrl = process.env.ORION_CONFIG_URL
    if (!configUrl) {
      throw new Error(
        'ORION_CONFIG_URL environment variable is required for Orion provider',
      )
    }
    const orionConfig = await fetchOrionConfig(configUrl)
    const llmConfig = getLLMConfigFromProvider(orionConfig, 'default')
    return {
      provider: LLM_PROVIDERS.ORION,
      model: llmConfig.modelName,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      upstreamProvider: llmConfig.providerType,
    }
  }

  return {
    ...agent,
    apiKey: resolveEnvValue(agent.apiKey),
    accessKeyId: resolveEnvValue(agent.accessKeyId),
    secretAccessKey: resolveEnvValue(agent.secretAccessKey),
    sessionToken: resolveEnvValue(agent.sessionToken),
  }
}
