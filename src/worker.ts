// Reads the status files the cache-expiry-handoff Claude Code mod writes, and keeps the status
// bar item and open panels current. Creating the folder is what tells the mod to write them.
import { mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { OrcaWorkerApi } from 'orca/worker'

import { isDisposable, parseRecord, soonest, statusBar, toRows } from './sessions'
import type { LiveRecord, SessionRow, Workspace } from './sessions'

export const STATUS_ITEM = 'cache'
export const OPEN_SOONEST = 'open-soonest'

export function sessionsDir(env: Record<string, string | undefined> = process.env): string {
  const base = env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  return join(base, 'cache-expiry-handoff', 'sessions')
}

type Entry = { mtimeMs: number; record: LiveRecord | null }

let timer: ReturnType<typeof setInterval> | undefined

export default function activate(orca: OrcaWorkerApi): void {
  const dir = sessionsDir()
  const files = new Map<string, Entry>()
  let workspaces: Workspace[] = []
  let workspacesAt = 0
  let rows: SessionRow[] = []
  let rowsKey = ''
  let barKey = ''
  let lastError = ''

  async function loadWorkspaces(now: number) {
    if (now - workspacesAt < 30_000) return
    workspacesAt = now
    const { workspaces: list } = await orca.host.call('workspace.list')
    workspaces = list.map(w => ({ id: w.id, name: w.name, project: w.project ?? null, path: w.path }))
  }

  async function scan(now: number) {
    await mkdir(dir, { recursive: true })
    const names = (await readdir(dir)).filter(n => n.endsWith('.json'))
    const present = new Set(names)
    for (const name of files.keys()) if (!present.has(name)) files.delete(name)
    for (const name of names) {
      const file = join(dir, name)
      const info = await stat(file).catch(() => null)
      if (!info) continue
      let entry = files.get(name)
      if (!entry || entry.mtimeMs !== info.mtimeMs) {
        entry = { mtimeMs: info.mtimeMs, record: parseRecord(await readFile(file, 'utf8').catch(() => '')) }
        files.set(name, entry)
      }
      if (isDisposable(entry.record, info.mtimeMs, now)) {
        await unlink(file).catch(() => undefined)
        files.delete(name)
      }
    }
  }

  async function refresh() {
    const now = Date.now()
    await Promise.all([scan(now), loadWorkspaces(now).catch(() => undefined)])
    const records = [...files.values()].flatMap(e => (e.record ? [e.record] : []))
    rows = toRows(records, workspaces, now)
    const key = JSON.stringify(rows)
    if (key !== rowsKey) {
      rowsKey = key
      orca.panels.post('sessions.changed', { sessions: rows })
    }
    const bar = statusBar(rows, now)
    const nextBar = JSON.stringify(bar)
    if (nextBar !== barKey) {
      barKey = nextBar
      await orca.host.call('statusBar.update', { id: STATUS_ITEM, ...bar })
    }
  }

  let running: Promise<void> | null = null
  const tick = () => {
    running ??= refresh()
      .catch((err: unknown) => {
        const why = err instanceof Error ? err.message : String(err)
        if (why !== lastError) orca.log(`refresh failed: ${(lastError = why)}`)
      })
      .finally(() => (running = null))
    return running
  }

  async function open(row: SessionRow | null | undefined): Promise<boolean> {
    if (!row?.workspaceId) return false
    await orca.host.call('workspace.open', { workspaceId: row.workspaceId })
    return true
  }

  orca.panels.handle('sessions.list', async () => {
    await tick()
    return { sessions: rows }
  })
  orca.panels.handle('session.open', async ({ sessionId }) => ({
    opened: await open(rows.find(r => r.sessionId === sessionId)),
  }))
  orca.commands.register(OPEN_SOONEST, async () => {
    await tick()
    return (await open(soonest(rows))) ? undefined : 'No warm Claude session in an Orca workspace.'
  })

  clearInterval(timer)
  timer = setInterval(() => void tick(), 1000)
  void tick()
}

export function deactivate(): void {
  clearInterval(timer)
  timer = undefined
}
