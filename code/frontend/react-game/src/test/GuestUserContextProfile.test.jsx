// v1.7.0 V1 step 7 — GuestUserContext: first-login copy, profile wins, page return, preferences, logout all, deletion.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { GuestUserProvider, useGuestUser } from '@/features/guest-user/GuestUserContext'
import * as authApi from '../api/auth'
import * as echoApi from '../api/echoApi'
import * as client from '../api/client'
import * as gis from '../auth/gisLoader'
import { beginRequest, endRequest, resetInFlight } from '../api/inFlight'

const reload = vi.hoisted(() => vi.fn())
vi.mock('../auth/reloadHome', () => ({ reloadHome: reload }))
vi.mock('../context/ServerContext', () => ({ useServer: () => ({ server: 'http://api.test' }) }))
const i18n = vi.hoisted(() => ({ lang: 'en', setLang: vi.fn() }))
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: i18n.lang, setLang: i18n.setLang }) }))

const channels = []
class FakeChannel {
  constructor() { this.posted = []; channels.push(this) }
  postMessage(m) { this.posted.push(m) }
  close() {}
}

let ctx
function Probe() {
  ctx = useGuestUser()
  const u = ctx.user
  return (
    <div>
      <span data-testid="who">{u ? `${u.accountType}:${u.accessToken}` : 'none'}</span>
      <span data-testid="stats">{u?.stats ? String(u.stats.matchesPlayed) : '-'}</span>
      <span data-testid="pref">{u?.preferences?.language ?? '-'}</span>
      <span data-testid="langs">{(ctx.supportedLanguages ?? []).join(',')}</span>
      <span data-testid="profile-error">{ctx.profileError ?? ''}</span>
      <span data-testid="deleted">{ctx.accountDeleted ? 'deleted' : 'alive'}</span>
      <span data-testid="highlight">{(ctx.highlightedMatchUuids ?? []).join(',')}</span>
      <button onClick={() => ctx.consumeHighlightedMatches()}>consume</button>
      <button onClick={() => ctx.loginWithGoogle('id-token')}>login</button>
    </div>
  )
}

const ME = (extra = {}) => ({ userUuid: 'g1', username: 'google_g1', nickname: 'mario', displayName: 'Mario',
  accountType: 'GOOGLE', language: 'it', preferences: { language: 'it', theme: 'high-contrast', highContrast: true },
  stats: { matchesPlayed: 2 }, csrfToken: 'csrf-me', ...extra })
const LOGIN = (extra = {}) => ({ userUuid: 'g1', username: 'google_g1', accountType: 'GOOGLE', accessToken: 'g-tok',
  csrfToken: 'csrf-g', language: 'en', ...extra })

async function renderGuest() {
  render(<GuestUserProvider><Probe /></GuestUserProvider>)
  await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GUEST:guest-tok'))
}

async function renderGoogle() {
  authApi.refreshSession.mockResolvedValueOnce({ userUuid: 'g1', username: 'google_g1', accessToken: 'g-tok',
    csrfToken: 'csrf-g' })
  render(<GuestUserProvider><Probe /></GuestUserProvider>)
  await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:g-tok'))
}

