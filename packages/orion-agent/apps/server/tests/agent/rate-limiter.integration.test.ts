/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Integration tests for RateLimiter
 * Uses in-memory SQLite to test actual database behavior
 */

import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, it } from 'bun:test'

import {
  RateLimitError,
  RateLimiter,
} from '../../src/agent/rate-limiter/rate-limiter'

const DAILY_RATE_LIMIT_TEST = 3

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limiter (
      id TEXT PRIMARY KEY,
      orion_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return db
}

describe('RateLimiter', () => {
  let db: Database
  let rateLimiter: RateLimiter

  beforeEach(() => {
    db = createTestDb()
    rateLimiter = new RateLimiter(db, DAILY_RATE_LIMIT_TEST)
  })

  describe('check()', () => {
    it('allows first 3 conversations (check before record)', () => {
      const orionId = 'test-orion-id'

      // Simulates real flow: check() then record() for each conversation
      for (let i = 1; i <= 3; i++) {
        expect(() => rateLimiter.check(orionId)).not.toThrow()
        rateLimiter.record({
          conversationId: `conv-${i}`,
          orionId,
          provider: 'orion',
        })
      }
    })

    it('blocks 4th conversation with RateLimitError', () => {
      const orionId = 'test-orion-id'

      // Use up all 3 slots
      for (let i = 1; i <= 3; i++) {
        rateLimiter.check(orionId)
        rateLimiter.record({
          conversationId: `conv-${i}`,
          orionId,
          provider: 'orion',
        })
      }

      // 4th should be blocked
      expect(() => rateLimiter.check(orionId)).toThrow(RateLimitError)

      try {
        rateLimiter.check(orionId)
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError)
        const rateLimitError = error as RateLimitError
        expect(rateLimitError.used).toBe(3)
        expect(rateLimitError.limit).toBe(3)
        expect(rateLimitError.statusCode).toBe(429)
      }
    })
  })

  describe('record() with duplicate conversation IDs', () => {
    it('ignores duplicate conversation IDs (same conversation counted once)', () => {
      const orionId = 'test-orion-id'
      const sameConversationId = 'duplicate-conv-id'

      // Record the same conversation 5 times
      for (let i = 0; i < 5; i++) {
        rateLimiter.record({
          conversationId: sameConversationId,
          orionId,
          provider: 'orion',
        })
      }

      // Should still pass - only counts as 1 conversation
      expect(() => rateLimiter.check(orionId)).not.toThrow()

      // Add 2 more unique conversations (total 3)
      rateLimiter.record({
        conversationId: 'unique-conv-1',
        orionId,
        provider: 'orion',
      })
      rateLimiter.record({
        conversationId: 'unique-conv-2',
        orionId,
        provider: 'orion',
      })

      // Now at limit (3 unique conversations)
      expect(() => rateLimiter.check(orionId)).toThrow(RateLimitError)
    })
  })

  describe('separate limits per orionId', () => {
    it('tracks limits independently for different users', () => {
      const user1 = 'orion-user-1'
      const user2 = 'orion-user-2'

      // User 1 uses all 3 conversations
      for (let i = 1; i <= 3; i++) {
        rateLimiter.record({
          conversationId: `user1-conv-${i}`,
          orionId: user1,
          provider: 'orion',
        })
      }

      // User 1 is blocked
      expect(() => rateLimiter.check(user1)).toThrow(RateLimitError)

      // User 2 should still have full quota
      expect(() => rateLimiter.check(user2)).not.toThrow()

      // User 2 can use their quota
      rateLimiter.record({
        conversationId: 'user2-conv-1',
        orionId: user2,
        provider: 'orion',
      })
      expect(() => rateLimiter.check(user2)).not.toThrow()
    })
  })
})
