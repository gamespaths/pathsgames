import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const ts = vi.hoisted(() => ({ behavior: 'success' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => {
        if (ts.behavior === 'bot') onError?.()
        else onSuccess?.('test-token')
      }, [])
      return <div data-testid="turnstile-mock" />
    },
  }
})

vi.mock('../utils/turnstile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, CF_KEY: 'test-site-key' }
})

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockUser = { username: 'guest_u1', accessToken: 'tok' }
vi.mock('../context/GuestUserContext', () => ({
  useGuestUser: () => ({ user: mockUser, loading: false, guestModalOpen: true, closeGuestModal: vi.fn() }),
}))

vi.mock('../components/book/Book', () => ({
  default: ({ left, right }) => <div>{left}{right}</div>,
}))
vi.mock('../components/book/BookPageContent', () => ({ default: () => <div data-testid="book-page" /> }))
vi.mock('../components/modals/user/UserMatchesList', () => ({ default: () => <div data-testid="matches-list" /> }))
vi.mock('../components/modals/user/UserLanguageSelector', () => ({ default: () => <div data-testid="lang-sel" /> }))

import GuestUserModal from '../components/modals/user/GuestUserModal'

describe('GuestUserModal — antibot after matches list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
    document.cookie = 'pathsgames.turnstilePass=; max-age=0; path=/' // forget prior pass
  })

  it('shows the matches list only after Turnstile passes', async () => {
    render(<GuestUserModal />)
    expect(await screen.findByTestId('matches-list')).toBeInTheDocument()
    expect(screen.queryByText('antibot.blocked')).not.toBeInTheDocument()
  })

  it('records a pass cookie after a human check', async () => {
    render(<GuestUserModal />)
    await screen.findByTestId('matches-list')
    expect(document.cookie).toContain('pathsgames.turnstilePass=1')
  })

  it('skips the widget and shows the matches list directly when a recent pass cookie exists', () => {
    document.cookie = 'pathsgames.turnstilePass=1; path=/'
    render(<GuestUserModal />)
    expect(screen.getByTestId('matches-list')).toBeInTheDocument()
    expect(screen.queryByTestId('turnstile-mock')).not.toBeInTheDocument()
  })

  it('offers a retry (instead of blocking) and hides the matches list on widget error', async () => {
    ts.behavior = 'bot'
    render(<GuestUserModal />)
    expect(await screen.findByText('antibot.error')).toBeInTheDocument()
    expect(screen.getByText('startMatch.retry')).toBeInTheDocument()
    expect(screen.queryByTestId('matches-list')).not.toBeInTheDocument()
  })
})
