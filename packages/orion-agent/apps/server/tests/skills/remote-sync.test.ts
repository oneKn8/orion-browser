import { afterEach, beforeEach, describe, it, mock, spyOn } from 'bun:test'
import assert from 'node:assert'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RemoteSkillCatalog } from '../../src/skills/types'

let testDir: string

const mockGetSkillsDir = mock(() => testDir)

mock.module('../../src/lib/orion-dir', () => ({
  getSkillsDir: mockGetSkillsDir,
}))

const { fetchRemoteCatalog, syncRemoteSkills, seedFromRemote } =
  await import('../../src/skills/remote-sync')

function makeCatalog(
  skills: { id: string; version: string; content: string }[],
): RemoteSkillCatalog {
  return { version: 1, skills }
}

const SKILL_V1 = `---
name: test-skill
description: A test skill
metadata:
  display-name: Test Skill
  enabled: "true"
  version: "1.0"
---

# Test Skill

Do the thing.
`

const SKILL_V2 = `---
name: test-skill
description: A test skill (updated)
metadata:
  display-name: Test Skill
  enabled: "true"
  version: "2.0"
---

# Test Skill v2

Do the thing better.
`

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'skill-sync-'))
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
  mock.restore()
})

describe('fetchRemoteCatalog', () => {
  it('returns null on network failure', async () => {
    const spy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    assert.strictEqual(await fetchRemoteCatalog(), null)
    spy.mockRestore()
  })

  it('returns null on non-ok response', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    )
    assert.strictEqual(await fetchRemoteCatalog(), null)
    spy.mockRestore()
  })

  it('returns catalog on success', async () => {
    const catalog = makeCatalog([{ id: 'test', version: '1.0', content: 'hello' }])
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(catalog), { status: 200 }),
    )
    assert.deepStrictEqual(await fetchRemoteCatalog(), catalog)
    spy.mockRestore()
  })

  it('returns null for invalid catalog shape', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ skills: 'not-an-array' }), { status: 200 }),
    )
    assert.strictEqual(await fetchRemoteCatalog(), null)
    spy.mockRestore()
  })

  it('returns null when skill entries have invalid shape', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ version: 1, skills: [{ id: 123, version: '1.0', content: null }] }),
        { status: 200 },
      ),
    )
    assert.strictEqual(await fetchRemoteCatalog(), null)
    spy.mockRestore()
  })

})

describe('syncRemoteSkills', () => {
  it('returns zeros when remote is unavailable', async () => {
    const spy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const result = await syncRemoteSkills()
    assert.deepStrictEqual(result, { installed: 0, updated: 0 })
    spy.mockRestore()
  })

  it('installs new skills that do not exist locally', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'new-skill', version: '1.0', content: SKILL_V1 },
      ])), { status: 200 }),
    )
    const result = await syncRemoteSkills()
    assert.strictEqual(result.installed, 1)

    const content = await readFile(join(testDir, 'new-skill', 'SKILL.md'), 'utf-8')
    assert.strictEqual(content, SKILL_V1)
    spy.mockRestore()
  })

  it('updates skill when remote has newer version', async () => {
    await mkdir(join(testDir, 'test-skill'), { recursive: true })
    await writeFile(join(testDir, 'test-skill', 'SKILL.md'), SKILL_V1)

    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'test-skill', version: '2.0', content: SKILL_V2 },
      ])), { status: 200 }),
    )
    const result = await syncRemoteSkills()
    assert.strictEqual(result.updated, 1)

    const content = await readFile(join(testDir, 'test-skill', 'SKILL.md'), 'utf-8')
    assert.strictEqual(content, SKILL_V2)
    spy.mockRestore()
  })

  it('overwrites user-edited skill when remote has newer version', async () => {
    await mkdir(join(testDir, 'test-skill'), { recursive: true })
    await writeFile(join(testDir, 'test-skill', 'SKILL.md'), SKILL_V1 + '\n## My Notes\n')

    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'test-skill', version: '2.0', content: SKILL_V2 },
      ])), { status: 200 }),
    )
    const result = await syncRemoteSkills()
    assert.strictEqual(result.updated, 1)

    const content = await readFile(join(testDir, 'test-skill', 'SKILL.md'), 'utf-8')
    assert.strictEqual(content, SKILL_V2)
    assert.ok(!content.includes('My Notes'))
    spy.mockRestore()
  })

  it('skips when version matches', async () => {
    await mkdir(join(testDir, 'test-skill'), { recursive: true })
    await writeFile(join(testDir, 'test-skill', 'SKILL.md'), SKILL_V1)

    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'test-skill', version: '1.0', content: SKILL_V1 },
      ])), { status: 200 }),
    )
    const result = await syncRemoteSkills()
    assert.strictEqual(result.installed, 0)
    assert.strictEqual(result.updated, 0)
    spy.mockRestore()
  })

  it('does not touch user-created skills not in catalog', async () => {
    await mkdir(join(testDir, 'my-custom'), { recursive: true })
    const custom = '---\nname: my-custom\ndescription: mine\nmetadata:\n  version: "1.0"\n---\n# Mine\n'
    await writeFile(join(testDir, 'my-custom', 'SKILL.md'), custom)

    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'other-skill', version: '1.0', content: SKILL_V1 },
      ])), { status: 200 }),
    )
    await syncRemoteSkills()

    const content = await readFile(join(testDir, 'my-custom', 'SKILL.md'), 'utf-8')
    assert.strictEqual(content, custom)
    spy.mockRestore()
  })

  it('rejects path traversal in skill ids', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: '../../etc/evil', version: '1.0', content: SKILL_V1 },
      ])), { status: 200 }),
    )
    const result = await syncRemoteSkills()
    assert.strictEqual(result.installed, 0)
    spy.mockRestore()
  })
})

describe('seedFromRemote', () => {
  it('returns false when remote is unavailable', async () => {
    const spy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    assert.strictEqual(await seedFromRemote(), false)
    spy.mockRestore()
  })

  it('seeds all skills from remote', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'skill-a', version: '1.0', content: SKILL_V1 },
        { id: 'skill-b', version: '1.0', content: SKILL_V2 },
      ])), { status: 200 }),
    )
    assert.strictEqual(await seedFromRemote(), true)

    const content = await readFile(join(testDir, 'skill-a', 'SKILL.md'), 'utf-8')
    assert.strictEqual(content, SKILL_V1)
    spy.mockRestore()
  })

  it('returns false for empty catalog', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([])), { status: 200 }),
    )
    assert.strictEqual(await seedFromRemote(), false)
    spy.mockRestore()
  })

  it('returns false on partial failure', async () => {
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeCatalog([
        { id: 'good-skill', version: '1.0', content: SKILL_V1 },
        { id: '../../traversal', version: '1.0', content: 'evil' },
      ])), { status: 200 }),
    )
    assert.strictEqual(await seedFromRemote(), false)
    spy.mockRestore()
  })
})
