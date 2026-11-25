import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../utils/turnstile', () => ({
  CF_KEY: 'test-key',
  TURNSTILE_APPEARANCE: { guest: 'always' },
  isTurnstilePassValid: () => false,
  recordTurnstilePass: vi.fn(),
}))

const guestCtx = {
  user: { username: 'guest_x', accessToken: 't' },
  loading: false,
  matches: null,
}
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => guestCtx }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, pageKey, direction }) => (
    <div data-testid="book" data-key={pageKey} data-direction={direction ?? 'none'}>{left}{right}</div>
  ),
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, onClose }) => (
    <div data-testid="bpc">
      {card?.title}
      {onClose && <button onClick={onClose}>bpc-close</button>}
    </div>
  ),
}))
vi.mock('@/features/guest-user/UserMatchesList', () => ({
  default: ({ onPreviewCard, preloadedMatches, onOpenPreferences }) => (
    <>
      <span data-testid="preloaded">{preloadedMatches ? preloadedMatches.length : 'none'}</span>
      <button onClick={onOpenPreferences}>open-preferences</button>
      <button onClick={() => onPreviewCard({ card: { title: 'Prev' }, story: { title: 'S' } })}>preview</button>
      <button onClick={() => onPreviewCard({
        card: { title: 'Prev' }, story: { title: 'S' }, match: { uuid: 'm1' },
      })}>preview-match</button>
    </>
  ),
}))
vi.mock('@/features/matches/MatchLogCard', () => ({
  default: ({ matchUuid, onBack }) => (
    <div data-testid="match-log-card">
      log:{matchUuid}
      <button onClick={onBack}>log-back</button>
    </div>
  ),
}))
// v0.37.4 — the missions of the previewed match, read on their own for the profile book.
const missionsState = { missions: [], loading: false }
vi.mock('@/features/matches/useMatchMissions', () => ({
  default: (uuid) => uuid ? missionsState : { missions: [], loading: false },
}))
vi.mock('@/features/gameplay/cards/MissionCards', () => ({
  default: ({ missions, onOpenMission, children }) => (
    <div data-testid="mission-cards">
      {missions.map(m => (
        <button key={m.uuid} onClick={() => onOpenMission({ mission: m, card: { title: m.name }, stats: [] })}>
          open:{m.name}
        </button>
      ))}
      {children}
    </div>
  ),
}))
vi.mock('@/features/gameplay/cards/MissionStepsCards', () => ({
  default: ({ mission, onPreview }) => (
    <div data-testid="mission-steps">
      steps:{mission.name}
      <button onClick={() => onPreview({ card: { title: 'Step one' }, type: 'missions' })}>step-info</button>
      <button onClick={() => onPreview({ card: null })}>step-none</button>
    </div>
  ),
}))
vi.mock('@/features/matches/MatchHistoryCard', () => ({
  default: ({ onOpen }) => <button onClick={onOpen}>history-card</button>,
}))
vi.mock('@/components/layout/LoadingCard', () => ({
  default: () => <div data-testid="loading-card" />,
}))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div /> }))
vi.mock('@/features/preferences/PreferencesEditor', () => ({
  default: ({ onBack }) => <div data-testid="preferences-editor"><button onClick={onBack}>prefs-back</button></div>,
}))
vi.mock('../components/ui/TurnstileWidget', () => ({
  default: ({ onSuccess, onError, onExpire }) => (
    <div>
      <button onClick={onSuccess}>ts-success</button>
      <button onClick={onError}>ts-error</button>
      <button onClick={onExpire}>ts-expire</button>
    </div>
  ),
}))

import PlayerBook from '@/features/guest-user/PlayerBook'

