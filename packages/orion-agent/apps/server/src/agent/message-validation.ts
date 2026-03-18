/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { UIMessage } from 'ai'

/**
 * Checks whether a UIMessage has meaningful content that can be sent
 * to the AI provider without causing validation errors.
 *
 * Two layers of validation can reject messages:
 *
 * 1. **AI SDK** (`validate-ui-messages.ts`):
 *    - `parts` array must be `.nonempty()` — rejects `parts: []`
 *
 * 2. **Provider API** (e.g. Gemini `generateContent`, Anthropic, OpenAI):
 *    - Assistant messages with only empty-string text are rejected
 *      as semantically empty, even though the SDK schema allows it
 *
 * This function guards against both layers so callers can filter
 * messages before passing them to `createAgentUIStreamResponse`.
 */
export function hasMessageContent(message: UIMessage): boolean {
  if (message.parts.length === 0) return false

  // A message that contains any non-text part (tool invocation, reasoning,
  // file, step-start, etc.) is always considered valid — those part types
  // carry meaning regardless of text content.
  const hasNonTextPart = message.parts.some((p) => p.type !== 'text')
  if (hasNonTextPart) return true

  // All parts are text — at least one must have non-whitespace content.
  return message.parts.some(
    (p) => p.type === 'text' && p.text.trim().length > 0,
  )
}

/**
 * Filters a UIMessage array, removing messages that would fail
 * SDK validation or provider-level content checks.
 */
export function filterValidMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(hasMessageContent)
}
