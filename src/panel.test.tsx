import { assert, mockHost, mount, test } from 'orca/testing'

import { ROWS } from './fixtures'
import * as panel from './panel'

test('lists sessions and opens one in Orca', async () => {
  const opened: string[] = []
  const host = mockHost({
    requests: {
      'sessions.list': () => ({ sessions: ROWS }),
      'session.open': ({ sessionId }) => {
        opened.push(sessionId)
        return { opened: true }
      },
    },
  })
  const view = await mount(panel, { host })
  assert.ok(view.find({ type: 'ListItem', text: /acme-web/ }))
  assert.ok(view.find({ text: /In use/ }))
  assert.ok(view.find({ text: /Expired/ }))
  assert.ok(view.find({ text: /Keeps warm at 15:02/ }))
  await view.press({ type: 'ListItem', text: /acme-web/ })
  assert.deepEqual(opened, ['s1'])

  await view.post('sessions.changed', { sessions: [] })
  assert.ok(view.find({ text: /No Claude sessions/ }))
  assert.deepEqual(view.errors, [])
  assert.deepEqual(view.warnings, [])
  await view.unmount()
})
