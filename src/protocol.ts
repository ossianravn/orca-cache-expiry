// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
import type { SessionRow } from './sessions'

export {}

declare module 'orca' {
  interface PluginRequests {
    /** The open Claude Code sessions, warm ones first. */
    'sessions.list': { output: { sessions: SessionRow[] } }
    /** Shows the session's Orca workspace; false when it has none. */
    'session.open': { input: { sessionId: string }; output: { opened: boolean } }
  }
  interface PluginPanelEvents {
    /** Posted to open panels when a session starts, ends or changes plan. */
    'sessions.changed': { sessions: SessionRow[] }
  }
}
