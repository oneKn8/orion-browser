/**
 * @license
 * Copyright 2025 Orion
 */

import { logger } from '../logger'

export interface Provider {
  name: string
  model: string
  apiKey: string
  baseUrl?: string
  dailyRateLimit?: number
  providerType?: string // LLMProvider value from ai-gateway: "openrouter" | "azure" | "anthropic"
}

export interface OrionConfig {
  providers: Provider[]
}

export interface LLMConfig {
  modelName: string
  baseUrl?: string
  apiKey: string
  provider: Provider
  providerType?: string
}

export async function fetchOrionConfig(
  configUrl: string,
  orionId?: string,
): Promise<OrionConfig> {
  logger.debug('Fetching Orion config', { configUrl, orionId })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (orionId) {
    headers['X-Orion-ID'] = orionId
  }

  try {
    const response = await fetch(configUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to fetch config: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const config = (await response.json()) as OrionConfig

    if (!Array.isArray(config.providers) || config.providers.length === 0) {
      throw new Error(
        'Invalid config response: providers array is empty or missing',
      )
    }

    for (const provider of config.providers) {
      if (!provider.name || !provider.model || !provider.apiKey) {
        throw new Error('Invalid provider: missing name, model, or apiKey')
      }
    }

    const defaultProvider = config.providers.find((p) => p.name === 'default')
    logger.info('✅ Orion config fetched', {
      providerCount: config.providers.length,
      dailyRateLimit: defaultProvider?.dailyRateLimit,
    })

    return config
  } catch (error) {
    logger.error('❌ Failed to fetch Orion config', {
      configUrl,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get LLM config from a provider in the Orion config
 * @param config - Orion config containing providers
 * @param providerName - Name of the provider to use (defaults to 'default')
 * @returns LLM config with modelName, baseUrl, apiKey, and provider
 */
export function getLLMConfigFromProvider(
  config: OrionConfig,
  providerName = 'default',
): LLMConfig {
  const provider = config.providers.find((p) => p.name === providerName)

  if (!provider) {
    throw new Error(
      `Provider '${providerName}' not found in config. Available providers: ${config.providers.map((p) => p.name).join(', ')}`,
    )
  }

  return {
    modelName: provider.model,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    provider,
    providerType: provider.providerType,
  }
}
