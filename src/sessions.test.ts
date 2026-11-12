import { assert, test } from 'orca/testing'

import { NOW, WORKSPACES, record } from './fixtures'
import { fmtClock, fmtModel, isDisposable, parseRecord, statusBar, toRows, workspaceFor } from './sessions'

test('reads a record and refuses anything else', () => {
  assert.equal(parseRecord(JSON.stringify(record()))?.sessionId, 's1')
  assert.equal(parseRecord('{"v":2,"sessionId":"x","expiresAt":1}'), null)
  assert.equal(parseRecord('not json'), null)
})

test('matches the deepest workspace holding the folder', () => {
  const nested = [...WORKSPACES, { id: 'ws-web', name: 'web', project: null, path: 'C:\\code\\shop\\web\\' }]
  assert.equal(workspaceFor('c:/code/shop/web/src', nested)?.id, 'ws-web')
  assert.equal(workspaceFor('C:\\code\\shop', nested)?.id, 'ws-shop')
  assert.equal(workspaceFor('C:/code/shopping', nested), null)
})

test('lists open sessions, warm and soonest first', () => {
  const rows = toRows(
    [
      record({ sessionId: 'late', expiresAt: NOW + 40 * 60_000 }),
      record({ sessionId: 'cold', expiresAt: NOW - 1 }),
      record({ sessionId: 'soon', cwd: 'C:/code/api', expiresAt: NOW + 3 * 60_000 }),
      record({ sessionId: 'busy', working: true }),
      record({ sessionId: 'ended', endedAt: NOW - 1000 }),
      record({ sessionId: 'silent', updatedAt: NOW - 10 * 60_000 }),
    ],
    WORKSPACES,
    NOW,
  )
  assert.deepEqual(
    rows.map(r => r.sessionId),
    ['soon', 'late', 'busy', 'cold'],
  )
  assert.equal(rows[0].title, 'acme-api')
  assert.equal(rows[0].detail, 'main · 210k tokens · Opus 5.5')
  const plain = [{ id: 'w', name: 'web', project: null, path: 'C:/code/web' }]
  assert.equal(toRows([record({ cwd: 'C:/code/web' })], plain, NOW)[0].detail, '210k tokens · Opus 5.5')
})

test('names the plan and where a session outside Orca runs', () => {
  const [row] = toRows([record({ orcaPane: '', entrypoint: 'claude-desktop', cwd: 'D:/notes' })], WORKSPACES, NOW)
  assert.equal(row.title, 'notes')
  assert.equal(row.workspaceId, null)
  assert.equal(row.detail, '210k tokens · Opus 5.5 · Desktop app')
  assert.match(row.plan, /^Keeps warm at \d\d:\d\d$/)
  const [paused] = toRows([record({ paused: true, next: null })], WORKSPACES, NOW)
  assert.equal(paused.plan, 'Paused')
})

test('the status bar counts down the soonest warm session', () => {
  const rows = toRows([record({ expiresAt: NOW + 4 * 60_000 + 5_000 }), record({ sessionId: 'b' })], WORKSPACES, NOW)
  const bar = statusBar(rows, NOW)
  assert.equal(bar.text, 'Cache 4:05')
  assert.equal(bar.tone, 'warning')
  assert.equal(bar.tooltip.split('\n').length, 2)
  assert.equal(statusBar(toRows([record()], WORKSPACES, NOW), NOW).tone, 'neutral')
  assert.equal(statusBar([], NOW).visible, false)
  assert.equal(statusBar(toRows([record({ expiresAt: NOW - 1 })], WORKSPACES, NOW), NOW).text, 'Cache expired')
})

test('cleans up ended and long-silent records only', () => {
  assert.equal(isDisposable(record({ endedAt: NOW - 20 * 60_000 }), NOW, NOW), true)
  assert.equal(isDisposable(record({ endedAt: NOW - 60_000 }), NOW, NOW), false)
  assert.equal(isDisposable(record({ updatedAt: NOW - 2 * 86_400_000 }), NOW - 2 * 86_400_000, NOW), true)
  assert.equal(isDisposable(record(), NOW, NOW), false)
})

test('formats models and clocks', () => {
  assert.equal(fmtModel('claude-opus-5-5[1m]'), 'Opus 5.5')
  assert.equal(fmtModel('claude-fable-5-2'), 'Fable 5.2')
  assert.equal(fmtClock(61 * 60_000 + 5_000), '1:01:05')
  assert.equal(fmtClock(-5), '0:00')
})
