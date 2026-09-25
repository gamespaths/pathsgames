import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Step 40 — tips, env badge, match list restyle, history tiles, roadmap book.

const tr = { lang: 'en', dict: {} }
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: k => tr.dict[k] ?? k, lang: tr.lang, setLang: vi.fn() }),
}))
vi.mock('../api/matches', () => ({ getMatchLogs: vi.fn(), listMatches: vi.fn() }))
vi.mock('../api/stories', () => ({ getStory: vi.fn() }))

import Card from '../components/layout/Card'
import CardCreditsBar from '../components/layout/CardCreditsBar'
import TipNote from '../components/ui/TipNote'
import EnvBadge from '../components/layout/EnvBadge'
import MatchCard from '../features/matches/MatchCard'
import MatchStatusBadge from '../features/matches/MatchStatusBadge'
import MatchLogCard, { LogEntryRow } from '../features/matches/MatchLogCard'
import UserMatchesList from '../features/guest-user/UserMatchesList'
import { RoadmapCards } from '../components/modals/PolicyBook'
import { isTutorialStory, TUTORIAL_CATEGORY, ENV_BADGE } from '../constants/features'
import { formatDate, toEpochMs } from '../utils/dates'
import { MATCH_STATUS_BADGE, matchStatusGroup, sortMatchesForList } from '../utils/matchStatus'
import { roadmapCard, roadmapStatus, sortRoadmap } from '../utils/roadmap'
import roadmap from '../data/roadmap.json'
import { getMatchLogs, listMatches } from '../api/matches'
import { getStory } from '../api/stories'

const TIPS = { 'tips.location': 'Where you stand.', 'tips.event': 'Something to do.' }

beforeEach(() => {
  vi.clearAllMocks()
  tr.lang = 'en'
  tr.dict = { ...TIPS }
  Element.prototype.scrollIntoView = vi.fn()
})

const LOC = { uuid: 'l1', title: 'Square', description: 'A quiet square.' }

// ── A — tips ──────────────────────────────────────────────────────────────

describe('Card tips', () => {
  it('a page card with a tip text shows the link, opens, scrolls, focuses, hides and reopens', () => {
    render(<Card variant="page" card={LOC} entityType="location" />)
    expect(screen.queryByTestId('tip-note')).toBeNull()
    fireEvent.click(screen.getByText('card.tip'))
    const note = screen.getByTestId('tip-note')
    expect(note.textContent).toContain('Where you stand.')
    expect(note.closest('.book-page-desc')).toBeTruthy()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    expect(document.activeElement).toBe(note)
    fireEvent.click(screen.getByRole('button', { name: 'card.hideTip' }))
    expect(screen.queryByTestId('tip-note')).toBeNull()
    fireEvent.click(screen.getByText('card.tip'))
    expect(screen.getByTestId('tip-note')).toBeTruthy()
  })

  it('a type without a text shows no link and no tip; non-page cards never do', () => {
    const { rerender } = render(<Card variant="page" card={LOC} entityType="weather" />)
    expect(screen.queryByText('card.tip')).toBeNull()
    rerender(<Card variant="little" card={LOC} entityType="location" />)
    expect(screen.queryByText('card.tip')).toBeNull()
    rerender(<Card variant="page" card={LOC} />)
    expect(screen.queryByText('card.tip')).toBeNull()
  })

  it('a tutorial story opens the tip on every page, and a new card resets a hidden one', () => {
    const story = { category: 'TUTORIAL' }
    const { rerender } = render(<Card variant="page" card={LOC} entityType="location" story={story} />)
    expect(screen.getByTestId('tip-note')).toBeTruthy()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'card.hideTip' }))
    expect(screen.queryByTestId('tip-note')).toBeNull()
    rerender(<Card variant="page" card={{ uuid: 'e1', title: 'Fight' }} entityType="event" story={story} />)
    expect(screen.getByTestId('tip-note').textContent).toContain('Something to do.')
  })

  it('the tip opens even on a card with no description', () => {
    render(<Card variant="page" card={{ uuid: 'l2', title: 'Empty' }} entityType="location" />)
    fireEvent.click(screen.getByText('card.tip'))
    expect(screen.getByTestId('tip-note')).toBeTruthy()
  })

  it('isTutorialStory reads the category case-insensitively', () => {
    expect(TUTORIAL_CATEGORY).toBe('tutorial')
    expect(isTutorialStory({ category: ' Tutorial ' })).toBe(true)
    expect(isTutorialStory({ category: 'adventure' })).toBe(false)
    expect(isTutorialStory(null)).toBe(false)
    expect(isTutorialStory({ category: 'x' }, '')).toBe(false)
  })
})

