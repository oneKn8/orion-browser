/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { LLM_PROVIDERS } from '@orion/shared/schemas/llm'
import { createMiddleware } from 'hono/factory'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import type { ChatRequest } from '../types'

interface RateLimitMiddlewareDeps {
  rateLimiter?: RateLimiter
  orionId?: string
}

type ChatValidationInput = {
  in: { json: ChatRequest }
  out: { json: ChatRequest }
}

export function createBrowserosRateLimitMiddleware(
  deps: RateLimitMiddlewareDeps,
) {
  return createMiddleware<object, '*', ChatValidationInput>(async (c, next) => {
    const { rateLimiter, orionId } = deps

    if (!rateLimiter || !orionId) {
      return next()
    }

    const request = c.req.valid('json')

    if (request.provider === LLM_PROVIDERS.ORION) {
      rateLimiter.check(orionId)
      rateLimiter.record({
        conversationId: request.conversationId,
        orionId,
        provider: request.provider,
      })
    }

    return next()
  })
}
