/**
 * E2E flow tests against live CDN.
 */

import { afterAll, beforeAll, describe, it, mock } from 'bun:test'
import assert from 'node:assert'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let testDir: string

mock.module('../../src/lib/orion-dir', () => ({
  getSkillsDir: () => testDir,
}))

mock.module('../../src/env', () => ({
  INLINED_ENV: {
    SKILLS_CATALOG_URL: 'https://cdn.orion-browser.local/skills/v1/catalog.json',
  },
}))

const { seedFromRemote, syncRemoteSkills } =
  await import('../../src/skills/remote-sync')

async function listSkills(): Promise<string[]> {
  const entries = await readdir(testDir)
  return entries.filter((e) => !e.startsWith('.')).sort()
}

beforeAll(async () => {
  testDir = join(tmpdir(), `flow-test-${Date.now()}`)
  await mkdir(testDir, { recursive: true })
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('Flow tests against live CDN', () => {
  it('seeds all skills from CDN on fresh install', async () => {
    const result = await seedFromRemote()
    assert.strictEqual(result, true)
    const skills = await listSkills()
    assert.strictEqual(skills.length, 12)
  })

  it('sync does nothing when already up to date', async () => {
    const result = await syncRemoteSkills()
    assert.strictEqual(result.installed, 0)
    assert.strictEqual(result.updated, 0)
  })

  it('remote overwrites local edits when version differs', async () => {
    const skillPath = join(testDir, 'summarize-page', 'SKILL.md')
    const original = await readFile(skillPath, 'utf-8')

    // User edits the file AND we fake a version mismatch
    const edited = original.replace(/version: "1.0"/, 'version: "0.9"') + '\n## My Notes\n'
    await writeFile(skillPath, edited)

    const result = await syncRemoteSkills()
    assert.strictEqual(result.updated >= 1, true)

    const afterSync = await readFile(skillPath, 'utf-8')
    assert.ok(!afterSync.includes('My Notes'))
  })

  it('installs skill deleted locally', async () => {
    await rm(join(testDir, 'save-page'), { recursive: true })

    const result = await syncRemoteSkills()
    assert.strictEqual(result.installed, 1)

    const content = await readFile(join(testDir, 'save-page', 'SKILL.md'), 'utf-8')
    assert.ok(content.includes('name: save-page'))
  })

  it('user-created skill is never touched', async () => {
    const customDir = join(testDir, 'my-workflow')
    await mkdir(customDir, { recursive: true })
    const custom = '---\nname: my-workflow\ndescription: custom\n---\n# Mine\n'
    await writeFile(join(customDir, 'SKILL.md'), custom)

    await syncRemoteSkills()

    const afterSync = await readFile(join(customDir, 'SKILL.md'), 'utf-8')
    assert.strictEqual(afterSync, custom)
  })
})