describe('CardCreditsBar and TipNote', () => {
  it('renders for a tip alone, and the link opens it', () => {
    const onOpen = vi.fn()
    render(<CardCreditsBar card={{}} story={null} typeBadgeLabel="Location"
      tip={{ label: 'tip', onOpen }} />)
    fireEvent.click(screen.getByText('tip'))
    expect(onOpen).toHaveBeenCalled()
    expect(screen.queryByText('-')).toBeNull()
  })

  it('still renders nothing with no author, no credit and no tip', () => {
    const { container } = render(<CardCreditsBar card={{}} story={null} typeBadgeLabel="Location" />)
    expect(container.firstChild).toBeNull()
  })

  it('TipNote does not scroll without a focus key and calls onHide', () => {
    const onHide = vi.fn()
    render(<TipNote text="Hello" hideLabel="hide" onHide={onHide} />)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    const hide = screen.getByRole('button', { name: 'hide' })
    expect(hide.getAttribute('title')).toBe('hide')
    expect(hide.textContent).toBe('')
    expect(hide.querySelector('.fa-eye-slash')).toBeTruthy()
    fireEvent.click(hide)
    expect(onHide).toHaveBeenCalled()
  })
})

// ── C — env badge ─────────────────────────────────────────────────────────

describe('EnvBadge', () => {
  it('translates a known code in EN and IT', () => {
    tr.dict = { 'envBadge.dev': 'Local' }
    const { rerender } = render(<EnvBadge code="dev" />)
    expect(screen.getByTestId('env-badge').textContent).toBe('Local')
    tr.dict = { 'envBadge.dev': 'Locale' }
    rerender(<EnvBadge code="DEV" />)
    expect(screen.getByTestId('env-badge').textContent).toBe('Locale')
  })

  it('shows an unknown code upper-cased, and nothing when empty or prod', () => {
    const { rerender, container } = render(<EnvBadge code="gamma" />)
    expect(screen.getByTestId('env-badge').textContent).toBe('GAMMA')
    rerender(<EnvBadge code="" />)
    expect(container.firstChild).toBeNull()
    rerender(<EnvBadge code="prod" />)
    expect(container.firstChild).toBeNull()
    rerender(<EnvBadge code={null} />)
    expect(container.firstChild).toBeNull()
    // Without a code it follows the build's VITE_ENV_BADGE (set or not in the local .env).
    rerender(<EnvBadge />)
    const env = String(ENV_BADGE).trim().toLowerCase()
    if (!env || env === 'prod') expect(container.firstChild).toBeNull()
    else expect(screen.getByTestId('env-badge').className).toContain(`env-badge--${env}`)
  })
})

// ── E — match list, history tiles, dates ──────────────────────────────────

