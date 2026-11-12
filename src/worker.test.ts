// Runs src/worker.ts over a temporary sessions folder and a mock host.
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assert, mockHost, mountWorker, test } from 'orca/testing'

import { record } from './fixtures'
import * as main from './worker'

test('reads the mod status files, updates the status bar and opens a workspace', async () => {
  process.env.CLAUDE_CONFIG_DIR = await mkdtemp(join(tmpdir(), 'cache-expiry-'))
  const dir = main.sessionsDir()
  await mkdir(dir, { recursive: true })
  const now = Date.now()
  const live = record({ updatedAt: now, lastAt: now, expiresAt: now + 30 * 60_000, next: null })
  await writeFile(join(dir, 's1.json'), JSON.stringify(live))
  await writeFile(join(dir, 'old.json'), JSON.stringify(record({ sessionId: 'old', endedAt: now - 3_600_000 })))

  const host = mockHost({
    capabilities: ['workspace:read', 'workspace:write'],
    results: {
      'workspace.list': {
        workspaces: [{ id: 'ws-shop', kind: 'worktree', name: 'main', project: 'shop', path: 'C:/code/shop', branch: 'main', hostId: null }],
        truncated: false,
      },
      'workspace.open': { opened: true },
      'statusBar.update': { ok: true },
    },
  })
  const last = (method: string) => host.calls.filter(c => c.method === method).at(-1)?.params
  const worker = await mountWorker(main, { host, commands: [main.OPEN_SOONEST] })
  const { sessions } = await worker.request('sessions.list')
  assert.deepEqual(
    sessions.map(s => [s.sessionId, s.title, s.detail, s.state]),
    [['s1', 'shop', 'main · 210k tokens · Opus 5.5', 'warm']],
  )
  const bar = last('statusBar.update') as { text: string; visible: boolean }
  assert.match(bar.text, /^Cache (29:5\d|30:00)$/)
  assert.equal(bar.visible, true)
  assert.deepEqual(await readdir(dir), ['s1.json'])

  assert.deepEqual(await worker.request('session.open', { sessionId: 's1' }), { opened: true })
  assert.deepEqual(last('workspace.open'), { workspaceId: 'ws-shop' })
  assert.deepEqual(worker.refusals, [])
  await worker.deactivate()
})
