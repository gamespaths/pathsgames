import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'it', setLang: vi.fn() }),
}))

vi.mock('../api/matches', () => ({
  getMatchLogs: vi.fn(),
}))

import { getMatchLogs } from '../api/matches'
import MatchLogCard, { typeCounts } from '../features/matches/MatchLogCard'

// v0.41.6 — the type chips over the match history.
const PAGE = {
  nextCursor: null,
  logs: [
    { type: 'WEATHER', timestamp: '2026-07-12T10:00:00Z', card: { title: 'Thunderstorm' } },
    { type: 'MOVEMENT', timestamp: '2026-07-12T10:01:00Z', card: { title: 'Dark Forest' } },
    { type: 'MOVEMENT', timestamp: '2026-07-12T10:02:00Z', card: { title: 'Old Bridge' } },
    { type: 'CLOCK_ADVANCE', timestamp: '2026-07-12T10:03:00Z' },
  ],
}
const MATCH = { status: 'RUNNING', tsInsert: '2026-07-12T09:00:00Z' }

const chip = (name) => screen.getByRole('button', { name })
const rows = () => screen.getAllByTestId('match-log-row')

describe('MatchLogCard type filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchLogs.mockResolvedValue(PAGE)
  })

  it('shows All plus one chip per visible type, with counts (hidden types excluded)', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" match={MATCH} />)
    expect(await screen.findByTestId('match-log-filters')).toBeInTheDocument()
    expect(chip('matchLog.filterAll (3)')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('matchLog.types.WEATHER (1)')).toBeInTheDocument()
    expect(chip('matchLog.types.MOVEMENT (2)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CLOCK_ADVANCE/ })).toBeNull()
    expect(rows()).toHaveLength(3)
  })

  it('filters by type, hides the status/creation tiles, and toggles back to all', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" match={MATCH} />)
    await screen.findByTestId('match-log-filters')
    expect(screen.getByTestId('match-log-status')).toBeInTheDocument()

    fireEvent.click(chip('matchLog.types.MOVEMENT (2)'))
    expect(rows()).toHaveLength(2)
    expect(chip('matchLog.types.MOVEMENT (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('match-log-status')).toBeNull()
    expect(screen.queryByTestId('match-log-creation')).toBeNull()

    fireEvent.click(chip('matchLog.types.MOVEMENT (2)'))
    expect(rows()).toHaveLength(3)
    expect(screen.getByTestId('match-log-creation')).toBeInTheDocument()

    fireEvent.click(chip('matchLog.types.WEATHER (1)'))
    expect(rows()).toHaveLength(1)
    fireEvent.click(chip('matchLog.filterAll (3)'))
    expect(rows()).toHaveLength(3)
  })

  it('renders no chips when there are no visible entries', async () => {
    getMatchLogs.mockResolvedValue({ nextCursor: null, logs: [{ type: 'CLOCK_ADVANCE' }] })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" match={MATCH} />)
    expect(await screen.findByTestId('match-log-status')).toBeInTheDocument()
    expect(screen.queryByTestId('match-log-filters')).toBeNull()
  })

  it('typeCounts counts per type', () => {
    expect(typeCounts([{ type: 'A' }, { type: 'B' }, { type: 'A' }])).toEqual({ A: 2, B: 1 })
  })
})
