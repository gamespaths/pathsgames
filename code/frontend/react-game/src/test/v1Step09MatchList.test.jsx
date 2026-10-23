// v1.7.0 V1 step 9 — match list envelope, last played, cancelled toggle and style, highlight once.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: k => k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('../api/client', () => ({ apiClient: vi.fn() }))
vi.mock('../api/stories', () => ({ getStory: vi.fn() }))
const guest = vi.hoisted(() => ({ value: null }))
vi.mock('../features/guest-user/GuestUserContext', () => ({ useGuestUser: () => guest.value }))

import { apiClient } from '../api/client'
import { getStory } from '../api/stories'
import { listMatches } from '../api/matches'
import { formatRelative } from '../utils/dates'
import { HIDDEN_MATCH_STATUSES, MATCH_STATUS_BADGE, lastPlayedOf, sortMatchesForList } from '../utils/matchStatus'
import { toEpochMs } from '../utils/dates'
import MatchCard from '../features/matches/MatchCard'
import UserMatchesList from '../features/guest-user/UserMatchesList'

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)
const HOURS_AGO = h => new Date(Date.now() - h * 3600 * 1000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  guest.value = null
  getStory.mockImplementation(uuid => Promise.resolve({ uuid, title: `T-${uuid}`, card: { title: `T-${uuid}` } }))
})

describe('listMatches reads the envelope', () => {
  it('reads items and follows nextCursor', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ data: { items: [{ uuid: 'a' }], nextCursor: '1', limit: 1 } })
      .mockResolvedValueOnce({ data: { items: [{ uuid: 'b' }], nextCursor: null, limit: 1 } })
    apiClient.mockReturnValue({ get })
    expect(await listMatches('tok')).toEqual([{ uuid: 'a' }, { uuid: 'b' }])
    expect(get.mock.calls[0][1].params).toBeUndefined()
    expect(get.mock.calls[1][1].params).toEqual({ cursor: '1' })
    expect(get.mock.calls[1][1].headers.Authorization).toBe('Bearer tok')
  })

  it('accepts a plain array, a body without items, and stops after 20 pages', async () => {
    let get = vi.fn().mockResolvedValue({ data: [{ uuid: 'legacy' }] })
    apiClient.mockReturnValue({ get })
    expect(await listMatches('tok')).toEqual([{ uuid: 'legacy' }])
    get = vi.fn().mockResolvedValue({ data: {} })
    apiClient.mockReturnValue({ get })
    expect(await listMatches()).toEqual([])
    get = vi.fn().mockResolvedValue({ data: { items: [{ uuid: 'x' }], nextCursor: 'again' } })
    apiClient.mockReturnValue({ get })
    expect((await listMatches('tok')).length).toBe(20)
    expect(get).toHaveBeenCalledTimes(20)
  })
})

describe('formatRelative and the list order', () => {
  it('says how long ago, in the given or the browser locale', () => {
    expect(formatRelative(NOW - 2 * 3600 * 1000, 'en', NOW)).toBe('2 hours ago')
    expect(formatRelative(NOW - 3 * 86400 * 1000, 'en', NOW)).toBe('3 days ago')
    expect(formatRelative(NOW - 10 * 1000, 'en', NOW)).toMatch(/second/)
    expect(formatRelative(NOW - 2 * 3600 * 1000, undefined, NOW)).toBeTruthy()
    expect(formatRelative(null)).toBeNull()
    expect(formatRelative('garbage')).toBeNull()
    expect(formatRelative(NOW, 'xx-invalid-!!', NOW)).toBe(new Date(NOW).toISOString())
  })

  it('active (paused included) first, then the last played; tsInsert when tsUpdate is missing', () => {
    const list = [
      { uuid: 'ended', status: 'ENDED', tsUpdate: '2026-10-22T11:00:00Z' },
      { uuid: 'paused', status: 'PAUSED', tsUpdate: '2026-10-01T00:00:00Z' },
      { uuid: 'run', status: 'RUNNING', tsInsert: '2026-10-10T00:00:00Z' },
      { uuid: 'cancelled', status: 'CANCELLED', tsUpdate: '2026-10-22T12:00:00Z' },
    ]
    expect(sortMatchesForList(list, toEpochMs).map(m => m.uuid)).toEqual(['run', 'paused', 'cancelled', 'ended'])
    expect(lastPlayedOf({ tsInsert: 't' })).toBe('t')
    expect(lastPlayedOf(null)).toBeNull()
    expect(HIDDEN_MATCH_STATUSES.has('BANNED')).toBe(true)
    expect(MATCH_STATUS_BADGE.BANNED.tone).toBe('cancelled')
  })
})

