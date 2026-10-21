import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), create: vi.fn() } }))

import axios from 'axios'
import { googleLogin, refreshSession, getMe, logoutSession } from '../api/auth'
import { apiClient, retryOn401, setUnauthorizedHandler } from '../api/client'
import { loadGis, resetGisLoader, newNonce, takeNonce, NONCE_KEY, GIS_SRC } from '../auth/gisLoader'
import { withRefreshLock, openSessionChannel, CHANNEL, REFRESH_LOCK } from '../auth/sessionSync'
import { MATCH_STATUS_BADGE, matchStatusGroup, storyBadge } from '../utils/matchStatus'

describe('v1.2.0 api/auth — Google sign-in and sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('googleLogin posts the token, nonce and language with the guest bearer', async () => {
    axios.post.mockResolvedValue({ data: { userUuid: 'u', accessToken: 'a' } })
    const out = await googleLogin('http://s', { idToken: 'id', nonce: 'n', language: 'it' }, 'guest-tok')
    expect(out.userUuid).toBe('u')
    expect(axios.post).toHaveBeenCalledWith('http://s/api/auth/google', { idToken: 'id', nonce: 'n', language: 'it' },
      expect.objectContaining({ withCredentials: true, headers: { Authorization: 'Bearer guest-tok' } }))
    await googleLogin('http://s', { idToken: 'id', nonce: 'n' })
    expect(axios.post.mock.calls[1][1]).toEqual({ idToken: 'id', nonce: 'n' })
    expect(axios.post.mock.calls[1][2].headers).toBeUndefined()
  })

  it('refresh, me and logout', async () => {
    axios.post.mockResolvedValue({ data: { accessToken: 'r' } })
    axios.get.mockResolvedValue({ data: { nickname: 'mario' } })
    expect((await refreshSession('http://s')).accessToken).toBe('r')
    expect((await getMe('http://s', 't')).nickname).toBe('mario')
    expect(axios.get).toHaveBeenCalledWith('http://s/api/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer t' } }))
    await logoutSession('http://s', 't')
    expect(axios.post).toHaveBeenLastCalledWith('http://s/api/auth/logout', null,
      expect.objectContaining({ withCredentials: true }))
  })
})

describe('v1.2.0 api/client — one refresh on a 401', () => {
  afterEach(() => setUnauthorizedHandler(null))

  it('retries once with the new bearer', async () => {
    const instance = { request: vi.fn().mockResolvedValue({ data: 'ok' }) }
    setUnauthorizedHandler(vi.fn().mockResolvedValue('new-tok'))
    const error = { response: { status: 401 }, config: { url: '/api/matches', headers: { a: 1 } } }
    expect(await retryOn401(instance, error)).toEqual({ data: 'ok' })
    expect(instance.request.mock.calls[0][0].headers).toEqual({ a: 1, Authorization: 'Bearer new-tok' })
    expect(instance.request.mock.calls[0][0]._pgRetried).toBe(true)
  })

  it('rethrows the other errors, auth paths, a second 401 and a failed refresh', async () => {
    const instance = { request: vi.fn() }
    await expect(retryOn401(instance, { response: { status: 500 }, config: {} })).rejects.toBeTruthy()
    setUnauthorizedHandler(vi.fn().mockResolvedValue(null))
    await expect(retryOn401(instance, { response: { status: 401 }, config: { url: '/api/matches' } })).rejects.toBeTruthy()
    await expect(retryOn401(instance, { response: { status: 401 }, config: { url: '/api/auth/me' } })).rejects.toBeTruthy()
    await expect(retryOn401(instance, { response: { status: 401 }, config: { url: '/x', _pgRetried: true } })).rejects.toBeTruthy()
    await expect(retryOn401(instance, { response: { status: 401 } })).rejects.toBeTruthy()
    setUnauthorizedHandler(null)
    await expect(retryOn401(instance, { response: { status: 401 }, config: { url: '/x' } })).rejects.toBeTruthy()
    expect(instance.request).not.toHaveBeenCalled()
  })

  it('apiClient installs the interceptor', async () => {
    let onError
    const instance = { interceptors: { response: { use: vi.fn((ok, ko) => { onError = ko; expect(ok('r')).toBe('r') }) } } }
    axios.create.mockReturnValue(instance)
    expect(apiClient()).toBe(instance)
    await expect(onError({ response: { status: 500 } })).rejects.toBeTruthy()
  })
})

