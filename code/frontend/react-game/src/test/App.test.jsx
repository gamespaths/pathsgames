import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// v1.13.0 — the app shell: navbar, the routes in main.app-main, footer and the drawn tooltip.
const { pass } = vi.hoisted(() => ({ pass: ({ children }) => children }))
vi.mock('@/context/ServerContext', () => ({ ServerProvider: pass, useServer: () => ({}) }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ GuestUserProvider: pass, useGuestUser: () => ({}) }))
vi.mock('@/components/layout/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }))
vi.mock('@/components/layout/Footer', () => ({ default: () => <footer data-testid="footer" /> }))
vi.mock('@/components/CookieConsentManager', () => ({ default: () => <div data-testid="cookies" /> }))
vi.mock('@/app/routes', () => ({ default: () => <div data-testid="routes" /> }))

import App from '../app/App'

describe('App (v1.13.0)', () => {
  it('renders the shell in order, the routes inside main.app-main, the tooltip layer once', () => {
    const { container } = render(<App />)
    const main = container.querySelector('main.app-main')
    expect(main).toContainElement(screen.getByTestId('routes'))
    expect(screen.getByTestId('navbar').nextElementSibling).toBe(main)
    expect(main.nextElementSibling).toBe(screen.getByTestId('footer'))
    expect(document.querySelectorAll('.pg-tooltip').length).toBe(1)
    // no global overlay any more (policy book, guest modal)
    expect(container.querySelector('.book-overlay')).toBeNull()
  })
})
