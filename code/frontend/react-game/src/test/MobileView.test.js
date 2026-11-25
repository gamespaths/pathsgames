import { describe, it, expect, vi, afterEach } from 'vitest'
import { MOBILE_MQ, isMobileViewport, scrollMobileIntoView, scrollBookToTop } from '@/features/gameplay/js/mobileView'

describe('mobileView — when the stacked mobile layout is on', () => {
  afterEach(() => { delete window.matchMedia })

  it('MOBILE_MQ covers narrow screens and low medium screens held in landscape', () => {
    expect(MOBILE_MQ).toBe('(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)')
  })

  it('isMobileViewport asks the browser with MOBILE_MQ and returns its answer', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    expect(isMobileViewport()).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_MQ)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    expect(isMobileViewport()).toBe(false)
  })

  it('isMobileViewport is false when the browser has no matchMedia', () => {
    delete window.matchMedia
    expect(isMobileViewport()).toBe(false)
  })
})

describe('mobileView v1.13.0 — the document scrolls, not .book-overlay', () => {
  afterEach(() => { delete window.matchMedia; vi.restoreAllMocks() })

  function stubDom() {
    const scrollIntoView = vi.fn()
    const overlayScroll = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0 })
    vi.spyOn(document, 'querySelector').mockImplementation(sel => (
      sel === '.book-overlay' ? { scrollTo: overlayScroll } : { scrollIntoView, sel }))
    return { scrollIntoView, overlayScroll, qs: document.querySelector }
  }

  it('scrollMobileIntoView: smooth by default, the given behavior otherwise; a no-op on desktop', () => {
    const { scrollIntoView } = stubDom()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    scrollMobileIntoView('.book-mobile-right')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    scrollMobileIntoView('.book-mobile-right', 'auto')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    scrollIntoView.mockClear()
    scrollMobileIntoView('.book-mobile-right')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrollBookToTop brings the top of the stack into view, never scrolls .book-overlay', () => {
    const { scrollIntoView, overlayScroll, qs } = stubDom()
    scrollBookToTop()
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    expect(qs).toHaveBeenCalledWith('.book-mobile-left')
    expect(qs).not.toHaveBeenCalledWith('.book-overlay')
    expect(overlayScroll).not.toHaveBeenCalled()
    scrollBookToTop('auto')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
  })
})
