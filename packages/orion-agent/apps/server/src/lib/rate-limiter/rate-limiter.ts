/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Database } from 'bun:sqlite'
import { RATE_LIMITS } from '@orion/shared/constants/limits'

import { logger } from '../logger'
import { metrics } from '../metrics'

import { RateLimitError } from './errors'

export interface RecordParams {
  conversationId: string
  orionId: string
  provider: string
}

export class RateLimiter {
  private countStmt: ReturnType<Database['prepare']>
  private insertStmt: ReturnType<Database['prepare']>
  private dailyRateLimit: number

  constructor(
    db: Database,
    dailyRateLimit: number = RATE_LIMITS.DEFAULT_DAILY,
  ) {
    this.dailyRateLimit = dailyRateLimit
    this.countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM rate_limiter
      WHERE orion_id = ?
        AND date(created_at) = date('now')
    `)

    // INSERT OR IGNORE: duplicate conversation_ids are silently ignored
    // This ensures the same conversation is only counted once for rate limiting
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO rate_limiter
        (id, orion_id, provider)
      VALUES (?, ?, ?)
    `)
  }

  check(orionId: string): void {
    const count = this.getTodayCount(orionId)
    if (count >= this.dailyRateLimit) {
      logger.warn('Rate limit exceeded', {
        orionId,
        count,
        dailyRateLimit: this.dailyRateLimit,
      })
      metrics.log('rate_limit.triggered', {
        count,
        daily_limit: this.dailyRateLimit,
      })
      throw new RateLimitError(count, this.dailyRateLimit)
    }
  }

  record(params: RecordParams): void {
    const { conversationId, orionId, provider } = params
    this.insertStmt.run(conversationId, orionId, provider)
  }

  private getTodayCount(orionId: string): number {
    const row = this.countStmt.get(orionId) as { count: number } | null
    return row?.count ?? 0
  }
}

export { RateLimitError } from './errors'
