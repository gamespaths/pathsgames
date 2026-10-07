import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Step 40 — History opens the big timeline straight from the list; its back arrow returns there.

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../utils/turnstile', () => ({
  CF_KEY: '', TURNSTILE_APPEARANCE: { guest: 'always' },
  isTurnstilePassValid: () => true, recordTurnstilePass: vi.fn(),
}))
const guestCtx = { user: { username: 'g', accessToken: 't' }, loading: false,
  guestModalOpen: true, closeGuestModal: vi.fn(), matches: null }
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => guestCtx }))
vi.mock('../components/book/Book', () => ({ default: ({ left, right }) => <div>{left}{right}</div> }))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, onClose }) => <div data-testid="bpc">{card?.title}{onClose && <button onClick={onClose}>bpc-close</button>}</div>,
}))
vi.mock('@/features/guest-user/UserMatchesList', () => ({
  default: ({ onOpenHistory, onPreviewCard }) => (<>
    <button onClick={() => onOpenHistory({ card: { title: 'Story' }, story: { title: 'S' },
      match: { uuid: 'm9', status: 'ENDED', tsInsert: 1 } })}>history-from-list</button>
    <button onClick={() => onPreviewCard({ card: { title: 'Story' }, story: { title: 'S' },
      match: { uuid: 'm9', status: 'ENDED' }, missionsOnly: true })}>missions-from-list</button>
    <button onClick={() => onPreviewCard({ card: { title: 'Story' }, story: { title: 'S' },
      match: { uuid: 'm8', status: 'RUNNING' } })}>info-from-list</button>
  </>),
}))
vi.mock('@/features/matches/MatchLogCard', () => ({
  default: ({ matchUuid, match, onBack }) => (
    <div data-testid="match-log-card">log:{matchUuid}:{match?.status}<button onClick={onBack}>log-back</button></div>
  ),
}))
vi.mock('@/features/matches/useMatchMissions', () => ({ default: () => ({ missions: [], loading: false }) }))
vi.mock('@/features/gameplay/cards/MissionCards', () => ({ default: ({ children }) => <div data-testid="mission-cards">{children}</div> }))
vi.mock('@/features/gameplay/cards/MissionStepsCards', () => ({ default: () => <div /> }))
vi.mock('@/features/matches/MatchHistoryCard', () => ({ default: () => <div data-testid="small-history" /> }))
vi.mock('@/components/layout/LoadingCard', () => ({ default: () => <div /> }))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div /> }))

import GuestUserModal from '@/features/guest-user/GuestUserModal'

describe('GuestUserModal — History from the list (Step 40)', () => {
  it('opens the big history page directly, with the match summary, and back to the list', () => {
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('history-from-list'))
    expect(screen.getByText('log:m9:ENDED')).toBeInTheDocument()
    expect(screen.queryByTestId('mission-cards')).not.toBeInTheDocument()
    expect(screen.getByText('Story')).toBeInTheDocument()
    fireEvent.click(screen.getByText('log-back'))
    expect(screen.getByText('history-from-list')).toBeInTheDocument()
    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
  })

  it('the Missions icon opens the missions without the small History card; (i) keeps it', () => {
    const { unmount } = render(<GuestUserModal />)
    fireEvent.click(screen.getByText('missions-from-list'))
    expect(screen.getByTestId('mission-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('small-history')).not.toBeInTheDocument()
    unmount()
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('info-from-list'))
    expect(screen.getByTestId('small-history')).toBeInTheDocument()
  })
})
