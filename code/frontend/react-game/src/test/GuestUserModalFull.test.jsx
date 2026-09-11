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
  guestModalOpen: true,
  closeGuestModal: vi.fn(),
  matches: null,
}
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => guestCtx }))
vi.mock('../components/book/Book', () => ({ default: ({ left, right }) => <div>{left}{right}</div> }))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, onClose }) => (
    <div data-testid="bpc">
      {card?.title}
      {onClose && <button onClick={onClose}>bpc-close</button>}
    </div>
  ),
}))
vi.mock('@/features/guest-user/UserMatchesList', () => ({
  default: ({ onPreviewCard }) => (
    <>
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
vi.mock('../components/ui/TurnstileWidget', () => ({
  default: ({ onSuccess, onError, onExpire }) => (
    <div>
      <button onClick={onSuccess}>ts-success</button>
      <button onClick={onError}>ts-error</button>
      <button onClick={onExpire}>ts-expire</button>
    </div>
  ),
}))

import GuestUserModal from '@/features/guest-user/GuestUserModal'

describe('GuestUserModal (antibot + preview)', () => {
  beforeEach(() => { guestCtx.closeGuestModal.mockClear() })

  it('starts in checking, shows error + retry on Turnstile failure', () => {
    render(<GuestUserModal />)
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ts-error'))
    expect(screen.getByText('antibot.error')).toBeInTheDocument()
    fireEvent.click(screen.getByText('startMatch.retry'))
    // retry → back to checking
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
  })

  // v0.37.4 — (i) on a match: story card left, the match's MISSIONS right, the history a
  // card among them.
  it('opens the missions on the right page when a match is previewed, the history behind a card', () => {
    missionsState.missions = [{ uuid: 'q1', name: 'Quest' }]
    missionsState.loading = false
    render(<GuestUserModal />)
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
    render(<GuestUserModal />)
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
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('ts-success'))
    fireEvent.click(screen.getByText('preview-match'))
    expect(screen.getByTestId('loading-card')).toBeInTheDocument()
    expect(screen.queryByTestId('mission-cards')).not.toBeInTheDocument()
  })

  it('passes Turnstile then shows matches; previewing swaps + closes the left page', () => {
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('ts-success'))
    // human → matches list visible
    fireEvent.click(screen.getByText('preview'))
    expect(screen.getAllByText('Prev').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('bpc-close')[0])
    // back to identity card → preview button visible again
    expect(screen.getByText('preview')).toBeInTheDocument()
  })

  it('expire triggers a fresh antibot check', () => {
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('ts-expire'))
    expect(screen.getByText('antibot.verifying')).toBeInTheDocument()
  })

  it('renders nothing when the modal is closed', () => {
    guestCtx.guestModalOpen = false
    const { container } = render(<GuestUserModal />)
    expect(container.firstChild).toBeNull()
    guestCtx.guestModalOpen = true
  })
})
