import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { GuestUserProvider, useGuestUser, toIdentity, authErrorCode } from '@/features/guest-user/GuestUserContext'
import * as authApi from '../api/auth'
import * as echoApi from '../api/echoApi'
import * as client from '../api/client'
import * as gis from '../auth/gisLoader'

const reload = vi.hoisted(() => vi.fn())
vi.mock('../auth/reloadHome', () => ({ reloadHome: reload }))

vi.mock('../context/ServerContext', () => ({ useServer: () => ({ server: 'http://api.test' }) }))

const setLang = vi.fn()
vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: 'en', setLang }) }))

const channels = []
class FakeChannel {
  constructor() { this.posted = []; channels.push(this) }
  postMessage(m) { this.posted.push(m) }
  close() {}
}

function Probe() {
  const ctx = useGuestUser()
  return (
    <div>
      <span data-testid="who">{ctx.user ? `${ctx.user.accountType}:${ctx.user.nickname}:${ctx.user.accessToken}` : 'none'}</span>
      <span data-testid="google">{ctx.googleEnabled ? `on:${ctx.googleClientId}` : 'off'}</span>
      <span data-testid="auth-error">{ctx.authError ?? ''}</span>
      <span data-testid="idle">{ctx.sessionIdle ? 'idle' : 'busy'}</span>
      <span data-testid="google-user">{ctx.isGoogleUser ? 'yes' : 'no'}</span>
      <button onClick={() => ctx.loginWithGoogle('id-token')}>login</button>
      <button onClick={() => ctx.logout()}>logout</button>
      <button onClick={() => ctx.ensureGuest()}>ensure</button>
      <button onClick={() => ctx.clearAuthError()}>clear-error</button>
      <button onClick={() => ctx.refreshGuest()}>refresh-guest</button>
    </div>
  )
}

const GOOGLE = { userUuid: 'g1', username: 'google_g1', nickname: 'mario', displayName: 'Mario Rossi',
  pictureUrl: 'pic', accountType: 'GOOGLE', role: 'PLAYER', accessToken: 'g-tok', language: 'it' }