describe('MatchCard', () => {
  it('shows the last played line and keeps Resume on an active match', () => {
    const onResume = vi.fn()
    render(<MatchCard match={{ uuid: 'm', status: 'RUNNING', tsUpdate: HOURS_AGO(2) }} onResume={onResume} />)
    expect(screen.getByTestId('match-last-played')).toHaveTextContent('matches.lastPlayed 2 hours ago')
    fireEvent.click(screen.getByText('matches.resume'))
    expect(onResume).toHaveBeenCalled()
    expect(screen.queryByTestId('match-cancelled-note')).toBeNull()
  })

  it('a cancelled match is muted, explains the kept match and never opens', () => {
    const onResume = vi.fn()
    const onHistory = vi.fn()
    const onPreviewCard = vi.fn()
    const { container } = render(<MatchCard match={{ uuid: 'm', status: 'CANCELLED' }} onResume={onResume}
      onHistory={onHistory} onPreviewCard={onPreviewCard} />)
    expect(container.querySelector('.pg-card--match-muted')).toBeTruthy()
    expect(screen.getByTestId('match-cancelled-note')).toHaveTextContent('matches.cancelledKept')
    expect(screen.queryByTestId('match-last-played')).toBeNull()
    expect(screen.queryByText('matches.resume')).toBeNull()
    expect(screen.queryByText('matches.logOpen')).toBeNull()
    container.querySelectorAll('button').forEach(b => fireEvent.click(b))
    fireEvent.click(screen.getByTestId('match-card'))
    expect(onResume).not.toHaveBeenCalled()
    expect(onHistory).not.toHaveBeenCalled()
    expect(onPreviewCard).not.toHaveBeenCalled()
  })

  it('a banned match is muted without the merge note; highlighted marks the card', () => {
    const { container } = render(<MatchCard match={{ uuid: 'm', status: 'BANNED', tsUpdate: HOURS_AGO(1) }} highlighted />)
    expect(container.querySelector('.pg-card--match-muted.pg-card--match-highlight')).toBeTruthy()
    expect(screen.queryByTestId('match-cancelled-note')).toBeNull()
    expect(screen.getByTestId('match-card').dataset.highlighted).toBe('true')
  })

  it('a card without a match or story still renders', () => {
    render(<MatchCard match={null} story={{ title: 'Story', card: { title: 'Story' } }} />)
    expect(screen.getByTestId('match-card').dataset.status).toBe('')
  })

  it('an ended match without dates has no extra line', () => {
    render(<MatchCard match={{ uuid: 'm', status: 'ENDED' }} />)
    expect(screen.queryByTestId('match-last-played')).toBeNull()
    expect(screen.getByTestId('match-card').dataset.highlighted).toBeUndefined()
  })
})

const LIST = [
  { uuid: 'm-run', storyUuid: 's1', status: 'RUNNING', tsUpdate: '2026-10-20T00:00:00Z' },
  { uuid: 'm-can', storyUuid: 's2', status: 'CANCELLED', tsUpdate: '2026-10-21T00:00:00Z' },
  { uuid: 'm-ban', storyUuid: 's3', status: 'BANNED', tsUpdate: '2026-10-19T00:00:00Z' },
]

function renderList(props = {}) {
  return render(<MemoryRouter><UserMatchesList accessToken="tok" preloadedMatches={LIST} {...props} /></MemoryRouter>)
}

describe('UserMatchesList', () => {
  it('hides cancelled and banned matches behind the toggle', async () => {
    renderList()
    await screen.findByText('T-s1')
    expect(screen.getAllByTestId('match-card').map(c => c.dataset.status)).toEqual(['RUNNING'])
    const toggle = screen.getByTestId('show-cancelled-toggle')
    expect(toggle).toHaveTextContent('matches.showCancelled (2)')
    fireEvent.click(toggle.querySelector('input'))
    expect(screen.getAllByTestId('match-card').map(c => c.dataset.status)).toEqual(['RUNNING', 'CANCELLED', 'BANNED'])
  })

  it('Resume closes the book and opens the active match', async () => {
    const onClose = vi.fn()
    renderList({ onClose })
    await screen.findByText('T-s1')
    fireEvent.click(screen.getByText('matches.resume'))
    expect(onClose).toHaveBeenCalled()
  })

  it('no toggle without hidden matches; only hidden ones show the empty text', async () => {
    const { unmount } = render(<MemoryRouter><UserMatchesList preloadedMatches={[LIST[0]]} /></MemoryRouter>)
    await screen.findByText('T-s1')
    expect(screen.queryByTestId('show-cancelled-toggle')).toBeNull()
    unmount()
    render(<MemoryRouter><UserMatchesList preloadedMatches={[LIST[1]]} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('matches.noMatches')).toBeTruthy())
    expect(screen.getByTestId('show-cancelled-toggle')).toBeTruthy()
  })

  it('highlights the matches cancelled by the last login once, with the toggle on', async () => {
    const consume = vi.fn()
    guest.value = { highlightedMatchUuids: ['m-can'], consumeHighlightedMatches: consume }
    const { unmount } = renderList()
    await screen.findByText('T-s2')
    const cards = screen.getAllByTestId('match-card')
    expect(cards.map(c => c.dataset.status)).toEqual(['RUNNING', 'CANCELLED', 'BANNED'])
    expect(cards.filter(c => c.dataset.highlighted === 'true').map(c => c.dataset.status)).toEqual(['CANCELLED'])
    expect(consume).toHaveBeenCalledTimes(1)
    unmount()
    guest.value = { highlightedMatchUuids: [], consumeHighlightedMatches: consume }
    renderList()
    await screen.findByText('T-s1')
    expect(screen.getAllByTestId('match-card').some(c => c.dataset.highlighted === 'true')).toBe(false)
    expect(consume).toHaveBeenCalledTimes(1)
  })
})
