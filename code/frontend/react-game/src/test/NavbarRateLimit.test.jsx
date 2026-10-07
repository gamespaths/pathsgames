import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

// v0.41.0 — the 'rateLimited' home error reads as a translated sentence with the wait.
const T = {
  'nav.error.rateLimited': 'Too many guest logins, try again in {time}',
  'nav.error.matches': 'Your matches could not be loaded',
  'errors.rateLimitSoon': 'a few minutes',
}
vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => T[k] ?? k, lang: 'en', setLang: vi.fn() }),
}))
const homeStatus = vi.hoisted(() => ({ error: null }))
vi.mock('@/context/HomeStatusContext', () => ({
  useHomeStatus: () => ({ error: homeStatus.error, setError: vi.fn() }),
}))
const guest = vi.hoisted(() => ({ errorRetryAfter: 0 }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: null, loading: false, openGuestModal: vi.fn(), errorRetryAfter: guest.errorRetryAfter }),
}))

const renderNavbar = () => render(<MemoryRouter><Navbar /></MemoryRouter>)

describe('Navbar — rate-limited guest login', () => {
  it('shows the wait in minutes', () => {
    homeStatus.error = 'rateLimited'
    guest.errorRetryAfter = 1500
    renderNavbar()
    expect(screen.getByRole('alert')).toHaveTextContent('Too many guest logins, try again in 25 min')
  })

  it('falls back to a vague wait when the backend sent none', () => {
    homeStatus.error = 'rateLimited'
    guest.errorRetryAfter = 0
    renderNavbar()
    expect(screen.getByRole('alert')).toHaveTextContent('try again in a few minutes')
  })

  it('keeps the plain message for the other home errors, and no alert without one', () => {
    homeStatus.error = 'matches'
    const { unmount } = renderNavbar()
    expect(screen.getByRole('alert')).toHaveTextContent('Your matches could not be loaded')
    unmount()
    homeStatus.error = null
    renderNavbar()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
