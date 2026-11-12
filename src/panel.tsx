// The sidebar panel: every open Claude Code session and how long its prompt cache has left.
// The worker reads the mod's status files; this only draws what it posts.
import {
  atom,
  Box,
  EmptyState,
  List,
  ListItem,
  plugin,
  read,
  RelativeTime,
  set,
  Skeleton,
  Stack,
  Text,
  type PanelContext,
} from 'orca'

import type { SessionRow } from './sessions'

/** What the worker last reported; null until it answers. */
const sessions = atom<SessionRow[] | null>(null)

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('sessions.changed', p => set(sessions, p.sessions)))
  void plugin.request('sessions.list').then(a => set(sessions, a.sessions))
}

/** The right edge of the first line: time left, or why there is none. */
function Left({ row }: { row: SessionRow }) {
  if (row.state === 'working') return <Text muted>In use</Text>
  if (row.state === 'cold') return <Text tone="warning">Expired</Text>
  return (
    <Text weight="medium">
      <RelativeTime at={row.expiresAt} format="duration" /> left
    </Text>
  )
}

/** Like a mail list row: project and time left, then the plan, then the details. */
function Session({ row }: { row: SessionRow }) {
  const canOpen = row.inOrca && row.workspaceId !== null
  return (
    <ListItem
      icon={row.inOrca ? 'terminal' : 'agent'}
      onPress={canOpen ? () => void plugin.request('session.open', { sessionId: row.sessionId }) : undefined}
    >
      <Stack gap="none">
        <Box direction="row" gap="sm" justify="between" align="start">
          <Box grow shrink minWidth={0}>
            <Text weight="medium" truncate>
              {row.title}
            </Text>
          </Box>
          <Box shrink={false}>
            <Left row={row} />
          </Box>
        </Box>
        {row.plan ? <Text size="sm">{row.plan}</Text> : null}
        <Text muted size="xs" truncate>
          {row.detail}
        </Text>
      </Stack>
    </ListItem>
  )
}

export default function Panel() {
  const list = read(sessions)
  if (list === null) return <Skeleton lines={3} label="Loading sessions" />
  if (list.length === 0) {
    return (
      <EmptyState
        icon="gauge"
        title="No Claude sessions"
        description="Sessions appear after Claude replies, once the cache-expiry-handoff mod is installed."
      />
    )
  }
  return (
    <List label="Claude sessions">
      {list.map(row => (
        <Session key={row.sessionId} row={row} />
      ))}
    </List>
  )
}
