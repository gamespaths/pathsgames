// v1.8.0 — the logout menu of a Google user: this device, all devices, account deletion and the closing message.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const tr = vi.hoisted(() => ({ value: {} }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => tr.value[k] ?? k, lang: 'en', setLang: vi.fn() }) }))
vi.mock('@/context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))
const gisMock = vi.hoisted(() => ({ load: vi.fn(), nonce: vi.fn(() => 'nonce-del') }))
vi.mock('@/auth/gisLoader', () => ({ loadGis: gisMock.load, newNonce: gisMock.nonce }))

import UserAccountPanel, { profileErrorText } from '@/features/guest-user/UserAccountPanel'

const GOOGLE_USER = { accountType: 'GOOGLE', displayName: 'Mario Rossi', nickname: 'mario', accessToken: 't' }

function base(extra = {}) {
  return {
    user: GOOGLE_USER, isGoogleUser: true, googleEnabled: true, googleClientId: 'cid',
    logout: vi.fn(), logoutAll: vi.fn(), deleteAccount: vi.fn(), loginWithGoogle: vi.fn(),
    authBusy: false, profileBusy: false, authError: null, clearAuthError: vi.fn(),
    profileError: null, clearProfileError: vi.fn(), accountDeleted: false, closeGuestModal: vi.fn(),
    ...extra,
  }
}

function openMenu() {
  fireEvent.click(screen.getByText('auth.google.logout'))
}

describe('UserAccountPanel — logout menu', () => {
  beforeEach(() => { gisMock.load.mockReset(); tr.value = {} })

  it('the Log out button opens the three choices and hides itself', () => {
    ctx.value = base()
    render(<UserAccountPanel />)
    expect(screen.queryByTestId('logout-menu')).toBeNull()
    openMenu()
    expect(screen.queryByText('auth.google.logout')).toBeNull()
    expect(screen.getByText('auth.google.logoutThisDevice')).toBeTruthy()
    expect(screen.getByText('profile.logoutAll')).toBeTruthy()
    expect(screen.getByText('profile.delete.button')).toBeTruthy()
  })

  it('log out of this device calls the plain logout', () => {
    ctx.value = base()
    render(<UserAccountPanel />)
    openMenu()
    fireEvent.click(screen.getByText('auth.google.logoutThisDevice'))
    expect(ctx.value.logout).toHaveBeenCalledTimes(1)
    expect(ctx.value.logoutAll).not.toHaveBeenCalled()
  })

  it('the active sessions are shown in the menu only when the server sent them', () => {
    tr.value['profile.activeSessions'] = 'Devices: {count}'
    ctx.value = base({ user: { ...GOOGLE_USER, activeSessions: 3 } })
    const { unmount } = render(<UserAccountPanel />)
    openMenu()
    expect(screen.getByTestId('active-sessions')).toHaveTextContent('Devices: 3')
    unmount()
    ctx.value = base()
    render(<UserAccountPanel />)
    openMenu()
    expect(screen.queryByTestId('active-sessions')).toBeNull()
  })

  it('log out of all devices asks a confirmation, can be cancelled, then calls logoutAll', () => {
    ctx.value = base()
    render(<UserAccountPanel />)
    openMenu()
    fireEvent.click(screen.getByText('profile.logoutAll'))
    expect(screen.getByTestId('confirm-logout-all')).toHaveTextContent('profile.logoutAllConfirm')
    fireEvent.click(screen.getByText('profile.cancel'))
    expect(screen.getByTestId('logout-menu')).toBeTruthy()
    fireEvent.click(screen.getByText('profile.logoutAll'))
    fireEvent.click(screen.getByText('profile.confirm'))
    expect(ctx.value.logoutAll).toHaveBeenCalledTimes(1)
  })

  it('deletion: what is deleted, a fresh Google popup whose credential deletes the account', async () => {
    let callback
    const gis = { initialize: vi.fn((cfg) => { callback = cfg.callback }), renderButton: vi.fn() }
    gisMock.load.mockResolvedValue(gis)
    ctx.value = base()
    render(<UserAccountPanel />)
    openMenu()
    fireEvent.click(screen.getByText('profile.delete.button'))
    expect(screen.getByTestId('confirm-delete')).toHaveTextContent('profile.delete.what')
    await act(async () => { fireEvent.click(screen.getByText('profile.delete.confirmWithGoogle')) })
    await waitFor(() => expect(gis.renderButton).toHaveBeenCalled())
    expect(gis.initialize.mock.calls[0][0]).toMatchObject({ nonce: 'nonce-del', ux_mode: 'popup' })
    expect(gis.renderButton.mock.calls[0][1]).toMatchObject({ text: 'continue_with' })
    callback({ credential: 'fresh-cred' })
    expect(ctx.value.deleteAccount).toHaveBeenCalledWith('fresh-cred')
    expect(ctx.value.loginWithGoogle).not.toHaveBeenCalled()
  })

  it('deletion in progress: busy text and cancel disabled; cancel goes back to the menu', () => {
    ctx.value = base({ profileBusy: true })
    const { rerender } = render(<UserAccountPanel />)
    openMenu()
    fireEvent.click(screen.getByText('profile.delete.button'))
    expect(screen.getByText('profile.delete.deleting')).toBeTruthy()
    expect(screen.getByText('profile.cancel').disabled).toBe(true)
    ctx.value = base()
    rerender(<UserAccountPanel />)
    fireEvent.click(screen.getByText('profile.cancel'))
    expect(screen.getByTestId('logout-menu')).toBeTruthy()
  })

  it('after the deletion: the closing message, its button leaves the book', () => {
    ctx.value = base({ accountDeleted: true })
    render(<UserAccountPanel />)
    expect(screen.getByTestId('user-profile-deleted')).toHaveTextContent('profile.delete.doneTitle')
    expect(screen.getByTestId('user-profile-deleted')).toHaveTextContent('profile.delete.done')
    expect(screen.queryByText('auth.google.logout')).toBeNull()
    fireEvent.click(screen.getByText('profile.delete.close'))
    expect(ctx.value.closeGuestModal).toHaveBeenCalled()
  })

  it('shows a profile error and clears it', () => {
    tr.value['profile.errors.FRESH_TOKEN_REQUIRED'] = 'too old'
    ctx.value = base({ profileError: 'FRESH_TOKEN_REQUIRED' })
    render(<UserAccountPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent('too old')
    fireEvent.click(screen.getByLabelText('modals.close'))
    expect(ctx.value.clearProfileError).toHaveBeenCalled()
  })
})

describe('profileErrorText', () => {
  it('profile text first, then the auth text, then the generic one', () => {
    const texts = { 'profile.errors.A': 'pa', 'auth.errors.B': 'ab', 'profile.errors.generic': 'gen' }
    const t = (k) => texts[k] ?? k
    expect(profileErrorText(t, null)).toBeNull()
    expect(profileErrorText(t, 'A')).toBe('pa')
    expect(profileErrorText(t, 'B')).toBe('ab')
    expect(profileErrorText(t, 'C')).toBe('gen')
  })
})
