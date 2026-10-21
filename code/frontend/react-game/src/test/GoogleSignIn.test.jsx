import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import GoogleSignInButton from '@/features/guest-user/GoogleSignInButton'
import UserAccountPanel, { authErrorText, UserAvatar, AgeNotice } from '@/features/guest-user/UserAccountPanel'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const tr = vi.hoisted(() => ({ value: {} }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => tr.value[k] ?? k }) }))
const policy = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('@/context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: policy.open }) }))

const gisMock = vi.hoisted(() => ({ load: vi.fn(), nonce: vi.fn(() => 'nonce-x') }))
vi.mock('@/auth/gisLoader', () => ({ loadGis: gisMock.load, newNonce: gisMock.nonce }))

function base(extra = {}) {
  return { googleEnabled: true, googleClientId: 'cid', loginWithGoogle: vi.fn(), authBusy: false, ...extra }
}

describe('GoogleSignInButton (v1.2.0)', () => {
  beforeEach(() => { gisMock.load.mockReset() })

  it('is hidden when Google sign-in is off or has no client id', () => {
    ctx.value = base({ googleEnabled: false })
    const { container, rerender } = render(<GoogleSignInButton />)
    expect(container.innerHTML).toBe('')
    ctx.value = base({ googleClientId: null })
    rerender(<GoogleSignInButton />)
    expect(container.innerHTML).toBe('')
  })

  it('loads GIS only on click and renders the popup button that logs in', async () => {
    let callback
    const gis = {
      initialize: vi.fn((cfg) => { callback = cfg.callback }),
      renderButton: vi.fn(),
    }
    gisMock.load.mockResolvedValue(gis)
    ctx.value = base()
    render(<GoogleSignInButton />)
    expect(gisMock.load).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByText('auth.google.signIn')) })
    await waitFor(() => expect(gis.renderButton).toHaveBeenCalled())
    const cfg = gis.initialize.mock.calls[0][0]
    expect(cfg).toMatchObject({ client_id: 'cid', nonce: 'nonce-x', ux_mode: 'popup', auto_select: false })
    expect(gis.renderButton.mock.calls[0][1]).toMatchObject({ theme: 'filled_black', shape: 'pill', size: 'large' })
    callback({ credential: 'cred' })
    callback({})
    expect(ctx.value.loginWithGoogle).toHaveBeenCalledTimes(1)
    expect(ctx.value.loginWithGoogle).toHaveBeenCalledWith('cred')
  })

  it('a compact button and a busy state', async () => {
    const gis = { initialize: vi.fn(), renderButton: vi.fn() }
    gisMock.load.mockResolvedValue(gis)
    ctx.value = base({ authBusy: true })
    render(<GoogleSignInButton compact />)
    expect(screen.getByText('auth.google.signingIn')).toBeTruthy()
    expect(screen.getByText('auth.google.signIn').closest('button').disabled).toBe(true)
  })

  it('a provider that cannot load is said', async () => {
    gisMock.load.mockRejectedValue(new Error('blocked'))
    ctx.value = base()
    render(<GoogleSignInButton />)
    await act(async () => { fireEvent.click(screen.getByText('auth.google.signIn')) })
    expect(screen.getByRole('alert').textContent).toBe('auth.errors.PROVIDER_UNAVAILABLE')
  })

  it('a render that fails after the first load is said too', async () => {
    gisMock.load.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('gone'))
    ctx.value = base()
    render(<GoogleSignInButton />)
    await act(async () => { fireEvent.click(screen.getByText('auth.google.signIn')) })
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  })
})

describe('UserAccountPanel (v1.2.0)', () => {
  it('invites a guest to sign in to keep the progress', () => {
    ctx.value = base({ user: { username: 'guest_x' }, isGoogleUser: false })
    render(<UserAccountPanel />)
    // the age notice follows the invite in the same line, before the button
    expect(screen.getByText('auth.google.keepProgress auth.google.ageNotice')).toBeTruthy()
    expect(screen.getByTestId('google-signin')).toBeTruthy()
  })

  it('no invite for a guest when Google sign-in is off', () => {
    ctx.value = base({ user: { username: 'guest_x' }, isGoogleUser: false, googleEnabled: false })
    render(<UserAccountPanel />)
    expect(screen.queryByText('auth.google.keepProgress', { exact: false })).toBeNull()
  })

  it('the age notice links the privacy policy and the terms to the policy book', () => {
    tr.value = { 'auth.google.ageNotice': 'Be 16: read the {privacy} and the {terms}.',
      'footer.privacy': 'Privacy Policy', 'footer.terms': 'Terms of Service' }
    const { container } = render(<p><AgeNotice /></p>)
    expect(container.textContent).toBe('Be 16: read the Privacy Policy and the Terms of Service.')
    fireEvent.click(screen.getByText('Privacy Policy'))
    fireEvent.click(screen.getByText('Terms of Service'))
    expect(policy.open.mock.calls).toEqual([['privacy'], ['terms']])
    tr.value = {}
  })

  it('the avatar shows the picture, and nothing without one or when it fails', () => {
    const { container, rerender } = render(<UserAvatar url="p.png" />)
    const img = container.querySelector('img.user-avatar')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.error(img)
    expect(container.innerHTML).toBe('')
    rerender(<UserAvatar url={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the Google account with its logout and the auth error', () => {
    const logout = vi.fn()
    const clearAuthError = vi.fn()
    ctx.value = base({ user: { displayName: 'Mario Rossi', nickname: 'mario' }, isGoogleUser: true, logout,
      authError: 'IDENTITY_MISMATCH', clearAuthError })
    render(<UserAccountPanel />)
    expect(screen.getByText('Mario Rossi')).toBeTruthy()
    expect(screen.getByText('(mario)', { exact: false })).toBeTruthy()
    // the mocked t answers the key itself: an untranslated code reads as the generic failure
    expect(screen.getByRole('alert').textContent).toContain('auth.errors.GOOGLE_LOGIN_FAILED')
    fireEvent.click(screen.getByText('auth.google.logout'))
    fireEvent.click(screen.getByLabelText('modals.close'))
    expect(logout).toHaveBeenCalled()
    expect(clearAuthError).toHaveBeenCalled()
  })

  it('a Google user without a nickname, and the error text fallback', () => {
    ctx.value = base({ user: { displayName: 'Mario' }, isGoogleUser: true, logout: vi.fn() })
    render(<UserAccountPanel />)
    expect(screen.queryByText('(', { exact: false })).toBeNull()
    expect(authErrorText((k) => k, null)).toBeNull()
    expect(authErrorText((k) => (k === 'auth.errors.X' ? k : 'known'), 'X')).toBe('known')
    expect(authErrorText((k) => `T:${k}`, 'SESSION_REVOKED')).toBe('T:auth.errors.SESSION_REVOKED')
  })
})
