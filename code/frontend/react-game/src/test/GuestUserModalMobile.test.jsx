import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => <div data-testid="turnstile-mock" /> }))

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockUser = { username: 'guest_u1', accessToken: 'tok' }
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: mockUser, loading: false, guestModalOpen: true, closeGuestModal: vi.fn() }),
}))

// Only the mobile column is rendered, to check its wrappers.
vi.mock('../components/book/Book', () => ({ default: ({ mobile }) => <div>{mobile}</div> }))
vi.mock('../components/layout/Card', () => ({ default: () => <div data-testid="book-page" /> }))
vi.mock('@/features/guest-user/UserMatchesList', () => ({ default: () => <div data-testid="matches-list" /> }))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div data-testid="lang-sel" /> }))

import GuestUserModal from '@/features/guest-user/GuestUserModal'

describe('GuestUserModal — mobile column', () => {
  it('stacks the user page and the matches in the game\'s mobile wrappers (same side margins)', () => {
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    render(<GuestUserModal />)
    const left = screen.getByTestId('book-page').parentElement
    expect(left).toHaveClass('book-mobile-left')
    expect(left.parentElement).toHaveClass('book-mobile-layout')
    expect(screen.getByTestId('matches-list').closest('.book-mobile-right')).not.toBeNull()
  })
})
