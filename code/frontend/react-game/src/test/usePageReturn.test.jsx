// v1.7.0 V1 step 7 — the page-return hook: visible again, back-forward cache, online; bursts count once.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import usePageReturn, { PAGE_RETURN_EVENTS, PAGE_RETURN_MIN_INTERVAL_MS } from '../hooks/usePageReturn'

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

function pageShow(persisted) {
  const event = new Event('pageshow')
  event.persisted = persisted
  window.dispatchEvent(event)
}

describe('usePageReturn', () => {
  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('exposes its code constants', () => {
    expect(PAGE_RETURN_EVENTS).toEqual(['visibilitychange', 'pageshow', 'online'])
    expect(PAGE_RETURN_MIN_INTERVAL_MS).toBeGreaterThan(0)
  })

  it('fires when the page is visible again, restored from the cache or back online', () => {
    const onReturn = vi.fn()
    renderHook(() => usePageReturn(onReturn, { minIntervalMs: 0 }))
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onReturn).not.toHaveBeenCalled()
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onReturn).toHaveBeenCalledTimes(1)
    pageShow(false)
    expect(onReturn).toHaveBeenCalledTimes(1)
    pageShow(true)
    expect(onReturn).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('online'))
    expect(onReturn).toHaveBeenCalledTimes(3)
  })

  it('a burst of events counts once within the minimum interval', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const onReturn = vi.fn()
    renderHook(() => usePageReturn(onReturn))
    document.dispatchEvent(new Event('visibilitychange'))
    pageShow(true)
    window.dispatchEvent(new Event('online'))
    expect(onReturn).toHaveBeenCalledTimes(1)
    vi.setSystemTime(10_000 + PAGE_RETURN_MIN_INTERVAL_MS)
    window.dispatchEvent(new Event('online'))
    expect(onReturn).toHaveBeenCalledTimes(2)
  })

  it('uses the latest callback, does nothing when disabled and stops on unmount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ cb, enabled }) => usePageReturn(cb, { enabled, minIntervalMs: 0 }),
      { initialProps: { cb: first, enabled: false } })
    window.dispatchEvent(new Event('online'))
    expect(first).not.toHaveBeenCalled()
    rerender({ cb: second, enabled: true })
    window.dispatchEvent(new Event('online'))
    expect(second).toHaveBeenCalledTimes(1)
    unmount()
    window.dispatchEvent(new Event('online'))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('works with the default options', () => {
    const onReturn = vi.fn()
    renderHook(() => usePageReturn(onReturn))
    window.dispatchEvent(new Event('online'))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})
