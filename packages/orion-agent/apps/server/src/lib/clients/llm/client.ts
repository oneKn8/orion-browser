/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Lightweight LLM client for text generation.
 * Used by SDK verify endpoint.
 */

import type { LLMConfig } from '@orion/shared/schemas/llm'
import type { LanguageModel, ModelMessage } from 'ai'
import { generateText } from 'ai'
import { resolveLLMConfig } from './config'
import { createLLMProvider } from './provider'

export class LLMClient {
  private constructor(private model: LanguageModel) {}

  static async create(
    config: LLMConfig,
    orionId?: string,
  ): Promise<LLMClient> {
    const resolved = await resolveLLMConfig(config, orionId)
    const model = createLLMProvider(resolved)
    return new LLMClient(model)
  }

  async generateText(messages: ModelMessage[]): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages,
    })

    return result.text
  }
}
