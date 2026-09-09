import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'it', setLang: vi.fn() }),
}))

vi.mock('../api/matches', () => ({
  getMatchLogs: vi.fn(),
}))

import { getMatchLogs } from '../api/matches'
import MatchLogCard, { formatLogDate, resourceBadges, LogEntryRow } from '../features/matches/MatchLogCard'

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

  it('names every entry by its card title, and shows no picture in the list', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('Thunderstorm')).toBeInTheDocument()
    expect(screen.getByText('Dark Forest')).toBeInTheDocument()
    // v0.37.2 — the timeline is a list of rows: the picture lives on the page the (i) opens.
    expect(screen.queryByAltText('Thunderstorm')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('match-log-row').length).toBeGreaterThan(1)
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

  it('leaves the actor to the page: a row is what happened, not who did it', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    // v0.37.2 — the row carries the type, the title, the date and the lens; the actor is
    // one of the things the page has room to spell out.
    expect(screen.queryByText(/Ranger/)).not.toBeInTheDocument()

    // The movement row is the one whose entry names an actor.
    const movement = screen.getByText('Dark Forest').closest('.match-log-row')
    fireEvent.click(movement.querySelector('.match-log-row__info'))
    expect(screen.getByText(/Ranger/)).toBeInTheDocument()
  })

  it('keeps the date off the rows and shows it on the page a row opens', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    // v0.37.2 — a row is the badge, the title and the lens; the date is one of the things
    // the page has room for. lang is 'it' here → day before month (12/07/26).
    expect(screen.queryByText(/12\/07\/26/)).not.toBeInTheDocument()

    const row = screen.getByText('Thunderstorm').closest('.match-log-row')
    fireEvent.click(row.querySelector('.match-log-row__info'))
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

    // (i) on the weather row → its card takes over the page
    const weatherRow = screen.getByText('Thunderstorm').closest('.match-log-row')
    fireEvent.click(weatherRow.querySelector('.match-log-row__info'))

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

    // RECOVERY carries no card → the row is named by the type label
    const recoveryRow = screen.getAllByText('matchLog.types.RECOVERY')[0].closest('.match-log-row')
    fireEvent.click(recoveryRow.querySelector('.match-log-row__info'))

    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getAllByText('matchLog.types.RECOVERY').length).toBeGreaterThan(0)
  })

  it('shows a SLEEP entry with the same sleep card GameBook uses (v0.30.3)', async () => {
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    // (i) on the sleep row → the preview page shows the same card, not just the type label
    const sleepRow = screen.getByText('game.sleep.confirmTitle').closest('.match-log-row')
    fireEvent.click(sleepRow.querySelector('.match-log-row__info'))

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

  it('asks for nothing at all without a match uuid', async () => {
    render(<MatchLogCard accessToken="tok" />)
    expect(getMatchLogs).not.toHaveBeenCalled()
  })

  it('falls back to the generic error text when the failure carries no message', async () => {
    getMatchLogs.mockRejectedValue({})
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('matchLog.error')).toBeInTheDocument()
  })

  it('treats a page with neither logs nor cursor as an empty history', async () => {
    getMatchLogs.mockResolvedValue({})
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    expect(await screen.findByText('matchLog.empty')).toBeInTheDocument()
  })

  it('gives an unknown entry type the neutral icon', async () => {
    getMatchLogs.mockResolvedValue({ ...PAGE, logs: [{ type: 'SOMETHING_NEW', clock: 1, timestamp: null }] })
    const { container } = render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')
    expect(container.querySelector('.fa-circle')).toBeTruthy()
  })

  it('reports a failure of the load-more call and stops asking once the cursor is spent', async () => {
    getMatchLogs
      .mockResolvedValueOnce({ ...PAGE, nextCursor: 'c1' })
      .mockRejectedValueOnce(new Error('page 2 is gone'))
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    fireEvent.click(document.querySelector('.match-log-more'))
    expect(await screen.findByText('page 2 is gone')).toBeInTheDocument()
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

describe('v0.35.4 — items and resources in the timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a row is a type badge, the card title and the lens — and nothing else', () => {
    const t = (k) => k
    const { container } = render(
      <LogEntryRow entry={{ type: 'EVENT', timestamp: '2026-07-12T10:02:00Z',
        card: { title: 'A Fork In The Road', urlImage: 'http://img/fork.png' } }}
        lang="it" t={t} onPreview={vi.fn()} />
    )

    const row = container.querySelector('.match-log-row')
    expect(row.querySelector('.match-log-row__type').textContent).toBe('matchLog.types.EVENT')
    expect(row.querySelector('.match-log-row__title').textContent).toBe('A Fork In The Road')
    expect(row.querySelector('.match-log-row__info')).toBeInTheDocument()
    // The picture and the date both belong to the page the lens opens, not to the row.
    expect(row.querySelector('img')).toBeNull()
    expect(row.textContent).not.toContain(formatLogDate('2026-07-12T10:02:00Z', 'it'))
  })

  it('a mission row is named and pictured by the mission card the backend sends', () => {
    const t = (k) => k
    const onPreview = vi.fn()
    const entry = { type: 'MISSION_CHANGE', timestamp: '2026-07-12T10:02:00Z',
      message: 'MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 7',
      idCard: 70, card: { title: 'The Journey', urlImage: 'http://img/journey.png' } }
    const { container } = render(
      <LogEntryRow entry={entry} lang="it" t={t} onPreview={onPreview} />)

    // v0.37.2 — the timeline resolves the mission's own card, so the row is not just
    // "Mission" twice over, and the lens opens the picture.
    expect(container.querySelector('.match-log-row__title').textContent).toBe('The Journey')
    fireEvent.click(container.querySelector('.match-log-row__info'))
    expect(onPreview).toHaveBeenCalledWith(entry)
  })

  it('a registry row says WHAT was written and carries no lens', () => {
    const t = (k) => k
    const { container, rerender } = render(
      <LogEntryRow lang="it" t={t} onPreview={vi.fn()}
        entry={{ type: 'REGISTRY_CHANGE', timestamp: '2026-07-12T10:02:00Z',
                 message: 'REGISTRY_CHANGE gate null -> open' }} />
    )

    expect(container.querySelector('.match-log-row__title').textContent)
      .toBe('gate null -> open')
    // There is no card behind a registry write, so a lens would open an empty page.
    expect(container.querySelector('.match-log-row__info')).toBeNull()

    // A row whose message the backend did not prefix is shown whole rather than swallowed.
    rerender(<LogEntryRow lang="it" t={t} onPreview={vi.fn()}
      entry={{ type: 'REGISTRY_CHANGE', message: 'clues +letter' }} />)
    expect(container.querySelector('.match-log-row__title').textContent).toBe('clues +letter')

    // And one with no message at all falls back to what it was.
    rerender(<LogEntryRow lang="it" t={t} onPreview={vi.fn()}
      entry={{ type: 'REGISTRY_CHANGE' }} />)
    expect(container.querySelector('.match-log-row__title').textContent)
      .toBe('matchLog.types.REGISTRY_CHANGE')
  })

  it('paints the type badge in the colour of its kind, and names an entry with no card', () => {
    const t = (k) => k
    const { container, rerender } = render(
      <LogEntryRow entry={{ type: 'MISSION_CHANGE', timestamp: null }}
        lang="it" t={t} onPreview={vi.fn()} />
    )
    const badge = container.querySelector('.match-log-row__type')
    // v0.37.2 — the mission gold; an entry with no card of its own is named by its type.
    expect(badge).toHaveStyle({ color: '#d4af37' })
    expect(container.querySelector('.match-log-row__title').textContent)
      .toBe('matchLog.types.MISSION_CHANGE')

    // An unknown type keeps the fallback glyph and takes no colour at all.
    rerender(<LogEntryRow entry={{ type: 'WHATEVER' }} lang="it" t={t} onPreview={vi.fn()} />)
    expect(container.querySelector('.match-log-row__type i').className)
      .toContain('fa-circle')
  })

  it('hands the whole entry to the lens, so the page knows what to open', () => {
    const t = (k) => k
    const onPreview = vi.fn()
    const entry = { type: 'EVENT', timestamp: '2026-07-12T10:02:00Z', card: { title: 'Fork' } }
    render(<LogEntryRow entry={entry} lang="it" t={t} onPreview={onPreview} />)

    fireEvent.click(screen.getByLabelText('card.info Fork'))

    expect(onPreview).toHaveBeenCalledWith(entry)
  })

  it('renders the three item types with their own card and label', async () => {
    getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 2, total: 3, limit: 50, nextCursor: null,
      logs: [
        { type: 'ITEM_ADD', timestamp: '2026-07-12T10:01:00Z', idItem: 900, itemAction: 'ADD',
          counter: 1, idEvent: 42, characterName: 'Ranger',
          idCard: 700, card: { title: 'Healing Potion', urlImage: 'http://img/potion.png' } },
        { type: 'ITEM_USE', timestamp: '2026-07-12T10:02:00Z', idItem: 900, itemAction: 'USE',
          counter: 2, characterName: 'Ranger', magicCost: 3, energyGain: 9,
          idCard: 700, card: { title: 'Healing Potion' } },
        { type: 'ITEM_DROP', timestamp: '2026-07-12T10:03:00Z', idItem: 901, itemAction: 'DROP',
          counter: 1, characterName: 'Ranger',
          idCard: 701, card: { title: 'Rusty Sword' } },
      ],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    expect(screen.getAllByText('matchLog.types.ITEM_ADD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('matchLog.types.ITEM_USE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('matchLog.types.ITEM_DROP').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Healing Potion').length).toBe(2)
    expect(screen.getByText('Rusty Sword')).toBeInTheDocument()
  })

  it('carries the same badges onto the page a row opens', async () => {
    getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 2, total: 1, limit: 50, nextCursor: null,
      logs: [
        { type: 'ITEM_USE', timestamp: '2026-07-12T10:02:00Z', idItem: 900, itemAction: 'USE',
          counter: 1, characterName: 'Ranger', magicCost: 3, energyGain: 9,
          idCard: 700, card: { title: 'Healing Potion' } },
      ],
    })
    render(<MatchLogCard matchUuid="m1" accessToken="tok" />)
    await screen.findByTestId('match-log-card')

    const row = screen.getByText('Healing Potion').closest('.match-log-row')
    fireEvent.click(row.querySelector('.match-log-row__info'))

    // The timeline is gone and the page carries both halves of the usage as badges.
    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getByTitle('game.stats.energy')).toHaveTextContent('+9')
    expect(screen.getByTitle('game.stats.magic')).toHaveTextContent('−3')
    // The type and the actor are NOT badges here — the page has room to say them in
    // words, so they lead the line under the card instead.
    expect(screen.queryByTitle('matchLog.character')).not.toBeInTheDocument()
    expect(screen.getByText('matchLog.types.ITEM_USE')).toBeInTheDocument()
    expect(screen.getByText(/Ranger/)).toBeInTheDocument()
  })

  it('resourceBadges carries the resources alone, with neither type nor actor', () => {
    const t = (k) => k
    const items = resourceBadges({ type: 'EVENT', coinCost: 7, coinGain: 30 }, t)
    expect(items.map(i => [i.key, i.prefix, i.value])).toEqual([
      ['coins', '−', 7],
      ['coins', '+', 30],
    ])
    expect(resourceBadges({ type: 'WEATHER' }, t)).toEqual([])
  })
})
