// v1.7.0 V1 step 8 — the page-return refetch: webkit filter, all, hidden seconds, pageshow, online, in flight.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useMatchRefetchOnReturn, { isWebkitBrowser, shouldRefetchOnReturn } from '../hooks/useMatchRefetchOnReturn'
import usePageReturn from '../hooks/usePageReturn'
import { beginRequest, resetInFlight } from '../api/inFlight'

const SAFARI = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', maxTouchPoints: 0 }
const IPAD_AS_MAC = { ...SAFARI, maxTouchPoints: 5 }
const IPHONE_CHROME = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0 Mobile/15E148 Safari/604.1' }
const CHROME = { userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', maxTouchPoints: 0 }
const EDGE = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0' }
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Version/4.0 Safari/537.36' }
const FIREFOX = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0' }

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

function hideFor(ms) {
  setVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  vi.setSystemTime(Date.now() + ms)
  setVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('webkit detection', () => {
  it.each([
    ['desktop Safari', SAFARI, true], ['iPadOS as a Mac with touch', IPAD_AS_MAC, true],
    ['Chrome on iPhone', IPHONE_CHROME, true], ['desktop Chrome', CHROME, false], ['Edge', EDGE, false],
    ['Chrome Android', ANDROID, false], ['Firefox', FIREFOX, false], ['no navigator', null, false],
  ])('%s', (_name, nav, expected) => {
    expect(isWebkitBrowser(nav)).toBe(expected)
  })

  it('reads the default navigator', () => {
    expect(typeof isWebkitBrowser()).toBe('boolean')
  })

  it('the browsers parameter', () => {
    expect(shouldRefetchOnReturn(['all'], CHROME)).toBe(true)
    expect(shouldRefetchOnReturn(['WEBKIT'], SAFARI)).toBe(true)
    expect(shouldRefetchOnReturn(['webkit'], CHROME)).toBe(false)
    expect(shouldRefetchOnReturn(undefined, SAFARI)).toBe(false)
  })
})

describe('useMatchRefetchOnReturn', () => {
  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible')
    resetInFlight()
  })

  it('refetches after the minimum hidden time only', () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const onRefetch = vi.fn()
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['all'], minHiddenSeconds: 30 }))
    hideFor(10_000)
    expect(onRefetch).not.toHaveBeenCalled()
    vi.setSystemTime(Date.now() + 5_000)
    hideFor(31_000)
    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('a back-forward cache restore counts the time since pagehide', () => {
    vi.useFakeTimers()
    vi.setSystemTime(200_000)
    const onRefetch = vi.fn()
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['webkit'], minHiddenSeconds: 1, nav: SAFARI }))
    window.dispatchEvent(new Event('pagehide'))
    vi.setSystemTime(Date.now() + 2_000)
    const show = new Event('pageshow')
    show.persisted = true
    window.dispatchEvent(show)
    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('back online refetches at once; a visible without hiding does not', () => {
    vi.useFakeTimers()
    vi.setSystemTime(300_000)
    const onRefetch = vi.fn()
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['all'] }))
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefetch).not.toHaveBeenCalled()
    vi.setSystemTime(Date.now() + 5_000)
    window.dispatchEvent(new Event('online'))
    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('never refetches while a request is in flight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(400_000)
    const onRefetch = vi.fn()
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['all'], minHiddenSeconds: 0 }))
    beginRequest()
    hideFor(5_000)
    window.dispatchEvent(new Event('online'))
    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('does nothing on a filtered browser or when disabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(500_000)
    const onRefetch = vi.fn()
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['webkit'], minHiddenSeconds: 0, nav: ANDROID }))
    renderHook(() => useMatchRefetchOnReturn(onRefetch, { browsers: ['all'], minHiddenSeconds: 0, enabled: false }))
    window.dispatchEvent(new Event('pagehide'))
    hideFor(60_000)
    window.dispatchEvent(new Event('online'))
    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('usePageReturn tells which event fired', () => {
    const onReturn = vi.fn()
    renderHook(() => usePageReturn(onReturn, { minIntervalMs: 0 }))
    window.dispatchEvent(new Event('online'))
    const show = new Event('pageshow')
    show.persisted = true
    window.dispatchEvent(show)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onReturn.mock.calls.map(c => c[0])).toEqual(['online', 'pageshow', 'visible'])
  })
})
