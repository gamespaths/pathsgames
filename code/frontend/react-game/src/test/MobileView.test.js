import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  MOBILE_MQ, SIDE_TABS_MQ, isMobileViewport, isSideTabsViewport, scrollMobileIntoView, scrollBookToTop,
  setMobileTurnBusy, mobileTurnBusy,
} from '@/features/gameplay/js/mobileView'

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

  // Step 15 — the desktop side tabs: wider than 1120px (where the cards go from 2 to 3 columns).
  it('SIDE_TABS_MQ and isSideTabsViewport: the desktop side column of tabs', () => {
    expect(SIDE_TABS_MQ).toBe('(min-width: 1121px)')
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    expect(isSideTabsViewport()).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith(SIDE_TABS_MQ)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    expect(isSideTabsViewport()).toBe(false)
    delete window.matchMedia
    expect(isSideTabsViewport()).toBe(false)
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

  it('scrollMobileIntoView: instant by default (step 16), the given behavior otherwise; a no-op on desktop', () => {
    const { scrollIntoView } = stubDom()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    scrollMobileIntoView('.book-page-right')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' })
    scrollMobileIntoView('.book-page-right', 'smooth')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    scrollIntoView.mockClear()
    scrollMobileIntoView('.book-page-right')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  // Step 15 — the tabs stand on the book's top edge (no sticky row): the very top of the document, tabs in view.
  it('scrollBookToTop scrolls the window to the very top on phones, never .book-overlay nor a page', () => {
    const { scrollIntoView, overlayScroll } = stubDom()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    scrollBookToTop()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    scrollBookToTop('smooth')
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(overlayScroll).not.toHaveBeenCalled()
  })

  it('scrollBookToTop is a no-op on desktop and under a mobile turn', () => {
    stubDom()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    scrollBookToTop()
    expect(scrollTo).not.toHaveBeenCalled()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    setMobileTurnBusy(true)
    scrollBookToTop()
    expect(scrollTo).not.toHaveBeenCalled()
    setMobileTurnBusy(false)
    scrollBookToTop()
    expect(scrollTo).toHaveBeenCalledOnce()
  })

  it('step 16 — skipped while a mobile turn holds its sheet: the turn lands the scroll itself', () => {
    const { scrollIntoView } = stubDom()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    setMobileTurnBusy(true)
    expect(mobileTurnBusy()).toBe(true)
    scrollMobileIntoView('.book-page-right')
    expect(scrollIntoView).not.toHaveBeenCalled()
    setMobileTurnBusy(false)
    expect(mobileTurnBusy()).toBe(false)
    scrollMobileIntoView('.book-page-right')
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })
})
