// Pure logic: status records the Claude Code mod writes -> panel rows and the status bar item.
// No Orca or Node calls here, so the tests can drive it with plain data.

/**
 * One session's status, as the cache-expiry-handoff mod writes it to
 * `<Claude config dir>/cache-expiry-handoff/sessions/<sessionId>.json`.
 * Mirrors `CacheLive` in the mod's `types/index.d.ts`; `v` changes on a breaking change.
 */
export type LiveRecord = {
  v: 1
  sessionId: string
  cwd: string
  orcaPane: string
  entrypoint: string
  model: string
  tokens: number
  hit: number
  lastAt: number
  ttlMs: number
  ttlSource: string
  expiresAt: number
  mode: 'notify' | 'warm' | 'handoff' | 'warm-handoff'
  next: { kind: 'warm' | 'handoff' | 'notify'; at: number } | null
  phase: 'idle' | 'warming' | 'handed-off' | 'notified' | 'stopped'
  paused: boolean
  working: boolean
  pings: number
  updatedAt: number
  endedAt: number
}

/** An Orca workspace: `name` is the worktree's (often its branch), `project` the repository's. */
export type Workspace = { id: string; name: string; project: string | null; path: string }

export type SessionState = 'warm' | 'working' | 'cold'

/** What the panel draws for one session. */
export type SessionRow = {
  sessionId: string
  /** The Orca workspace the session runs in, when one matches its folder. */
  workspaceId: string | null
  /** The project's name, else the workspace's or the folder's. */
  title: string
  /** Workspace, size, model and where it runs: "main · 210k tokens · Opus 5.5". */
  detail: string
  state: SessionState
  expiresAt: number
  /** What happens next, e.g. "Keeps warm at 15:46"; '' when nothing is planned. */
  plan: string
  /** True when it runs in an Orca terminal, so pressing it can open its workspace. */
  inOrca: boolean
}

export type StatusBar = {
  visible: boolean
  text: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  tooltip: string
}

/** A session that has not written for this long has closed without saying so. */
export const STALE_MS = 3 * 60_000
/** The status bar turns amber this long before the cache expires. */
export const WARN_MS = 5 * 60_000

export function parseRecord(text: string): LiveRecord | null {
  try {
    const r = JSON.parse(text) as Partial<LiveRecord>
    if (r?.v !== 1 || typeof r.sessionId !== 'string' || typeof r.expiresAt !== 'number') return null
    return {
      orcaPane: '',
      entrypoint: '',
      cwd: '',
      model: '',
      tokens: 0,
      hit: 0,
      ttlSource: '',
      next: null,
      phase: 'idle',
      paused: false,
      working: false,
      pings: 0,
      updatedAt: 0,
      endedAt: 0,
      ...r,
    } as LiveRecord
  } catch {
    return null
  }
}

/** Whether a record still stands for a running session. */
export function isOpen(r: LiveRecord, now: number): boolean {
  return r.endedAt === 0 && r.expiresAt > 0 && now - r.updatedAt < STALE_MS
}

/** A record Orca may delete: ended, or silent for a day. */
export function isDisposable(r: LiveRecord | null, mtimeMs: number, now: number): boolean {
  if (!r) return now - mtimeMs > 24 * 3_600_000
  if (r.endedAt > 0) return now - r.endedAt > 10 * 60_000
  return now - Math.max(r.updatedAt, mtimeMs) > 24 * 3_600_000
}

export function stateOf(r: LiveRecord, now: number): SessionState {
  if (r.working) return 'working'
  return now < r.expiresAt ? 'warm' : 'cold'
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** The workspace whose folder holds `cwd`, the deepest one when several do. */
export function workspaceFor(cwd: string, workspaces: readonly Workspace[]): Workspace | null {
  const dir = norm(cwd)
  let best: Workspace | null = null
  for (const w of workspaces) {
    const root = norm(w.path)
    if (root && (dir === root || dir.startsWith(`${root}/`)) && (!best || root.length > norm(best.path).length)) best = w
  }
  return best
}

export function fmtModel(model: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model.replace(/\[[^\]]*\]$/, ''))
  if (!m) return model
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1)
  return m[3] ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

/** "41:12", or "1:02:05" past an hour. */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "15:46" in the local time zone. */
export function fmtTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const PLAN = { warm: 'Keeps warm', handoff: 'Hands off', notify: 'Notifies' } as const

const WHERE: Record<string, string> = { 'claude-desktop': 'Desktop app', cli: 'Terminal' }

export function planText(r: LiveRecord, now: number): string {
  if (r.working) return ''
  if (now >= r.expiresAt) return r.phase === 'handed-off' ? 'Handed off' : ''
  if (r.paused) return 'Paused'
  if (r.next) return `${PLAN[r.next.kind]} at ${fmtTime(r.next.at)}`
  if (r.phase === 'handed-off') return 'Handed off'
  if (r.phase === 'notified') return 'Notified'
  return ''
}

export function toRow(r: LiveRecord, workspaces: readonly Workspace[], now: number): SessionRow {
  const ws = workspaceFor(r.cwd, workspaces)
  const folder = r.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'Claude session'
  const inOrca = r.orcaPane !== ''
  const where = inOrca ? '' : WHERE[r.entrypoint] ?? 'Outside Orca'
  const title = ws?.project || ws?.name || folder
  const branch = ws && ws.name !== title ? ws.name : ''
  const detail = [branch, `${fmtTokens(r.tokens)} tokens`, fmtModel(r.model), where].filter(Boolean).join(' · ')
  return {
    sessionId: r.sessionId,
    workspaceId: ws?.id ?? null,
    title,
    detail,
    state: stateOf(r, now),
    expiresAt: r.expiresAt,
    plan: planText(r, now),
    inOrca,
  }
}

const RANK: Record<SessionState, number> = { warm: 0, working: 1, cold: 2 }

/** Open sessions as rows: warm ones first, soonest to expire on top. */
export function toRows(records: readonly LiveRecord[], workspaces: readonly Workspace[], now: number): SessionRow[] {
  return records
    .filter(r => isOpen(r, now))
    .map(r => toRow(r, workspaces, now))
    .sort((a, b) => RANK[a.state] - RANK[b.state] || a.expiresAt - b.expiresAt || a.title.localeCompare(b.title))
}

/** The warm session that expires first, which the status bar shows and opens. */
export function soonest(rows: readonly SessionRow[]): SessionRow | null {
  return rows.find(r => r.state === 'warm') ?? null
}

export function statusBar(rows: readonly SessionRow[], now: number): StatusBar {
  if (rows.length === 0) return { visible: false, text: '', tone: 'neutral', tooltip: '' }
  const first = soonest(rows)
  const lines = rows.map(r => {
    const when =
      r.state === 'warm' ? `${fmtClock(r.expiresAt - now)} left` : r.state === 'working' ? 'In use' : 'Expired'
    return [`${r.title}: ${when}`, r.plan].filter(Boolean).join(' · ')
  })
  if (!first) {
    const isWorking = rows.some(r => r.state === 'working')
    return { visible: true, text: isWorking ? 'Cache in use' : 'Cache expired', tone: 'neutral', tooltip: lines.join('\n') }
  }
  const left = first.expiresAt - now
  return {
    visible: true,
    text: `Cache ${fmtClock(left)}`,
    tone: left <= WARN_MS ? 'warning' : 'neutral',
    tooltip: lines.join('\n'),
  }
}
