import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the library so we can capture the config passed to CookieConsent.run and
// drive the consent callbacks without rendering the real banner.
const { run, showPreferences, setLanguage, acceptedCategory, eraseCookies, state } = vi.hoisted(() => {
  const state = { acceptedAnalytics: false }
  return {
    state,
    run: vi.fn(),
    showPreferences: vi.fn(),
    setLanguage: vi.fn(),
    acceptedCategory: vi.fn((c) => (c === 'analytics' ? state.acceptedAnalytics : true)),
    eraseCookies: vi.fn(),
  }
})

vi.mock('vanilla-cookieconsent', () => ({ run, showPreferences, setLanguage, acceptedCategory, eraseCookies }))
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
    expect(cfg.categories.analytics.enabled).toBeUndefined()
    expect(cfg.categories.analytics.autoClear).toBeDefined()
    expect(Object.keys(cfg.language.translations)).toEqual(['en', 'it'])
  })

  it('v1.7.0 step 12 — lifetimes of 180 and 250 days and the browser storage keys in the table', async () => {
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    const cfg = run.mock.calls[0][0]
    for (const lang of ['en', 'it']) {
      const rows = cfg.language.translations[lang].preferencesModal.sections[0].cookieTable.body
      const byName = Object.fromEntries(rows.map(r => [r.name, r.expiration]))
      expect(byName['pathsgames.guestcookie']).toMatch(/^180 /)
      expect(byName['pathsgames.refreshToken']).toMatch(/^250 /)
      const names = rows.map(r => r.name).join(' ')
      for (const key of ['pathsgames.lang', 'pg_game_server', 'pathsgames.googleNonce']) {
        expect(names).toContain(key)
      }
      expect(names).not.toContain('pathsgames.knownAccount')
    }
  })

  it('v1.11.0 turnstilePass shows the configured lifetime and g_state is listed', async () => {
    const { initCookieConsent, turnstilePassExpiration } = await import('../consent/cookieConsent')
    expect(turnstilePassExpiration('en', 3000)).toBe('50 hours')
    expect(turnstilePassExpiration('it', 3000)).toBe('50 ore')
    expect(turnstilePassExpiration('en', 30)).toBe('30 minutes')
    expect(turnstilePassExpiration('it', 30)).toBe('30 minuti')
    initCookieConsent('en')
    const cfg = run.mock.calls[0][0]
    for (const lang of ['en', 'it']) {
      const rows = cfg.language.translations[lang].preferencesModal.sections[0].cookieTable.body
      const pass = rows.find(r => r.name === 'pathsgames.turnstilePass')
      expect(pass.expiration).toBe(turnstilePassExpiration(lang))
      expect(rows.some(r => r.name.startsWith('g_state'))).toBe(true)
    }
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
