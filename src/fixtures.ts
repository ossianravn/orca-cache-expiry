// Sample data shared by the tests and `orca plugin check`.
import type { LiveRecord, SessionRow, Workspace } from './sessions'

export const NOW = Date.UTC(2026, 10, 12, 14, 0, 0)

export const WORKSPACES: Workspace[] = [
  { id: 'ws-shop', name: 'checkout-flow-v2', project: 'acme-web', path: 'C:/code/shop' },
  { id: 'ws-api', name: 'main', project: 'acme-api', path: 'C:/code/api' },
]

export const record = (over: Partial<LiveRecord> = {}): LiveRecord => ({
  v: 1,
  sessionId: 's1',
  cwd: 'C:\\code\\shop',
  orcaPane: 'tab:pane',
  entrypoint: 'cli',
  model: 'claude-opus-5-5',
  tokens: 210_000,
  hit: 0.98,
  lastAt: NOW - 10 * 60_000,
  ttlMs: 3_600_000,
  ttlSource: 'subscription',
  expiresAt: NOW + 50 * 60_000,
  mode: 'warm-handoff',
  next: { kind: 'warm', at: NOW + 48 * 60_000 },
  phase: 'idle',
  paused: false,
  working: false,
  pings: 0,
  updatedAt: NOW - 30_000,
  endedAt: 0,
  ...over,
})

export const ROWS: SessionRow[] = [
  {
    sessionId: 's1',
    workspaceId: 'ws-shop',
    title: 'acme-web',
    detail: 'checkout-flow-v2 · 210k tokens · Opus 5.5',
    state: 'warm',
    expiresAt: NOW + 4 * 60_000,
    plan: 'Keeps warm at 15:02',
    inOrca: true,
  },
  {
    sessionId: 's2',
    workspaceId: 'ws-api',
    title: 'acme-api',
    detail: 'main · 53k tokens · Haiku 5.5',
    state: 'working',
    expiresAt: NOW + 30 * 60_000,
    plan: '',
    inOrca: true,
  },
  {
    sessionId: 's3',
    workspaceId: null,
    title: 'learninglab',
    detail: '91k tokens · Opus 5.5 · Desktop app',
    state: 'cold',
    expiresAt: NOW - 60_000,
    plan: '',
    inOrca: false,
  },
]
