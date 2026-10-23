// v1.7.0 V1 step 7 — the user's book opens the profile page in place of the matches list.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../utils/turnstile', async (importOriginal) => ({ ...(await importOriginal()), CF_KEY: '' }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))
const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, onClose }) => <div>{left}{right}<button onClick={onClose}>close-book</button></div>,
}))
vi.mock('../components/layout/Card', () => ({ default: ({ extraContent }) => <div data-testid="card">{extraContent}</div> }))
vi.mock('@/features/guest-user/UserMatchesList', () => ({ default: () => <div data-testid="matches-list" /> }))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div data-testid="lang-sel" /> }))
vi.mock('@/features/guest-user/UserProfilePage', () => ({
  default: ({ onClose }) => <div data-testid="profile-page"><button onClick={onClose}>profile-back</button></div>,
}))

import GuestUserModal from '@/features/guest-user/GuestUserModal'

describe('GuestUserModal v1.7.0 — profile page', () => {
  it('opens the profile on the right page, hides the left selector, goes back to the matches', () => {
    ctx.value = { user: { username: 'guest_x', accessToken: 't' }, loading: false, guestModalOpen: true,
      closeGuestModal: vi.fn() }
    render(<GuestUserModal />)
    expect(screen.getByTestId('matches-list')).toBeTruthy()
    expect(screen.getByTestId('lang-sel')).toBeTruthy()
    fireEvent.click(screen.getByText('profile.open'))
    expect(screen.getByTestId('profile-page')).toBeTruthy()
    expect(screen.queryByTestId('matches-list')).toBeNull()
    expect(screen.queryByTestId('lang-sel')).toBeNull()
    fireEvent.click(screen.getByText('profile-back'))
    expect(screen.getByTestId('matches-list')).toBeTruthy()
  })

  it('closing the book closes the profile too', () => {
    ctx.value = { user: { username: 'guest_x', accessToken: 't' }, loading: false, guestModalOpen: true,
      closeGuestModal: vi.fn() }
    render(<GuestUserModal />)
    fireEvent.click(screen.getByText('profile.open'))
    fireEvent.click(screen.getByText('close-book'))
    expect(ctx.value.closeGuestModal).toHaveBeenCalled()
    expect(screen.queryByTestId('profile-page')).toBeNull()
  })
})
