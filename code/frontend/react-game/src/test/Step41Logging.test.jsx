// v0.41.1 Step 41 A — the new timeline rows: PASS, EDGE_STATE and TRAIT_CHANGE shown with their
// own icon and label, MATCH_LIFECYCLE and ADMIN_ACTION hidden (decision 1).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

vi.mock('../api/matches', () => ({
  getMatchLogs: vi.fn(),
}))

import { getMatchLogs } from '../api/matches'
import MatchLogCard, { step41Detail } from '../features/matches/MatchLogCard'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'

const t = (k) => k

function page(logs) {
  return { matchUuid: 'm1', currentClock: 1, total: logs.length, limit: 50, nextCursor: null, logs }
}

describe('Step 41 timeline rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows PASS, EDGE_STATE and TRAIT_CHANGE with their icon and detail', async () => {
    getMatchLogs.mockResolvedValue(page([
      { type: 'PASS', clock: 0, timestamp: '2026-09-28T10:00:00Z', characterUuid: 'c1' },
      { type: 'EDGE_STATE', clock: 0, timestamp: '2026-09-28T10:01:00Z', message: 'COMA' },
      { type: 'TRAIT_CHANGE', clock: 0, timestamp: '2026-09-28T10:02:00Z', message: 'ADD t-1' },
    ]))
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(screen.getAllByText('matchLog.types.PASS').length).toBe(2)
    expect(screen.getByText('matchLog.edgeStates.COMA')).toBeInTheDocument()
    expect(screen.getByText('matchLog.traitActions.ADD')).toBeInTheDocument()
    expect(document.querySelector('.fa-forward')).toBeInTheDocument()
    expect(document.querySelector('.fa-heartbeat')).toBeInTheDocument()
    expect(document.querySelector('.fa-user-tag')).toBeInTheDocument()
  })

  it('hides the MATCH_LIFECYCLE and ADMIN_ACTION rows', async () => {
    getMatchLogs.mockResolvedValue(page([
      { type: 'MATCH_LIFECYCLE', clock: 0, timestamp: '2026-09-28T10:00:00Z', message: 'CREATED' },
      { type: 'ADMIN_ACTION', clock: 0, timestamp: '2026-09-28T10:01:00Z', message: 'PAUSE' },
    ]))
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('matchLog.empty')).toBeInTheDocument()
    expect(screen.queryByText('matchLog.types.MATCH_LIFECYCLE')).not.toBeInTheDocument()
    expect(screen.queryByText('matchLog.types.ADMIN_ACTION')).not.toBeInTheDocument()
  })

  it('step41Detail names each kind and stays out of the other types', () => {
    expect(step41Detail({ type: 'EDGE_STATE', message: 'COMA_RECOVERED' }, t))
      .toBe('matchLog.edgeStates.COMA_RECOVERED')
    expect(step41Detail({ type: 'TRAIT_CHANGE', message: 'REMOVE t-1' }, t))
      .toBe('matchLog.traitActions.REMOVE')
    expect(step41Detail({ type: 'PASS' }, t)).toBe('matchLog.types.PASS')
    expect(step41Detail({ type: 'EDGE_STATE' }, t)).toBeNull()
    expect(step41Detail({ type: 'TRAIT_CHANGE', message: '  ' }, t)).toBeNull()
    expect(step41Detail({ type: 'EVENT', message: 'EVENT_EXECUTED 1' }, t)).toBeNull()
    expect(step41Detail(null, t)).toBeNull()
  })

  it('has the EN and IT labels for every new type and kind', () => {
    for (const dict of [en, it_]) {
      for (const type of ['PASS', 'EDGE_STATE', 'TRAIT_CHANGE', 'MATCH_LIFECYCLE', 'ADMIN_ACTION']) {
        expect(dict.matchLog.types[type]).toBeTruthy()
      }
      for (const kind of ['COMA', 'SADNESS_OVERFLOW', 'COMA_RECOVERED', 'ALL_PLAYER_COMA']) {
        expect(dict.matchLog.edgeStates[kind]).toBeTruthy()
      }
      expect(dict.matchLog.traitActions.ADD).toBeTruthy()
      expect(dict.matchLog.traitActions.REMOVE).toBeTruthy()
    }
  })
})