describe('PlayerBook (antibot + preview)', () => {
  beforeEach(() => { guestCtx.matches = null })

  it('starts in checking, shows error + retry on Turnstile failure', () => {
    render(<PlayerBook />)
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ts-error'))
    expect(screen.getByText('antibot.error')).toBeInTheDocument()
    fireEvent.click(screen.getByText('startMatch.retry'))
    // retry → back to checking
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
  })

  it('step 16 — the preferences card opens the editor on the right page (forward), its back arrow turns back', () => {
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    const before = Number(screen.getByTestId('book').dataset.key)
    fireEvent.click(screen.getByText('open-preferences'))
    expect(screen.getByTestId('preferences-editor')).toBeInTheDocument()
    expect(screen.queryByText('preview-match')).not.toBeInTheDocument()
    expect(screen.getByTestId('book')).toHaveAttribute('data-direction', 'forward')
    expect(Number(screen.getByTestId('book').dataset.key)).toBe(before + 1)
    // the left page (the user card) stays
    expect(screen.getByText('guest_x')).toBeInTheDocument()
    fireEvent.click(screen.getByText('prefs-back'))
    expect(screen.queryByTestId('preferences-editor')).not.toBeInTheDocument()
    expect(screen.getByText('preview-match')).toBeInTheDocument()
    expect(screen.getByTestId('book')).toHaveAttribute('data-direction', 'back')
  })

  // v0.37.4 — (i) on a match: story card left, the match's MISSIONS right, the history a
  // card among them.
  it('opens the missions on the right page when a match is previewed, the history behind a card', () => {
    missionsState.missions = [{ uuid: 'q1', name: 'Quest' }]
    missionsState.loading = false
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    expect(screen.queryByTestId('mission-cards')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('preview-match'))

    // right page: the missions grid, in place of the matches list — no history yet
    expect(screen.getByTestId('mission-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.queryByText('preview-match')).not.toBeInTheDocument()
    // left page: the story card
    expect(screen.getAllByText('Prev').length).toBeGreaterThan(0)

    // the history card opens the log; its back arrow returns to the missions, not the list
    fireEvent.click(screen.getByText('history-card'))
    expect(screen.getByText('log:m1')).toBeInTheDocument()
    fireEvent.click(screen.getByText('log-back'))
    expect(screen.getByTestId('mission-cards')).toBeInTheDocument()

    // the story card's back arrow restores the matches list
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    expect(screen.queryByTestId('mission-cards')).not.toBeInTheDocument()
    expect(screen.getByText('preview-match')).toBeInTheDocument()
  })

  it('opens one mission down to its steps, a step to its card, and back one page at a time', () => {
    missionsState.missions = [{ uuid: 'q1', name: 'Quest' }]
    missionsState.loading = false
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    fireEvent.click(screen.getByText('preview-match'))

    fireEvent.click(screen.getByText('open:Quest'))
    // left: the mission card; right: its steps
    expect(screen.getByText('steps:Quest')).toBeInTheDocument()
    expect(screen.getAllByText('Quest').length).toBeGreaterThan(0)

    // a step's (i) reads on the right page, and closes back to the steps
    fireEvent.click(screen.getByText('step-info'))
    expect(screen.getByText('Step one')).toBeInTheDocument()
    expect(screen.queryByText('steps:Quest')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByText('bpc-close').pop())
    expect(screen.getByText('steps:Quest')).toBeInTheDocument()
    // a (i) with no card closes nothing
    fireEvent.click(screen.getByText('step-none'))
    expect(screen.getByText('steps:Quest')).toBeInTheDocument()

    // the mission card's back arrow returns to the missions grid
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    expect(screen.getByTestId('mission-cards')).toBeInTheDocument()
    expect(screen.queryByText('steps:Quest')).not.toBeInTheDocument()
  })

  it('shows the loading card while the missions are on their way', () => {
    missionsState.missions = []
    missionsState.loading = true
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    fireEvent.click(screen.getByText('preview-match'))
    expect(screen.getByTestId('loading-card')).toBeInTheDocument()
    expect(screen.queryByTestId('mission-cards')).not.toBeInTheDocument()
  })

  it('passes Turnstile then shows matches; previewing swaps + closes the left page', () => {
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    // human → matches list visible
    fireEvent.click(screen.getByText('preview'))
    expect(screen.getAllByText('Prev').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    // back to identity card → preview button visible again
    expect(screen.getByText('preview')).toBeInTheDocument()
  })

  it('expire triggers a fresh antibot check', () => {
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-expire'))
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
  })

  it('v1.13.0 — reads the preloaded list once: the page clearing the context copy does not refetch', () => {
    guestCtx.matches = [{ uuid: 'm1' }, { uuid: 'm2' }]
    const { rerender } = render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    expect(screen.getByTestId('preloaded').textContent).toBe('2')
    guestCtx.matches = null
    rerender(<PlayerBook />)
    expect(screen.getByTestId('preloaded').textContent).toBe('2')
  })

  it('v1.13.0 — always renders: the /player route decides when it shows', () => {
    const { container } = render(<PlayerBook />)
    expect(container.firstChild).not.toBeNull()
  })
})

// Step 15 — the player page turns: a match, a mission, the history forward; every back arrow back; a step (i) fades.
describe('PlayerBook — page turns', () => {
  const book = () => screen.getByTestId('book')

  it('forward into a match, its mission and the history; back out one page at a time; a step fades', () => {
    missionsState.missions = [{ uuid: 'q1', name: 'Quest' }]
    missionsState.loading = false
    render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    expect(book().dataset).toMatchObject({ key: '0', direction: 'none' })
    fireEvent.click(screen.getByText('preview-match'))
    expect(book().dataset).toMatchObject({ key: '1', direction: 'forward' })
    fireEvent.click(screen.getByText('open:Quest'))
    expect(book().dataset).toMatchObject({ key: '2', direction: 'forward' })
    fireEvent.click(screen.getByText('step-info'))
    expect(book().dataset).toMatchObject({ key: '3', direction: 'fade' })
    fireEvent.click(screen.getAllByText('bpc-close').at(-1))
    expect(book().dataset).toMatchObject({ key: '4', direction: 'fade' })
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    expect(book().dataset).toMatchObject({ key: '5', direction: 'back' })
    fireEvent.click(screen.getByText('history-card'))
    expect(book().dataset).toMatchObject({ key: '6', direction: 'forward' })
    fireEvent.click(screen.getByText('log-back'))
    expect(book().dataset).toMatchObject({ key: '7', direction: 'back' })
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    expect(book().dataset).toMatchObject({ key: '8', direction: 'back' })
  })

  it('missions loading → loaded is no turn', () => {
    missionsState.missions = []
    missionsState.loading = true
    const { rerender } = render(<PlayerBook />)
    fireEvent.click(screen.getByText('ts-success'))
    fireEvent.click(screen.getByText('preview-match'))
    expect(screen.getByTestId('loading-card')).toBeInTheDocument()
    missionsState.loading = false
    rerender(<PlayerBook />)
    expect(book().dataset).toMatchObject({ key: '1', direction: 'forward' })
  })
})
