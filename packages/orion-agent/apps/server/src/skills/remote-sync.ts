import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TIMEOUTS } from '@orion/shared/constants/timeouts'
import { EXTERNAL_URLS } from '@orion/shared/constants/urls'
import { INLINED_ENV } from '../env'
import { getSkillsDir } from '../lib/orion-dir'
import { logger } from '../lib/logger'
import { safeSkillDir } from './service'
import type { RemoteSkillCatalog, RemoteSkillEntry } from './types'

let syncTimer: ReturnType<typeof setInterval> | null = null

export function extractVersion(content: string): string {
  const match = content.match(/^\s*version:\s*["']?([^"'\n]+)["']?/m)
  return match?.[1]?.trim() || '1.0'
}

function isValidSkillEntry(entry: unknown): entry is RemoteSkillEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.version === 'string' &&
    typeof e.content === 'string'
  )
}

function isValidCatalog(data: unknown): data is RemoteSkillCatalog {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.version === 'number' &&
    Array.isArray(d.skills) &&
    d.skills.every(isValidSkillEntry)
  )
}

function getCatalogUrl(): string {
  return INLINED_ENV.SKILLS_CATALOG_URL || EXTERNAL_URLS.SKILLS_CATALOG
}

export async function fetchRemoteCatalog(): Promise<RemoteSkillCatalog | null> {
  try {
    const response = await fetch(getCatalogUrl(), {
      signal: AbortSignal.timeout(TIMEOUTS.SKILLS_FETCH),
    })
    if (!response.ok) {
      logger.warn('Failed to fetch remote skill catalog', {
        status: response.status,
      })
      return null
    }
    const data: unknown = await response.json()
    if (!isValidCatalog(data)) {
      logger.warn('Remote skill catalog has invalid format')
      return null
    }
    return data
  } catch (err) {
    logger.debug('Remote skill catalog unavailable', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function getLocalVersion(skillId: string): Promise<string | null> {
  try {
    const safeDir = safeSkillDir(skillId)
    const content = await readFile(join(safeDir, 'SKILL.md'), 'utf-8')
    return extractVersion(content)
  } catch {
    return null
  }
}

export async function writeSkillFile(
  skillId: string,
  content: string,
): Promise<void> {
  const safeDir = safeSkillDir(skillId)
  await mkdir(safeDir, { recursive: true })
  await writeFile(join(safeDir, 'SKILL.md'), content)
}

export async function syncRemoteSkills(): Promise<{
  installed: number
  updated: number
}> {
  const result = { installed: 0, updated: 0 }
  const catalog = await fetchRemoteCatalog()
  if (!catalog) return result

  for (const remoteSkill of catalog.skills) {
    try {
      const localVersion = await getLocalVersion(remoteSkill.id)

      if (!localVersion) {
        await writeSkillFile(remoteSkill.id, remoteSkill.content)
        result.installed++
        continue
      }

      if (localVersion === remoteSkill.version) {
        continue
      }

      await writeSkillFile(remoteSkill.id, remoteSkill.content)
      result.updated++
    } catch (err) {
      logger.warn('Failed to sync skill', {
        id: remoteSkill.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

export async function seedFromRemote(): Promise<boolean> {
  const catalog = await fetchRemoteCatalog()
  if (!catalog || catalog.skills.length === 0) return false

  let seeded = 0

  for (const skill of catalog.skills) {
    try {
      await writeSkillFile(skill.id, skill.content)
      seeded++
    } catch (err) {
      logger.warn('Failed to seed remote skill', {
        id: skill.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (seeded > 0) {
    logger.info(`Seeded ${seeded}/${catalog.skills.length} skills from remote catalog`)
  }

  return seeded === catalog.skills.length
}

async function runSync(): Promise<void> {
  try {
    const { installed, updated } = await syncRemoteSkills()
    if (installed > 0 || updated > 0) {
      logger.info('Remote skill sync completed', { installed, updated })
    }
  } catch (err) {
    logger.warn('Skill sync failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function startSkillSync(): void {
  if (syncTimer) return

  runSync()

  syncTimer = setInterval(runSync, TIMEOUTS.SKILLS_SYNC_INTERVAL)
  syncTimer.unref()
}

export function stopSkillSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