describe('GuestUserContext v1.7.0 — user profile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    channels.length = 0
    reload.mockClear()
    i18n.lang = 'en'
    i18n.setLang = vi.fn()
    localStorage.clear()
    resetInFlight()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    vi.spyOn(echoApi, 'getServerStatus').mockResolvedValue({ googleEnabled: true, googleClientId: 'cid',
      supportedLanguages: ['en', 'it'] })
    vi.spyOn(authApi, 'refreshSession').mockRejectedValue(new Error('no cookie'))
    vi.spyOn(authApi, 'resumeGuestSession').mockResolvedValue({ userUuid: 'u1', username: 'guest_u1',
      accessToken: 'guest-tok', csrfToken: 'csrf-guest' })
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue(null)
    vi.spyOn(authApi, 'getMe').mockResolvedValue(ME())
    vi.spyOn(authApi, 'updateMe').mockResolvedValue(ME())
    vi.spyOn(client, 'setUnauthorizedHandler').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads the supported languages of the server', async () => {
    await renderGuest()
    await waitFor(() => expect(screen.getByTestId('langs')).toHaveTextContent('en,it'))
  })

  it('a status without a language list leaves it unknown', async () => {
    echoApi.getServerStatus.mockResolvedValue({ googleEnabled: false })
    await renderGuest()
    expect(screen.getByTestId('langs')).toHaveTextContent('')
  })

  it('first Google login: one PATCH with the device values, then the profile', async () => {
    localStorage.setItem('pathsgames.lang', 'it')
    localStorage.setItem('pathsgames.highContrast', 'true')
    vi.spyOn(gis, 'takeNonce').mockReturnValue('n')
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ newUser: true }))
    await renderGuest()
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(authApi.updateMe).toHaveBeenCalledTimes(1)
    expect(authApi.updateMe).toHaveBeenCalledWith('http://api.test', 'g-tok', 'csrf-g', { language: 'it', highContrast: true })
    expect(screen.getByTestId('stats')).toHaveTextContent('2')
    expect(screen.getByTestId('pref')).toHaveTextContent('it')
  })

  it('v1.7.0 step 9 — the matches cancelled by the login are kept until consumed', async () => {
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ cancelledMatchUuids: ['m1', 'm2'] }))
    await renderGuest()
    expect(screen.getByTestId('highlight')).toHaveTextContent('')
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(screen.getByTestId('highlight')).toHaveTextContent('m1,m2')
    await act(async () => { fireEvent.click(screen.getByText('consume')) })
    expect(screen.getByTestId('highlight')).toHaveTextContent('')
    authApi.googleLogin.mockResolvedValue(LOGIN())
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(screen.getByTestId('highlight')).toHaveTextContent('')
  })

  it('a new user without device values gets no PATCH; a refused PATCH falls back to GET /me', async () => {
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ newUser: true }))
    await renderGuest()
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(authApi.updateMe).not.toHaveBeenCalled()
    expect(authApi.getMe).toHaveBeenCalledWith('http://api.test', 'g-tok')
    localStorage.setItem('pathsgames.lang', 'fr')
    authApi.updateMe.mockRejectedValue({ response: { status: 400 } })
    authApi.getMe.mockClear()
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    // the first login cached the profile high contrast on the device
    expect(authApi.updateMe).toHaveBeenCalledWith('http://api.test', 'g-tok', 'csrf-g', { language: 'fr', highContrast: true })
    expect(authApi.getMe).toHaveBeenCalledTimes(1)
  })

  it('an existing user: no PATCH, the profile overwrites the device values', async () => {
    localStorage.setItem('pathsgames.lang', 'en')
    localStorage.setItem('pathsgames.highContrast', 'false')
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ newUser: false }))
    await renderGuest()
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(authApi.updateMe).not.toHaveBeenCalled()
    await waitFor(() => expect(i18n.setLang).toHaveBeenCalledWith('it'))
    expect(localStorage.getItem('pathsgames.highContrast')).toBe('true')
  })

  it('a login whose profile cannot be read keeps the login answer', async () => {
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ language: 'fr' }))
    authApi.getMe.mockRejectedValue(new Error('down'))
    await renderGuest()
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:g-tok')
    expect(screen.getByTestId('stats')).toHaveTextContent('-')
    expect(i18n.setLang).not.toHaveBeenCalled()
  })

  it('a reload of a Google session applies the profile; the same language is not set again', async () => {
    i18n.lang = 'it'
    await renderGoogle()
    expect(screen.getByTestId('stats')).toHaveTextContent('2')
    await act(async () => { await Promise.resolve() })
    expect(i18n.setLang).not.toHaveBeenCalled()
    expect(localStorage.getItem('pathsgames.highContrast')).toBe('true')
  })

  it('page return re-reads /me; a language changed elsewhere waits for the requests in flight', async () => {
    i18n.lang = 'it'
    await renderGoogle()
    authApi.getMe.mockResolvedValue(ME({ language: 'en', preferences: { language: 'en', highContrast: false },
      stats: { matchesPlayed: 5 } }))
    beginRequest()
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(screen.getByTestId('stats')).toHaveTextContent('5'))
    expect(i18n.setLang).not.toHaveBeenCalled()
    await act(async () => { endRequest() })
    await waitFor(() => expect(i18n.setLang).toHaveBeenCalledWith('en'))
  })

  it('a guest refresh updates the statistics and never touches the language', async () => {
    authApi.getMe.mockResolvedValue({ accountType: 'GUEST', language: 'it', stats: { matchesPlayed: 1 } })
    await renderGuest()
    await act(async () => { await ctx.refreshProfile() })
    expect(screen.getByTestId('stats')).toHaveTextContent('1')
    expect(i18n.setLang).not.toHaveBeenCalled()
  })

  it('refreshProfile: a 401 restores the session, other errors are ignored', async () => {
    await renderGuest()
    authApi.getMe.mockRejectedValueOnce({ response: { status: 500 } })
    await act(async () => { expect(await ctx.refreshProfile()).toBeNull() })
    authApi.resumeGuestSession.mockClear()
    authApi.getMe.mockRejectedValueOnce({ response: { status: 401 } })
    await act(async () => { await ctx.refreshProfile() })
    expect(authApi.resumeGuestSession).toHaveBeenCalled()
  })

  it('a /me answer for an older session is dropped', async () => {
    await renderGuest()
    let resolveMe
    authApi.getMe.mockImplementationOnce(() => new Promise((r) => { resolveMe = r }))
    let pending
    act(() => { pending = ctx.refreshProfile() })
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN())
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:g-tok')
    resolveMe({ accountType: 'GUEST', stats: { matchesPlayed: 9 } })
    let out
    await act(async () => { out = await pending })
    expect(out).toBeNull()
    expect(screen.getByTestId('stats')).toHaveTextContent('2')
  })

  it('refreshProfile does nothing without a session', async () => {
    authApi.resumeGuestSession.mockResolvedValue(null)
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(authApi.createGuestSession).toHaveBeenCalled())
    authApi.getMe.mockClear()
    await act(async () => { expect(await ctx.refreshProfile()).toBeNull() })
    expect(authApi.getMe).not.toHaveBeenCalled()
  })

  it('a guest saves preferences on the device only', async () => {
    await renderGuest()
    await act(async () => { expect(await ctx.savePreferences({ language: 'it', highContrast: true })).toBe(true) })
    expect(authApi.updateMe).not.toHaveBeenCalled()
    expect(i18n.setLang).toHaveBeenCalledWith('it')
    expect(localStorage.getItem('pathsgames.highContrast')).toBe('true')
  })

  it('a Google user saves with PATCH, then the i18n context and the cache', async () => {
    await renderGoogle()
    i18n.setLang.mockClear()
    authApi.updateMe.mockResolvedValue(ME({ preferences: { language: 'en', highContrast: false } }))
    await act(async () => { expect(await ctx.savePreferences({ language: 'en' })).toBe(true) })
    expect(authApi.updateMe).toHaveBeenCalledWith('http://api.test', 'g-tok', 'csrf-g', { language: 'en' })
    expect(i18n.setLang).toHaveBeenCalledWith('en')
    expect(screen.getByTestId('pref')).toHaveTextContent('en')
  })

  it('a save of the high contrast alone keeps the language; an answer for an older session is dropped', async () => {
    await renderGoogle()
    i18n.setLang.mockClear()
    let resolvePatch
    authApi.updateMe.mockImplementationOnce(() => new Promise((r) => { resolvePatch = r }))
    let pending
    act(() => { pending = ctx.savePreferences({ highContrast: false }) })
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(LOGIN({ accessToken: 'g-tok2' }))
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    resolvePatch(ME({ stats: { matchesPlayed: 7 } }))
    await act(async () => { expect(await pending).toBe(true) })
    expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:g-tok2')
    expect(screen.getByTestId('stats')).toHaveTextContent('2')
    expect(localStorage.getItem('pathsgames.highContrast')).toBe('false')
  })

  it('an unmounted provider ignores a late server status', async () => {
    let resolveStatus
    echoApi.getServerStatus.mockImplementation(() => new Promise((r) => { resolveStatus = r }))
    const { unmount } = render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(echoApi.getServerStatus).toHaveBeenCalled())
    unmount()
    await act(async () => { resolveStatus({ googleEnabled: true, supportedLanguages: ['en'] }) })
  })

  it('a refused save keeps the language and exposes the code', async () => {
    await renderGoogle()
    i18n.setLang.mockClear()
    authApi.updateMe.mockRejectedValue({ response: { data: { error: 'INVALID_REQUEST' } } })
    await act(async () => { expect(await ctx.savePreferences({ language: 'it' })).toBe(false) })
    expect(i18n.setLang).not.toHaveBeenCalled()
    expect(screen.getByTestId('profile-error')).toHaveTextContent('INVALID_REQUEST')
    act(() => ctx.clearProfileError())
    expect(screen.getByTestId('profile-error')).toHaveTextContent('')
    authApi.updateMe.mockRejectedValue(new Error('down'))
    await act(async () => { await ctx.savePreferences({ language: 'it' }) })
    expect(screen.getByTestId('profile-error')).toHaveTextContent('PROFILE_SAVE_FAILED')
  })

  it('logout of all devices: every session closed, the other tabs told, the home reloaded', async () => {
    await renderGoogle()
    vi.spyOn(authApi, 'logoutAll').mockResolvedValue({ status: 'OK' })
    await act(async () => { expect(await ctx.logoutAll()).toBe(true) })
    expect(authApi.logoutAll).toHaveBeenCalledWith('http://api.test', 'g-tok')
    expect(channels[0].posted).toEqual([{ type: 'logout' }])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a failed logout of all devices stays signed in with the error', async () => {
    await renderGoogle()
    vi.spyOn(authApi, 'logoutAll').mockRejectedValue(new Error('down'))
    await act(async () => { expect(await ctx.logoutAll()).toBe(false) })
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByTestId('profile-error')).toHaveTextContent('LOGOUT_ALL_FAILED')
    expect(ctx.authBusy).toBe(false)
  })

  it('account deletion: the fresh token and its nonce, then the closing state and a reload on close', async () => {
    await renderGoogle()
    vi.spyOn(gis, 'takeNonce').mockReturnValue('del-nonce')
    vi.spyOn(authApi, 'deleteMe').mockResolvedValue({ status: 'DELETING' })
    await act(async () => { expect(await ctx.deleteAccount('fresh-id')).toBe(true) })
    expect(authApi.deleteMe).toHaveBeenCalledWith('http://api.test', 'g-tok', { idToken: 'fresh-id', nonce: 'del-nonce' })
    expect(screen.getByTestId('deleted')).toHaveTextContent('deleted')
    expect(channels[0].posted).toEqual([{ type: 'logout' }])
    authApi.getMe.mockClear()
    await act(async () => { expect(await ctx.refreshProfile()).toBeNull() })
    expect(authApi.getMe).not.toHaveBeenCalled()
    act(() => ctx.closeGuestModal())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a refused deletion keeps the account and exposes FRESH_TOKEN_REQUIRED', async () => {
    await renderGoogle()
    vi.spyOn(authApi, 'deleteMe').mockRejectedValue({ response: { data: { error: 'FRESH_TOKEN_REQUIRED' } } })
    await act(async () => { expect(await ctx.deleteAccount('old-id')).toBe(false) })
    expect(screen.getByTestId('profile-error')).toHaveTextContent('FRESH_TOKEN_REQUIRED')
    expect(screen.getByTestId('deleted')).toHaveTextContent('alive')
    act(() => ctx.closeGuestModal())
    expect(reload).not.toHaveBeenCalled()
  })
})
