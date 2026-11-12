# Prompt cache for Orca

An [Orca](https://orca.dev) plugin that shows how long each Claude Code session's prompt cache has left:

- **Status bar:** `Cache 41:12` for the session whose cache expires first. It turns amber in the last 5 minutes. Press it to open that session's workspace. Hover for every session.
- **Sidebar panel (Prompt cache):** every open session, warm ones first, with the time left, what happens before expiry (`Keeps warm at 16:06`, `Hands off at 17:00`) and its tokens and model. Press a row to open its workspace.

It needs the [cache-expiry-handoff](https://github.com/ossianravn/cc-cache-expiry-handoff) Claude Code mod, which does the counting and the keep-warm and handoff. This plugin only shows what the mod reports, for sessions in Orca's terminals and anywhere else on the machine, such as the Claude desktop app.

## How it works

1. On start the plugin creates `~/.claude/cache-expiry-handoff/sessions/` (or the same under `CLAUDE_CONFIG_DIR`).
2. While that folder exists, every Claude Code session with the mod writes a small status file there after each request and once a minute. Without the folder, the mod writes nothing.
3. The plugin reads the folder every second and deletes files of sessions that ended.

## Access it asks for

- **Runs a worker** (Node), to read the status files.
- **workspace:read**, to name each session after its Orca project and workspace.
- **workspace:write**, only to open a session's workspace when you press it.

## Install

```bash
orca plugin install ossianravn/orca-cache-expiry
```

Orca shows what the plugin gets and asks you to approve it (re-run with the `--approve` it prints). To work on a clone instead, use `orca plugin dev load path/to/orca-cache-expiry`. Claude Code sessions that were already running pick up the mod's status files after `/reload-plugins` or a restart.

## Develop

```bash
orca plugin validate .
orca plugin test .
npx -y -p typescript tsc -p .
orca plugin dev watch .
```

| Path | Holds |
| --- | --- |
| `src/sessions.ts` | Status files to rows and status bar text. Pure functions. |
| `src/worker.ts` | Reads the folder, updates the status bar, answers the panel. |
| `src/panel.tsx` | The sidebar panel. |
| `src/protocol.ts` | The panel and worker requests. |
| `src/*.test.ts(x)`, `src/fixtures.ts` | Tests and sample data. |

The status file format is `CacheLive` in the mod's [`types/index.d.ts`](https://github.com/ossianravn/cc-cache-expiry-handoff/blob/main/types/index.d.ts), mirrored as `LiveRecord` in `src/sessions.ts`.