describe('MatchCard (Step 40)', () => {
  const STORY = { uuid: 's1', title: 'Keep', card: { title: 'Keep' } }

  it.each([
    ['RUNNING', 'matches.resume'], ['CREATED', 'matches.resume'],
    ['PAUSED', 'matches.logOpen'], ['ENDED', 'matches.logOpen'], ['GAMEOVER', 'matches.logOpen'],
  ])('%s shows its badge and one button (%s)', (status, button) => {
    render(<MemoryRouter><MatchCard match={{ uuid: 'm1', status }} story={STORY}
      onResume={vi.fn()} onHistory={vi.fn()} /></MemoryRouter>)
    const badge = screen.getByTestId('match-status-badge')
    expect(badge.textContent).toBe(`matches.status.${status}`)
    expect(badge.classList.contains('story-card-status')).toBe(true)
    expect(badge.classList.contains(`story-card-status--${MATCH_STATUS_BADGE[status].tone}`)).toBe(true)
    expect(badge.classList.contains('story-card-status--center')).toBe(true)
    expect(badge.classList.contains('stat-badge') && badge.classList.contains('bonus-badge')).toBe(true)
    expect(badge.querySelector('i')).toBeTruthy()
    expect(screen.getByText(button)).toBeTruthy()
  })

  it.each(['PAUSED', 'ENDED', 'GAMEOVER'])('%s shows a small Missions icon + a wide Log button, no (i)', (status) => {
    const onPreviewCard = vi.fn()
    const onHistory = vi.fn()
    render(<MemoryRouter><MatchCard match={{ uuid: 'm1', status }} story={STORY}
      onPreviewCard={onPreviewCard} onHistory={onHistory} /></MemoryRouter>)
    expect(screen.queryByLabelText('card.info')).toBeNull()
    const missions = screen.getByLabelText('game.missions.openAction')
    expect(missions.textContent.trim()).toBe('')
    expect(missions.classList.contains('gc-footer__btn--icon')).toBe(true)
    expect(missions.querySelector('.fa-clipboard-list')).toBeTruthy()
    fireEvent.click(missions)
    expect(onPreviewCard).toHaveBeenCalledWith(expect.objectContaining({ match: { uuid: 'm1', status }, missionsOnly: true }))
    const log = screen.getByText('matches.logOpen').closest('button')
    expect(log.querySelector('.fa-history')).toBeTruthy()
    fireEvent.click(log)
    expect(onHistory).toHaveBeenCalledWith(expect.objectContaining({ match: { uuid: 'm1', status } }))
    expect(onHistory.mock.calls[0][0].missionsOnly).toBeUndefined()
  })

  it.each(['RUNNING', 'CREATED'])('%s keeps the (i) button and no Missions button', (status) => {
    const onPreviewCard = vi.fn()
    render(<MemoryRouter><MatchCard match={{ uuid: 'm1', status }} story={STORY}
      onPreviewCard={onPreviewCard} onResume={vi.fn()} onHistory={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByLabelText('game.missions.openAction')).toBeNull()
    expect(screen.getByText('matches.resume').closest('button').querySelector('.fa-hand-pointer')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('card.info'))
    expect(onPreviewCard.mock.calls[0][0].missionsOnly).toBeUndefined()
  })

  it('History hands the match info over', () => {
    const onHistory = vi.fn()
    render(<MemoryRouter><MatchCard match={{ uuid: 'm1', status: 'ENDED' }} story={STORY}
      onHistory={onHistory} /></MemoryRouter>)
    fireEvent.click(screen.getByText('matches.logOpen'))
    expect(onHistory).toHaveBeenCalledWith(expect.objectContaining({ match: { uuid: 'm1', status: 'ENDED' } }))
  })

  it('an unknown status gets the neutral tone and no glyph; inline drops the centring', () => {
    const { rerender } = render(<MatchStatusBadge status="WEIRD" />)
    const badge = screen.getByTestId('match-status-badge')
    expect(badge.classList.contains('story-card-status--paused')).toBe(true)
    expect(badge.querySelector('i')).toBeNull()
    rerender(<MatchStatusBadge status="ENDED" inline />)
    const inline = screen.getByTestId('match-status-badge')
    expect(inline.classList.contains('story-card-status--inline')).toBe(true)
    expect(inline.classList.contains('story-card-status--center')).toBe(false)
  })
})

describe('match status helpers and list order', () => {
  it('groups active, paused, finished, other and sorts newest first inside', () => {
    expect([matchStatusGroup('RUNNING'), matchStatusGroup('PAUSED'), matchStatusGroup('ENDED'),
      matchStatusGroup('X')]).toEqual([0, 1, 2, 3])
    expect(MATCH_STATUS_BADGE.GAMEOVER.icon).toContain('story-card-status__defeat')
    const list = [
      { uuid: 'old-end', status: 'ENDED', tsInsert: '2026-01-01T00:00:00Z' },
      { uuid: 'paused', status: 'PAUSED', tsInsert: 5 },
      { uuid: 'new-end', status: 'GAMEOVER', tsInsert: 1767312000000 },
      { uuid: 'run', status: 'RUNNING', tsInsert: null },
      { uuid: 'new-run', status: 'CREATED', tsInsert: '2026-09-01T00:00:00Z' },
    ]
    expect(sortMatchesForList(list, toEpochMs).map(m => m.uuid))
      .toEqual(['new-run', 'run', 'paused', 'new-end', 'old-end'])
    expect(sortMatchesForList(null)).toEqual([])
    expect(sortMatchesForList(list).length).toBe(5)
  })

  it('UserMatchesList renders the sorted list and wires History', async () => {
    listMatches.mockResolvedValue([
      { uuid: 'm-end', storyUuid: 's1', status: 'ENDED', tsInsert: '2026-05-01T10:00:00Z' },
      { uuid: 'm-run', storyUuid: 's2', status: 'RUNNING', tsInsert: '2026-04-01T10:00:00Z' },
    ])
    getStory.mockImplementation(uuid => Promise.resolve({ uuid, title: `T-${uuid}`, card: { title: `T-${uuid}` } }))
    const onOpenHistory = vi.fn()
    render(<MemoryRouter><UserMatchesList accessToken="tok" onOpenHistory={onOpenHistory} /></MemoryRouter>)
    await screen.findByText('T-s1')
    const titles = [...document.querySelectorAll('.gc-title__text')].map(e => e.textContent)
    expect(titles).toEqual(['T-s2', 'T-s1'])
    fireEvent.click(screen.getByText('matches.logOpen'))
    expect(onOpenHistory).toHaveBeenCalledWith(expect.objectContaining({ match: expect.objectContaining({ uuid: 'm-end' }) }))
  })
})

describe('dates', () => {
  it('reads ISO strings, epoch-ms numbers and digit strings; rejects the rest', () => {
    expect(toEpochMs('2026-01-01T00:00:00Z')).toBe(Date.UTC(2026, 0, 1))
    expect(toEpochMs(1767225600000)).toBe(1767225600000)
    expect(toEpochMs('1767225600000')).toBe(1767225600000)
    expect(toEpochMs(null)).toBeNull()
    expect(toEpochMs('')).toBeNull()
    expect(toEpochMs('garbage')).toBeNull()
    expect(toEpochMs(Number.NaN)).toBeNull()
  })

  it('formats in the language locale, with or without the time; null when unreadable', () => {
    expect(formatDate('2026-01-01T12:00:00Z', 'en')).toMatch(/2026/)
    expect(formatDate(1767225600000, 'it', false)).toMatch(/2026/)
    expect(formatDate(undefined, 'en')).toBeNull()
    expect(formatDate('nope', 'en')).toBeNull()
    expect(formatDate(1767225600000, 'xx-invalid-!!')).toMatch(/2026/)
  })
})

describe('MatchLogCard status and creation tiles', () => {
  const MATCH = { status: 'ENDED', tsInsert: '2026-05-01T10:00:00Z' }
  const ENTRY = { type: 'EVENT', timestamp: '2026-05-01T10:05:00Z', card: { title: 'Gate' } }

  it('status first, creation last once the last page is in', async () => {
    getMatchLogs.mockResolvedValue({ logs: [ENTRY], nextCursor: null })
    render(<MatchLogCard matchUuid="m1" accessToken="t" match={MATCH} />)
    await screen.findByTestId('match-log-card')
    const rows = [...document.querySelectorAll('.match-log-list > li')]
    expect(rows[0].dataset.testid).toBe('match-log-status')
    expect(rows[rows.length - 1].dataset.testid).toBe('match-log-creation')
    expect(rows[rows.length - 1].textContent).toContain('matchLog.creation')
  })

  it('no creation tile while more pages wait, nor without a date', async () => {
    getMatchLogs.mockResolvedValue({ logs: [ENTRY], nextCursor: 'c1' })
    const { unmount } = render(<MatchLogCard matchUuid="m1" accessToken="t" match={MATCH} />)
    await screen.findByTestId('match-log-card')
    expect(screen.queryByTestId('match-log-creation')).toBeNull()
    unmount()
    getMatchLogs.mockResolvedValue({ logs: [], nextCursor: null })
    render(<MatchLogCard matchUuid="m1" accessToken="t" match={{ status: 'RUNNING' }} />)
    await screen.findByTestId('match-log-status')
    expect(screen.queryByTestId('match-log-creation')).toBeNull()
    expect(screen.queryByText('matchLog.empty')).toBeNull()
  })

  it('without a match summary the empty state is unchanged', async () => {
    getMatchLogs.mockResolvedValue({ logs: [], nextCursor: null })
    render(<MatchLogCard matchUuid="m1" accessToken="t" />)
    expect(await screen.findByText('matchLog.empty')).toBeTruthy()
  })

  it('a CHOICE row gets its own icon', () => {
    render(<ul><LogEntryRow entry={{ type: 'CHOICE', card: { title: 'Fork' } }} lang="en"
      t={k => k} onPreview={vi.fn()} /></ul>)
    expect(document.querySelector('.fa-code-branch')).toBeTruthy()
    expect(screen.getByText('matchLog.types.CHOICE')).toBeTruthy()
  })
})

// ── F — roadmap book ──────────────────────────────────────────────────────

describe('roadmap', () => {
  it('roadmap.json holds six versions V0-V5, one current', () => {
    expect(roadmap.map(r => r.id)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4', 'v5'])
    expect(roadmap.filter(r => r.status === 'current').length).toBe(1)
  })

  it('sorts completed → current → planned keeping json order, unknown counts as planned', () => {
    const entries = [
      { id: 'a', status: 'planned' }, { id: 'b', status: 'weird' }, { id: 'c', status: 'current' },
      { id: 'd', status: 'Completed' }, { id: 'e' },
    ]
    expect(sortRoadmap(entries).map(e => e.id)).toEqual(['d', 'c', 'a', 'b', 'e'])
    expect(roadmapStatus({ status: 'x' })).toBe('planned')
    expect(sortRoadmap(null)).toEqual([])
  })

  it('a missing or unknown image falls back to home', () => {
    const home = roadmapCard({ id: 'z', title: 'Z', imgId: 'no-such-image' })
    expect(home.urlImage).toBe(roadmapCard({ id: 'h', imgId: 'home' }).urlImage)
    expect(roadmapCard({ id: 'q' }).title).toBe('q')
  })

  it('renders one card per version, the badge on the current one only, and opens its link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const t = k => k
    render(<RoadmapCards t={t} entries={[
      { id: 'p', title: 'Beta', status: 'planned', imgId: 'person', link: 'https://x/beta' },
      { id: 'c', title: 'Alpha', status: 'current', imgId: 'map', link: 'https://x/alpha' },
    ]} />)
    const titles = [...document.querySelectorAll('.gc-title__text')].map(e => e.textContent)
    expect(titles).toEqual(['Alpha', 'Beta'])
    expect(screen.getAllByTestId('roadmap-current').length).toBe(1)
    expect(screen.getByTestId('roadmap-current').className)
      .toBe('story-card-status story-card-status--active story-card-status--center stat-badge bonus-badge')
    fireEvent.click(screen.getAllByText('modals.roadmap.button')[1])
    expect(open).toHaveBeenCalledWith('https://x/beta', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })

  it('the default entries are the six of roadmap.json', async () => {
    render(<RoadmapCards t={k => k} />)
    await waitFor(() => expect(document.querySelectorAll('.gc-title__text').length).toBe(6))
  })
})
