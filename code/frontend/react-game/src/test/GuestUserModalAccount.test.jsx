import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../utils/turnstile', async (importOriginal) => ({ ...(await importOriginal()), CF_KEY: '' }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
vi.mock('../components/book/Book', () => ({ default: ({ left }) => <div>{left}</div> }))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, extraContent }) => (
    <div>
      <h2 data-testid="title">{card.title}</h2>
      <div data-testid="desc">{card.description}</div>
      <div data-testid="extra">{extraContent}</div>
    </div>
  ),
}))
vi.mock('@/features/guest-user/UserMatchesList', () => ({ default: () => null }))
vi.mock('@/features/guest-user/UserLanguageSelector', () => ({ default: () => <div data-testid="lang-sel" /> }))

import GuestUserModal from '@/features/guest-user/GuestUserModal'

const base = { loading: false, guestModalOpen: true, closeGuestModal: vi.fn(), googleEnabled: true,
  googleClientId: 'cid', logout: vi.fn(), authBusy: false }

describe('GuestUserModal v1.2.0 — account in the parchment body', () => {
  it('a Google user: picture before the name, multi-device body and dark logout in the body', () => {
    ctx.value = { ...base, isGoogleUser: true,
      user: { accountType: 'GOOGLE', displayName: 'Mario Rossi', pictureUrl: 'p.png', accessToken: 't' } }
    render(<GuestUserModal />)
    const title = screen.getByTestId('title')
    const img = title.querySelector('img.user-avatar')
    expect(img.getAttribute('src')).toBe('p.png')
    expect(title.textContent).toBe('Mario Rossi')
    const desc = screen.getByTestId('desc')
    expect(desc.textContent).toContain('modals.guestUser.bodyGoogle')
    expect(desc.querySelector('[data-testid="user-account-panel"]')).toBeTruthy()
    expect(screen.getByText('auth.google.logout').closest('button').className).toBe('lang-btn')
    expect(screen.getByTestId('extra').querySelector('[data-testid="user-account-panel"]')).toBeNull()
    expect(screen.getByTestId('lang-sel')).toBeTruthy()
    fireEvent.error(img)
    expect(title.querySelector('img')).toBeNull()
  })

  it('a Google user without a picture keeps the plain name', () => {
    ctx.value = { ...base, isGoogleUser: true, user: { accountType: 'GOOGLE', displayName: 'Mario', accessToken: 't' } }
    render(<GuestUserModal />)
    expect(screen.getByTestId('title').querySelector('img')).toBeNull()
    expect(screen.getByTestId('title').textContent).toBe('Mario')
  })

  it('a guest: invite with the age notice on one line, then the sign-in button, in the body', () => {
    ctx.value = { ...base, isGoogleUser: false, user: { username: 'guest_x', accessToken: 't' } }
    render(<GuestUserModal />)
    const desc = screen.getByTestId('desc')
    const text = desc.textContent
    expect(text.indexOf('modals.guestUser.body')).toBe(0)
    const invite = screen.getByText('auth.google.keepProgress auth.google.ageNotice')
    expect(invite.previousSibling.tagName).toBe('BR')
    expect(text.indexOf('auth.google.ageNotice')).toBeLessThan(text.indexOf('auth.google.signIn'))
    expect(screen.getByText('auth.google.signIn').closest('button').className).toContain('lang-btn')
  })
})
