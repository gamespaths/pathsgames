import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'it', setLang: vi.fn() }),
}))

vi.mock('../api/matches', () => ({
  getMatchLogs: vi.fn(),
}))

import { getMatchLogs } from '../api/matches'
import MatchLogCard, { formatLogDate } from '../features/matches/MatchLogCard'

const PAGE = {
  matchUuid: 'm1',
  currentClock: 2,
  total: 3,
  limit: 50,
  nextCursor: null,
  logs: [
    {
      type: 'WEATHER', clock: 0, timestamp: '2026-07-12T10:00:00Z', idWeather: 3,
      idCard: 300, card: { title: 'Thunderstorm', urlImage: 'http://img/storm.png' },
    },
    {
      type: 'MOVEMENT', clock: null, timestamp: '2026-07-12T10:01:00Z',
      idLocationFrom: 1, idLocationTo: 2, energyCost: 4,
      characterUuid: 'char-1', characterName: 'Ranger',
      idCard: 400, card: { title: 'Dark Forest', awesomeIcon: 'fa-tree' },
    },
    {
      type: 'SLEEP', clock: 1, timestamp: '2026-07-12T10:02:00Z',
      characterUuid: 'char-1', characterName: 'Ranger',
    },
  ],
}

describe('MatchLogCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchLogs.mockResolvedValue(PAGE)
  })

  it('calls the logs API with the match uuid, token and language', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(getMatchLogs).toHaveBeenCalledWith('m1', 'tok', { limit: 50, lang: 'it' })
  })

  it('shows the LoadingCard (with the story picture) while the first page loads', () => {
    getMatchLogs.mockReturnValue(new Promise(() => {}))
    const story = { card: { urlImage: 'http://story/cover.jpg', description: 'A tale' } }
    const { container } = render(<MatchLogCard matchUuid="m1" accessToken="tok" story={story} />)
    expect(screen.getByText('game.loadingCard.title')).toBeInTheDocument()
    expect(container.querySelector('img').src).toBe('http://story/cover.jpg')
  })

  it('renders one card per log entry, with the event type on the image', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(screen.getAllByText('matchLog.types.WEATHER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('matchLog.types.MOVEMENT').length).toBeGreaterThan(0)
    // SLEEP shows GameBook's own sleep card as its title, and the type as the overlay
    expect(screen.getAllByText('matchLog.types.SLEEP').length).toBe(1)
    expect(screen.getByText('game.sleep.confirmTitle')).toBeInTheDocument()
  })

  it('hides CLOCK_ADVANCE entries', async () => {
    getMatchLogs.mockResolvedValue({
      ...PAGE,
      logs: [...PAGE.logs, { type: 'CLOCK_ADVANCE', clock: 2, timestamp: '2026-07-12T10:03:00Z' }],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(screen.queryByText('matchLog.types.CLOCK_ADVANCE')).not.toBeInTheDocument()
  })

  it('shows only the empty state when every entry is a hidden clock advance', async () => {
    getMatchLogs.mockResolvedValue({
      ...PAGE,
      logs: [{ type: 'CLOCK_ADVANCE', clock: 1, timestamp: '2026-07-12T10:03:00Z' }],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('matchLog.empty')).toBeInTheDocument()
  })

  it('shows the card title and image of weather and movement entries', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('Thunderstorm')).toBeInTheDocument()
    expect(screen.getByAltText('Thunderstorm')).toHaveAttribute('src', 'http://img/storm.png')
    // no image → the card's awesome icon stands in for the thumbnail
    expect(screen.getByText('Dark Forest')).toBeInTheDocument()
    expect(screen.queryByAltText('Dark Forest')).not.toBeInTheDocument()
  })

  it('shows an EVENT entry with its own card, icon and label (v0.30.3)', async () => {
    getMatchLogs.mockResolvedValue({
      ...PAGE,
      logs: [{
        type: 'EVENT', clock: 3, timestamp: '2026-07-12T10:05:00Z',
        idEvent: 42, idCard: 600, message: 'EVENT_EXECUTED 42',
        card: { title: 'A Fork In The Road', urlImage: 'http://img/fork.png' },
        characterUuid: 'char-1', characterName: 'Ranger',
      }],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(screen.getByText('A Fork In The Road')).toBeInTheDocument()
    expect(screen.getByText('matchLog.types.EVENT')).toBeInTheDocument()
    expect(document.querySelector('.fa-scroll')).toBeInTheDocument()
  })

  it('names the character that performed the action, next to the date', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    // movement + sleep both carry the actor, rendered as "· Ranger" after the date
    expect(screen.getAllByText(/Ranger/)).toHaveLength(2)
  })

  it('shows the date of each entry in the reader language', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    // lang is 'it' in this file's i18n mock → day before month (12/07/26)
    expect(screen.getAllByText(/12\/07\/26/).length).toBeGreaterThan(0)
  })

  it('renders the empty state when the match has no history yet', async () => {
    getMatchLogs.mockResolvedValue({ ...PAGE, logs: [], total: 0 })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('matchLog.empty')).toBeInTheDocument()
  })

  it('surfaces an error instead of the table when the API fails', async () => {
    getMatchLogs.mockRejectedValue(new Error('boom'))
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('appends the next page when "load more" is clicked', async () => {
    getMatchLogs
      .mockResolvedValueOnce({ ...PAGE, logs: [PAGE.logs[0]], nextCursor: 'cur-2', total: 2 })
      .mockResolvedValueOnce({ ...PAGE, logs: [PAGE.logs[2]], nextCursor: null, total: 2 })

    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByText('Thunderstorm')

    fireEvent.click(screen.getByText('matchLog.loadMore'))

    await waitFor(() => expect(screen.getAllByText('matchLog.types.SLEEP').length).toBe(1))
    // the first page is still there — pages accumulate, they do not replace
    expect(screen.getByText('Thunderstorm')).toBeInTheDocument()
    expect(getMatchLogs).toHaveBeenLastCalledWith('m1', 'tok', { limit: 50, cursor: 'cur-2', lang: 'it' })
    // the last page has no cursor → the button is gone
    await waitFor(() => expect(screen.queryByText('matchLog.loadMore')).not.toBeInTheDocument())
  })

  it('opens the entry card when (i) is clicked, and goes back to the list', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    // (i) on the weather tile → its card takes over the page
    const weatherTile = screen.getByText('Thunderstorm').closest('.pg-card')
    fireEvent.click(weatherTile.querySelector('button'))

    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getByText('Thunderstorm')).toBeInTheDocument()

    // the back arrow returns to the timeline
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(await screen.findByTestId('match-log-card')).toBeInTheDocument()
  })

  it('previews entries without a card of their own using the type label', async () => {
    getMatchLogs.mockResolvedValue({
      ...PAGE,
      logs: [...PAGE.logs, {
        type: 'RECOVERY', clock: 2, timestamp: '2026-07-12T10:03:00Z',
        characterUuid: 'char-1', characterName: 'Ranger', message: 'recovery safe=1',
      }],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    // RECOVERY carries no card → the tile title is the type label
    const recoveryTile = screen.getAllByText('matchLog.types.RECOVERY')[0].closest('.pg-card')
    fireEvent.click(recoveryTile.querySelector('button'))

    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getAllByText('matchLog.types.RECOVERY').length).toBeGreaterThan(0)
  })

  it('shows a SLEEP entry with the same sleep card GameBook uses (v0.30.3)', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    // (i) on the sleep tile → the preview page shows the same card, not just the type label
    const sleepTile = screen.getByText('game.sleep.confirmTitle').closest('.pg-card')
    fireEvent.click(sleepTile.querySelector('button'))

    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getAllByText('game.sleep.confirmTitle').length).toBeGreaterThan(0)
  })

  it('calls onBack when the back arrow is used', async () => {
    const onBack = vi.fn()
    render(<MatchLogCard matchUuid="m1" accessToken="tok" onBack={onBack} />)
    await screen.findByTestId('match-log-card')
    // Card renders the back/close control as a button in page mode.
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onBack).toHaveBeenCalled()
  })
})

describe('formatLogDate', () => {
  it('orders day and month according to the language', () => {
    const iso = '2026-07-12T10:00:00Z'
    expect(formatLogDate(iso, 'it')).toMatch(/^12\/07/)   // day first
    expect(formatLogDate(iso, 'en')).toMatch(/^7\/12/)    // month first
  })

  it('is null-safe and tolerates a garbage timestamp', () => {
    expect(formatLogDate(null, 'en')).toBe('—')
    expect(formatLogDate('not-a-date', 'en')).toBe('not-a-date')
  })
})
