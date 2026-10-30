import { describe, it, expect, vi, afterEach } from 'vitest'
import { MOBILE_MQ, isMobileViewport } from '@/features/gameplay/js/mobileView'

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