describe('v1.2.0 GIS loader and nonce', () => {
  beforeEach(() => {
    resetGisLoader()
    delete window.google
    document.head.innerHTML = ''
  })

  it('loads the script once, on demand', async () => {
    const p1 = loadGis()
    const p2 = loadGis()
    expect(p1).toBe(p2)
    const script = document.head.querySelector('script')
    expect(script.src).toBe(GIS_SRC)
    window.google = { accounts: { id: { tag: 'gis' } } }
    script.onload()
    await expect(p1).resolves.toEqual({ tag: 'gis' })
    await expect(loadGis()).resolves.toEqual({ tag: 'gis' })
  })

  it('fails when the script errors or exposes nothing', async () => {
    const p = loadGis()
    document.head.querySelector('script').onerror()
    await expect(p).rejects.toThrow('gis-unavailable')
    const q = loadGis()
    document.head.querySelectorAll('script')[1].onload()
    await expect(q).rejects.toThrow('gis-unavailable')
  })

  it('nonce stored and consumed once', () => {
    const nonce = newNonce()
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(sessionStorage.getItem(NONCE_KEY)).toBe(nonce)
    expect(takeNonce()).toBe(nonce)
    expect(takeNonce('fallback')).toBe('fallback')
  })

  it('storage errors never break the nonce', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private') })
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private') })
    expect(newNonce()).toHaveLength(32)
    expect(takeNonce('f')).toBe('f')
    set.mockRestore()
    get.mockRestore()
  })
})

describe('v1.2.0 session sync between tabs', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('uses Web Locks when the browser has them', async () => {
    const request = vi.fn((name, fn) => fn())
    vi.stubGlobal('navigator', { locks: { request } })
    expect(await withRefreshLock(() => 7)).toBe(7)
    expect(request).toHaveBeenCalledWith(REFRESH_LOCK, expect.any(Function))
  })

  it('chains the refreshes without Web Locks, even after a failure', async () => {
    vi.stubGlobal('navigator', {})
    const order = []
    const a = withRefreshLock(async () => { order.push('a'); throw new Error('x') })
    const b = withRefreshLock(async () => { order.push('b'); return 'b' })
    await expect(a).rejects.toThrow('x')
    expect(await b).toBe('b')
    expect(order).toEqual(['a', 'b'])
  })

  it('the channel posts and receives the session events', () => {
    const instances = []
    class FakeChannel {
      constructor(name) { this.name = name; this.posted = []; instances.push(this) }
      postMessage(m) { this.posted.push(m) }
      close() { this.closed = true }
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const seen = []
    const channel = openSessionChannel((type) => seen.push(type))
    channel.post('login')
    instances[0].onmessage({ data: { type: 'logout' } })
    instances[0].onmessage({})
    channel.close()
    expect(instances[0].name).toBe(CHANNEL)
    expect(instances[0].posted).toEqual([{ type: 'login' }])
    expect(seen).toEqual(['logout', undefined])
    expect(instances[0].closed).toBe(true)
  })

  it('without BroadcastChannel the channel is a no-op', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const channel = openSessionChannel(() => {})
    channel.post('login')
    channel.close()
  })
})

describe('v1.2.0 CANCELLED match status', () => {
  it('has a plain badge and sorts with the finished matches, never as completed', () => {
    expect(MATCH_STATUS_BADGE.CANCELLED.tone).toBe('completed')
    expect(matchStatusGroup('CANCELLED')).toBe(2)
    if (typeof storyBadge === 'function') {
      expect(storyBadge([{ storyUuid: 's', status: 'CANCELLED' }], 's')).not.toBe('completed')
    }
  })
})