describe('GuestUserContext v1.2.0 — Google sessions', () => {
  let handler
  beforeEach(() => {
    vi.restoreAllMocks()
    channels.length = 0
    setLang.mockReset()
    localStorage.clear()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    vi.spyOn(echoApi, 'getServerStatus').mockResolvedValue({ googleEnabled: true, googleClientId: 'cid' })
    vi.spyOn(authApi, 'refreshSession').mockRejectedValue(new Error('no cookie'))
    vi.spyOn(authApi, 'resumeGuestSession').mockResolvedValue({ userUuid: 'u1', username: 'guest_u1', accessToken: 'guest-tok' })
    vi.spyOn(authApi, 'createGuestSession').mockResolvedValue({ userUuid: 'u2', username: 'guest_u2', accessToken: 'new-tok' })
    vi.spyOn(authApi, 'getMe').mockResolvedValue(GOOGLE)
    vi.spyOn(client, 'setUnauthorizedHandler').mockImplementation((fn) => { handler = fn })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads the Google switch and client id of the server', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('google')).toHaveTextContent('on:cid'))
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GUEST:guest_u1:guest-tok'))
  })

  it('an unreachable status hides the Google button', async () => {
    echoApi.getServerStatus.mockRejectedValue(new Error('down'))
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    expect(screen.getByTestId('google')).toHaveTextContent('off')
  })

  it('a reload keeps the Google session through the refresh cookie', async () => {
    authApi.refreshSession.mockResolvedValue({ userUuid: 'g1', username: 'google_g1', accessToken: 'g-tok2' })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:mario:g-tok2'))
    expect(screen.getByTestId('google-user')).toHaveTextContent('yes')
    expect(authApi.resumeGuestSession).not.toHaveBeenCalled()
  })

  it('a refresh without /me still keeps the basic identity', async () => {
    authApi.refreshSession.mockResolvedValue({ userUuid: 'u1', username: 'guest_u1', accessToken: 't3' })
    authApi.getMe.mockRejectedValue(new Error('x'))
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GUEST:guest_u1:t3'))
  })

  it('a session closed elsewhere is said, then the guest resumes', async () => {
    authApi.refreshSession.mockRejectedValue({ response: { data: { error: 'SESSION_REVOKED' } } })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    expect(screen.getByTestId('auth-error')).toHaveTextContent('SESSION_REVOKED')
    fireEvent.click(screen.getByText('clear-error'))
    expect(screen.getByTestId('auth-error')).toHaveTextContent('')
  })

  it('signs in with Google: nonce, device language, the guest bearer, the other tabs', async () => {
    localStorage.setItem('pathsgames.lang', 'it')
    vi.spyOn(gis, 'takeNonce').mockReturnValue('nonce-1')
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(GOOGLE)
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(authApi.googleLogin).toHaveBeenCalledWith('http://api.test',
      { idToken: 'id-token', nonce: 'nonce-1', language: 'it' }, 'guest-tok')
    expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:mario:g-tok')
    expect(channels[0].posted).toEqual([{ type: 'login' }])
    // v1.7.0 — an existing Google user: the profile language overwrites the device one
    await waitFor(() => expect(setLang).toHaveBeenCalledWith('it'))
  })

  it('a new device follows the profile language; a refusal keeps its code', async () => {
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue(GOOGLE)
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(setLang).toHaveBeenCalledWith('it')
    authApi.googleLogin.mockRejectedValue({ response: { data: { error: 'EMAIL_DOMAIN_NOT_ALLOWED' } } })
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(screen.getByTestId('auth-error')).toHaveTextContent('EMAIL_DOMAIN_NOT_ALLOWED')
  })

  it('logout closes the session, tells the other tabs and reloads the home', async () => {
    reload.mockClear()
    authApi.refreshSession.mockResolvedValueOnce({ userUuid: 'g1', username: 'google_g1', accessToken: 'g' })
    vi.spyOn(authApi, 'logoutSession').mockResolvedValue({ status: 'OK' })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('google-user')).toHaveTextContent('yes'))
    await act(async () => { fireEvent.click(screen.getByText('logout')) })
    expect(authApi.logoutSession).toHaveBeenCalledWith('http://api.test', 'g')
    expect(channels[0].posted).toEqual([{ type: 'logout' }])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a logout whose session is already gone still reloads the home', async () => {
    reload.mockClear()
    vi.spyOn(authApi, 'logoutSession').mockRejectedValue(new Error('already gone'))
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    await act(async () => { fireEvent.click(screen.getByText('logout')) })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('idle after a lost session: the first Play creates the guest once', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    authApi.resumeGuestSession.mockRejectedValue(new Error('gone'))
    await act(async () => { await handler() })
    expect(screen.getByTestId('who')).toHaveTextContent('none')
    expect(screen.getByTestId('idle')).toHaveTextContent('idle')
    await act(async () => { fireEvent.click(screen.getByText('ensure')) })
    expect(screen.getByTestId('who')).toHaveTextContent('GUEST:guest_u2:new-tok')
    await act(async () => { fireEvent.click(screen.getByText('ensure')) })
    expect(authApi.createGuestSession).toHaveBeenCalledTimes(1)
  })

  it('the 401 handler refreshes, else resumes, else goes idle', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    authApi.refreshSession.mockResolvedValueOnce({ userUuid: 'g1', username: 'google_g1', accessToken: 'fresh' })
    let token
    await act(async () => { token = await handler() })
    expect(token).toBe('fresh')
    authApi.resumeGuestSession.mockRejectedValue(new Error('gone'))
    await act(async () => { token = await handler() })
    expect(token).toBeNull()
    expect(screen.getByTestId('idle')).toHaveTextContent('idle')
  })

  it('another tab signing in makes this one reload its session', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    authApi.refreshSession.mockResolvedValueOnce({ userUuid: 'g1', username: 'google_g1', accessToken: 'tab2' })
    await act(async () => { channels[channels.length - 1].onmessage({ data: { type: 'login' } }) })
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('GOOGLE:mario:tab2'))
    await act(async () => { channels[channels.length - 1].onmessage({ data: { type: 'other' } }) })
  })

  it('refreshGuest makes a new guest and leaves the idle state', async () => {
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    await act(async () => { fireEvent.click(screen.getByText('refresh-guest')) })
    expect(screen.getByTestId('who')).toHaveTextContent('guest_u2')
  })

  it('identity and error helpers', () => {
    expect(toIdentity(null)).toBeNull()
    expect(toIdentity({ userUuid: 'u', username: 'n' })).toMatchObject({ nickname: 'n', displayName: 'n',
      accountType: 'GUEST', role: 'PLAYER', accessToken: null, csrfToken: null })
    expect(toIdentity({ accessToken: 'a' }, { csrfToken: 'c', nickname: 'm' }).csrfToken).toBe('c')
    expect(authErrorCode({})).toBe('GOOGLE_LOGIN_FAILED')
    expect(authErrorCode({ response: { data: { error: '' } } }, null)).toBeNull()
  })

  it('the device language is optional (private mode)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private') })
    vi.spyOn(authApi, 'googleLogin').mockResolvedValue({ ...GOOGLE, language: undefined })
    render(<GuestUserProvider><Probe /></GuestUserProvider>)
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('guest_u1'))
    await act(async () => { fireEvent.click(screen.getByText('login')) })
    expect(authApi.googleLogin.mock.calls[0][1].language).toBeUndefined()
    spy.mockRestore()
  })
})
