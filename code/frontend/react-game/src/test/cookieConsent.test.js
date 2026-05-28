import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the library so we can capture the config passed to CookieConsent.run and
// drive the consent callbacks without rendering the real banner.
const { run, showPreferences, setLanguage, acceptedCategory, state } = vi.hoisted(() => {
  const state = { acceptedAnalytics: false }
  return {
    state,
    run: vi.fn(),
    showPreferences: vi.fn(),
    setLanguage: vi.fn(),
    acceptedCategory: vi.fn((c) => (c === 'analytics' ? state.acceptedAnalytics : true)),
  }
})

vi.mock('vanilla-cookieconsent', () => ({ run, showPreferences, setLanguage, acceptedCategory }))
vi.mock('vanilla-cookieconsent/dist/cookieconsent.css', () => ({}))

beforeEach(() => {
  vi.resetModules() // reset the module-level `started` guard between tests
  run.mockClear()
  showPreferences.mockClear()
  setLanguage.mockClear()
  state.acceptedAnalytics = false
  window.gtag = vi.fn()
})

describe('cookieConsent config', () => {
  it('declares necessary (read-only) + analytics off by default', async () => {
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    expect(run).toHaveBeenCalledTimes(1)
    const cfg = run.mock.calls[0][0]
    expect(cfg.categories.necessary).toEqual({ enabled: true, readOnly: true })
    expect(cfg.categories.analytics).toEqual({})
    expect(cfg.categories.analytics.enabled).toBeUndefined()
    expect(Object.keys(cfg.language.translations)).toEqual(['en', 'it'])
  })

  it('runs only once (idempotent)', async () => {
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    initCookieConsent('en')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('cookieConsent → gtag bridge', () => {
  it('grants storage when analytics is accepted', async () => {
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    const cfg = run.mock.calls[0][0]
    state.acceptedAnalytics = true
    cfg.onConsent()
    expect(window.gtag).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'granted' })
    )
  })

  it('denies storage when analytics is rejected', async () => {
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    const cfg = run.mock.calls[0][0]
    state.acceptedAnalytics = false
    cfg.onChange()
    expect(window.gtag).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'denied' })
    )
  })
})

describe('cookieConsent helpers', () => {
  it('openCookiePreferences delegates to showPreferences', async () => {
    const mod = await import('../consent/cookieConsent')
    mod.openCookiePreferences()
    expect(showPreferences).toHaveBeenCalledTimes(1)
  })

  it('setConsentLanguage ignored before init and for unknown langs', async () => {
    const { initCookieConsent, setConsentLanguage } = await import('../consent/cookieConsent')
    setConsentLanguage('it')
    expect(setLanguage).not.toHaveBeenCalled()
    initCookieConsent('en')
    setConsentLanguage('it')
    expect(setLanguage).toHaveBeenCalledWith('it')
    setLanguage.mockClear()
    setConsentLanguage('xx')
    expect(setLanguage).not.toHaveBeenCalled()
  })
})
