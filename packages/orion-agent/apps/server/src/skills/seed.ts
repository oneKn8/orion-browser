import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getSkillsDir } from '../lib/orion-dir'
import { logger } from '../lib/logger'
import { DEFAULT_SKILLS } from './defaults'
import { seedFromRemote, writeSkillFile } from './remote-sync'

async function hasExistingSkills(skillsDir: string): Promise<boolean> {
  try {
    const entries = await readdir(skillsDir)
    return entries.some((e) => !e.startsWith('.'))
  } catch {
    return false
  }
}

async function skillExists(skillsDir: string, id: string): Promise<boolean> {
  try {
    await stat(join(skillsDir, id, 'SKILL.md'))
    return true
  } catch {
    return false
  }
}

export async function seedDefaultSkills(): Promise<void> {
  const skillsDir = getSkillsDir()
  if (await hasExistingSkills(skillsDir)) return

  const remoteSucceeded = await seedFromRemote()
  if (remoteSucceeded) return

  let seeded = 0
  for (const skill of DEFAULT_SKILLS) {
    if (await skillExists(skillsDir, skill.id)) continue
    try {
      await writeSkillFile(skill.id, skill.content)
      seeded++
    } catch (err) {
      logger.warn('Failed to seed skill', {
        id: skill.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (seeded > 0) {
    logger.info(`Seeded ${seeded} default skills (bundled)`)
  }
}
