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

  // Step 28.7 — (i) on a match: story card left, match history right.
  it('opens the match history on the right page when a match is previewed', () => {
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('ts-success'))
    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('preview-match'))

    // right page: the log for that match, in place of the matches list
    expect(screen.getByTestId('match-log-card')).toBeInTheDocument()
    expect(screen.getByText('log:m1')).toBeInTheDocument()
    expect(screen.queryByText('preview-match')).not.toBeInTheDocument()
    // left page: the story card (unchanged behaviour)
    expect(screen.getAllByText('Prev').length).toBeGreaterThan(0)

    // the log's back arrow restores the matches list
    fireEvent.click(screen.getByText('log-back'))
    expect(screen.queryByTestId('match-log-card')).not.toBeInTheDocument()
    expect(screen.getByText('preview-match')).toBeInTheDocument()
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
