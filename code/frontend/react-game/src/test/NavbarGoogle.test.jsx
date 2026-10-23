import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('@/context/HomeStatusContext', () => ({ useHomeStatus: () => ({ error: null, setError: vi.fn() }) }))

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))

function renderNavbar() {
  return render(<MemoryRouter><Navbar /></MemoryRouter>)
}

describe('Navbar v1.2.0 — Google user', () => {
  it('shows the round picture and the nickname, the icon when the picture fails', () => {
    ctx.value = { user: { username: 'google_x', nickname: 'mario', displayName: 'Mario Rossi', pictureUrl: 'p.png' },
      isGoogleUser: true, googleEnabled: true, openGuestModal: vi.fn(), loading: false }
    const { container } = renderNavbar()
    const img = container.querySelector('img.nav-user-avatar')
    expect(img.getAttribute('src')).toBe('p.png')
    expect(img.getAttribute('width')).toBe('32')
    expect(screen.getByText('mario')).toBeInTheDocument()
    expect(screen.getByTitle('Mario Rossi')).toBeInTheDocument()
    expect(screen.getByTitle('Mario Rossi').className).toBe('nav-user-btn nav-user-btn--google')
    expect(screen.queryByTitle('auth.google.signIn')).toBeNull()
    fireEvent.error(img)
    expect(container.querySelector('img.nav-user-avatar')).toBeNull()
    expect(container.querySelector('.fa-user-circle')).toBeTruthy()
  })

  it('a guest gets the header sign-in entry, which opens the user book', () => {
    const openGuestModal = vi.fn()
    ctx.value = { user: { username: 'guest_x' }, isGoogleUser: false, googleEnabled: true, openGuestModal, loading: false }
    renderNavbar()
    fireEvent.click(screen.getByTitle('auth.google.signIn'))
    expect(openGuestModal).toHaveBeenCalled()
    expect(screen.getByTitle('guest_x').className).toBe('nav-user-btn')
  })

  it('no sign-in entry when Google is off; a closed session is said and dismissed', () => {
    const clearAuthError = vi.fn()
    ctx.value = { user: null, isGoogleUser: false, googleEnabled: false, openGuestModal: vi.fn(), loading: false,
      authError: 'SESSION_REVOKED', clearAuthError }
    renderNavbar()
    expect(screen.queryByTitle('auth.google.signIn')).toBeNull()
    expect(screen.getByText('auth.errors.GOOGLE_LOGIN_FAILED')).toBeInTheDocument()
    fireEvent.click(screen.getByText('modals.close'))
    expect(clearAuthError).toHaveBeenCalled()
  })

  it('v1.7.0 step 12 — SESSION_LIMIT is said and its button opens the sign-in', () => {
    const clearAuthError = vi.fn()
    const openGuestModal = vi.fn()
    ctx.value = { user: { username: 'guest_x' }, isGoogleUser: false, googleEnabled: true, openGuestModal,
      loading: false, authError: 'SESSION_LIMIT', clearAuthError }
    renderNavbar()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('auth.google.signInAgain'))
    expect(clearAuthError).toHaveBeenCalled()
    expect(openGuestModal).toHaveBeenCalled()
  })

  it('SESSION_LIMIT without Google sign-in has only the close button', () => {
    ctx.value = { user: null, isGoogleUser: false, googleEnabled: false, openGuestModal: vi.fn(), loading: false,
      authError: 'SESSION_LIMIT', clearAuthError: vi.fn() }
    renderNavbar()
    expect(screen.queryByText('auth.google.signInAgain')).toBeNull()
  })

  it('other auth errors stay in the user book, not in the header', () => {
    ctx.value = { user: { username: 'g' }, isGoogleUser: false, googleEnabled: true, openGuestModal: vi.fn(),
      loading: false, authError: 'EMAIL_DOMAIN_NOT_ALLOWED' }
    renderNavbar()
    expect(screen.queryByText('auth.errors.GOOGLE_LOGIN_FAILED')).toBeNull()
  })
})
