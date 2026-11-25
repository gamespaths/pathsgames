import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => <div data-testid="turnstile-mock" /> }))

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockUser = { username: 'guest_u1', accessToken: 'tok' }
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: mockUser, loading: false }),
}))

// The real Book: v1.14.0 one tree, the phone stacks these very two pages.
vi.mock('../components/layout/Card', () => ({ default: () => <div data-testid="book-page" /> }))
vi.mock('@/features/guest-user/UserMatchesList', () => ({ default: () => <div data-testid="matches-list" /> }))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div data-testid="lang-sel" /> }))

import PlayerBook from '@/features/guest-user/PlayerBook'

describe('PlayerBook — one tree (v1.14.0)', () => {
  it('renders the user page and the matches once, left page then right page of the same book', () => {
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    const { container } = render(<PlayerBook />)
    expect(screen.getAllByTestId('book-page')).toHaveLength(1)
    expect(screen.getAllByTestId('matches-list')).toHaveLength(1)
    const left = screen.getByTestId('book-page').closest('.book-page-left')
    const right = screen.getByTestId('matches-list').closest('.book-page-right')
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.book-mobile-layout, .book-mobile-left, .book-mobile-right')).toBeNull()
  })
})
