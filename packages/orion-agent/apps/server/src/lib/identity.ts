/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Database } from 'bun:sqlite'

export interface IdentityConfig {
  installId?: string
  db: Database
}

class IdentityService {
  private orionId: string | null = null // Unique identifier for the Orion instance

  initialize(config: IdentityConfig): void {
    const { installId, db } = config

    // Priority: DB > config > generate new
    this.orionId =
      this.loadFromDb(db) || installId || this.generateAndSave(db)
  }

  getOrionId(): string {
    if (!this.orionId) {
      throw new Error(
        'IdentityService not initialized. Call initialize() first.',
      )
    }
    return this.orionId
  }

  isInitialized(): boolean {
    return this.orionId !== null
  }

  private loadFromDb(db: Database): string | null {
    const stmt = db.prepare('SELECT orion_id FROM identity WHERE id = 1')
    const row = stmt.get() as { orion_id: string } | null
    return row?.orion_id ?? null
  }

  private generateAndSave(db: Database): string {
    const orionId = crypto.randomUUID()
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO identity (id, orion_id) VALUES (1, ?)',
    )
    stmt.run(orionId)
    return orionId
  }
}

export const identity = new IdentityService()
