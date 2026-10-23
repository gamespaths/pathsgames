// v1.7.0 V1 step 12 — known-account flag, SESSION_LIMIT, active sessions, "match is being updated" banner, policy.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GuestUserProvider, useGuestUser, toIdentity } from '@/features/guest-user/GuestUserContext'
import { KNOWN_ACCOUNT_KEY, forgetKnownAccount, isKnownAccount, markKnownAccount } from '@/auth/knownAccount'
import { SESSION_ALERT_CODES, SESSION_LIMIT } from '@/auth/sessionAlerts'
import { changedElsewhere } from '@/pages/GamePage'
import * as authApi from '../api/auth'
import * as echoApi from '../api/echoApi'
import * as client from '../api/client'
import * as gis from '../auth/gisLoader'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'

const reload = vi.hoisted(() => vi.fn())
vi.mock('../auth/reloadHome', () => ({ reloadHome: reload }))
vi.mock('../context/ServerContext', () => ({ useServer: () => ({ server: 'http://api.test' }) }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }) }))

class FakeChannel {
  postMessage() {}
  close() {}
}

function Probe() {
  const ctx = useGuestUser()
  return (
    <div>
      <span data-testid="who">{ctx.user ? `${ctx.user.accountType}:${ctx.user.activeSessions}` : 'none'}</span>
      <span data-testid="auth-error">{ctx.authError ?? ''}</span>
      <span data-testid="hint">{ctx.knownAccountHint ? 'hint' : 'no-hint'}</span>
      <button onClick={() => ctx.loginWithGoogle('id-token')}>login</button>
      <button onClick={() => ctx.logout()}>logout</button>
      <button onClick={() => ctx.deleteAccount('fresh-id')}>delete</button>
    </div>
  )
}

const GOOGLE = { userUuid: 'g1', username: 'google_g1', nickname: 'mario', accountType: 'GOOGLE', accessToken: 'g-tok',
  activeSessions: 3 }

describe('knownAccount flag module', () => {
  beforeEach(() => localStorage.clear())

  it('marks a constant value, reads and forgets it', () => {
    expect(isKnownAccount()).toBe(false)
    markKnownAccount()
    expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBe('1')
    expect(isKnownAccount()).toBe(true)
    forgetKnownAccount()
    expect(isKnownAccount()).toBe(false)
  })

  it('a storage that throws never breaks the page', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('x') })
    expect(isKnownAccount()).toBe(false)
    expect(() => markKnownAccount()).not.toThrow()
    expect(() => forgetKnownAccount()).not.toThrow()
    spy.mockRestore()
    vi.restoreAllMocks()
  })
})

describe('GuestUserContext v1.7.0 step 12', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    reload.mockReset()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    vi.spyOn(echoApi, 'getServerStatus').mockResolvedValue({ googleEnabled: true, googleClientId: 'cid' })
    vi.spyOn(authApi, 'refreshSession').mockRejectedValue(new Error('no cookie'))
    vi.spyOn(authApi, 'resumeGuestSession').mockResolvedValue({ userUuid: 'u1', username: 'guest_u1', accessToken: 'guest-tok' })
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue({ userUuid: 'u2', username: 'guest_u2', accessToken: 'new-tok' })
    vi.spyOn(authApi, 'getMe').mockResolvedValue(GOOGLE)
    vi.spyOn(client, 'setUnauthorizedHandler').mockImplementation(() => {})
    vi.spyOn(gis, 'takeNonce').mockReturnValue('nonce')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('the flag is written only at the Google login and kept at logout', async () => {
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue({ ...GOOGLE, newUser: false })
    vi.spyOn(authApi, 'logoutSession').mockResolvedValue({})
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GUEST'))
    expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBeNull()
    expect(screen.getByTestId('hint')).toHaveTextContent('no-hint')
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:3'))
    expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBe('1')
    expect(screen.getByTestId('hint')).toHaveTextContent('no-hint')
    await act(async () => { fireEvent.click(screen.getByText('logout')) })
    expect(reload).toHaveBeenCalled()
    expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBe('1')
  })

  it('a failed login writes nothing', async () => {
    vi.spyOn(authApi, 'googleLogin').mockRejectedValue({ response: { data: { error: 'EMAIL_NOT_VERIFIED' } } })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GUEST'))
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBeNull()
  })

  it('a known device without a Google session gets the hint; the deletion removes the flag', async () => {
    localStorage.setItem(KNOWN_ACCOUNT_KEY, '1')
    vi.spyOn(authApi, 'deleteMe').mockResolvedValue({ status: 'DELETING' })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('hint')).toHaveTextContent('hint'))
    await act(async () => { fireEvent.click(screen.getByText('delete')) })
    await waitFor(() => expect(localStorage.getItem(KNOWN_ACCOUNT_KEY)).toBeNull())
    expect(screen.getByTestId('hint')).toHaveTextContent('no-hint')
  })

  it('a refresh refused with SESSION_LIMIT is kept for the navbar', async () => {
    authApi.refreshSession.mockRejectedValue({ response: { status: 401, data: { error: SESSION_LIMIT } } })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('SESSION_LIMIT'))
    expect(SESSION_ALERT_CODES).toContain('SESSION_REVOKED')
  })

  it('toIdentity keeps activeSessions only when it is a number', () => {
    expect(toIdentity({ accessToken: 't' }, { activeSessions: 2 }).activeSessions).toBe(2)
    expect(toIdentity({ accessToken: 't' }, { activeSessions: 'x' }).activeSessions).toBeNull()
    expect(toIdentity({ accessToken: 't' }).activeSessions).toBeNull()
  })
})

describe('GamePage banner rule', () => {
  it('only a version this device knew, replaced by another one', () => {
    expect(changedElsewhere('v1', 'v2')).toBe(true)
    expect(changedElsewhere('v1', 'v1')).toBe(false)
    expect(changedElsewhere(null, 'v2')).toBe(false)
    expect(changedElsewhere('v1', null)).toBe(false)
  })
})

describe('policy texts', () => {
  it('list the cookie lifetimes of step 12 and the browser storage keys in EN and IT', () => {
    for (const bundle of [en, it_]) {
      const necessary = bundle.modals.cookies.necessaryBody
      for (const key of ['pathsgames.lang', 'pg_game_server', 'pathsgames.knownAccount', 'pathsgames.googleNonce',
        'pathsgames.turnstilePass', 'pg_story:*', 'pathsgames.highContrast']) {
        expect(necessary).toContain(key)
      }
      expect(necessary).toContain('250')
      expect(necessary).toContain('180')
      expect(bundle.modals.privacy.retentionBody).toContain('250')
      expect(bundle.auth.errors.SESSION_LIMIT).toBeTruthy()
      expect(bundle.home.knownAccount).toBeTruthy()
      expect(bundle.profile.activeSessions).toContain('{count}')
      expect(bundle.game.matchUpdatedLog).toBeTruthy()
    }
    expect(en.game.matchUpdating).toBe('Match is being updated')
    expect(it_.game.matchUpdating).toBe('Partita in aggiornamento')
  })
})
