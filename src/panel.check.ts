// `orca plugin check` renders the panel once per scenario.
import { defineCheck } from 'orca/testing'

import { ROWS } from './fixtures'

export default defineCheck({
  empty: { requests: { 'sessions.list': () => ({ sessions: [] }) } },
  sessions: { requests: { 'sessions.list': () => ({ sessions: ROWS }) } },
})
