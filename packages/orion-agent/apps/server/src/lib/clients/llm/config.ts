/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * LLM config resolution - handles ORION provider lookup.
 */

import { LLM_PROVIDERS, type LLMConfig } from '@orion/shared/schemas/llm'
import { INLINED_ENV } from '../../../env'
import { logger } from '../../logger'
import { fetchOrionConfig, getLLMConfigFromProvider } from '../gateway'
import type { ResolvedLLMConfig } from './types'

export async function resolveLLMConfig(
  config: LLMConfig,
  orionId?: string,
): Promise<ResolvedLLMConfig> {
  if (config.provider !== LLM_PROVIDERS.ORION) {
    if (!config.model) {
      throw new Error(`model is required for ${config.provider} provider`)
    }
    return config as ResolvedLLMConfig
  }

  const configUrl = INLINED_ENV.ORION_CONFIG_URL
  if (!configUrl) {
    throw new Error(
      'ORION_CONFIG_URL environment variable is required for Orion provider',
    )
  }

  logger.debug('Resolving ORION config', { configUrl, orionId })

  const orionConfig = await fetchOrionConfig(configUrl, orionId)
  const llmConfig = getLLMConfigFromProvider(orionConfig, 'default')

  return {
    ...config,
    model: llmConfig.modelName,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    upstreamProvider: llmConfig.providerType,
  }
}
