import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import { readPolicyDeepLink, clearPolicyDeepLink, DEEP_LINK_KINDS, POLICY_PARAM } from '../utils/policyDeepLink'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'

// Step 42 — alpha launch polish: ?policy= deep link, EN/IT parity, privacy retention, consent label.

const { run } = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('vanilla-cookieconsent', () => ({
  run, showPreferences: vi.fn(), setLanguage: vi.fn(), acceptedCategory: vi.fn(() => false), eraseCookies: vi.fn(),
}))
vi.mock('vanilla-cookieconsent/dist/cookieconsent.css', () => ({}))

function setUrl(path) {
  window.history.replaceState({ idx: 3, key: 'k' }, '', path)
}

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v) ? flatKeys(v, key) : [key]
  })
}

beforeEach(() => setUrl('/'))
afterEach(() => setUrl('/'))

describe('readPolicyDeepLink', () => {
  it('returns each supported kind, case and blanks tolerated', () => {
    expect(DEEP_LINK_KINDS).toEqual(['privacy', 'cookies', 'terms', 'roadmap'])
    expect(readPolicyDeepLink('?policy=roadmap')).toBe('roadmap')
    expect(readPolicyDeepLink('?policy=privacy')).toBe('privacy')
    expect(readPolicyDeepLink('?policy=cookies')).toBe('cookies')
    expect(readPolicyDeepLink('?x=1&policy=%20TERMS%20')).toBe('terms')
  })

  it('ignores unknown, missing and non deep-linkable values', () => {
    expect(readPolicyDeepLink('?policy=evil')).toBeNull()
    expect(readPolicyDeepLink('?policy=credits')).toBeNull()
    expect(readPolicyDeepLink('?policy=')).toBeNull()
    expect(readPolicyDeepLink('')).toBeNull()
  })

  it('reads window.location by default', () => {
    setUrl('/?policy=cookies')
    expect(readPolicyDeepLink()).toBe('cookies')
  })
})

describe('clearPolicyDeepLink', () => {
  it('drops only the policy parameter and keeps path, other params, hash and history state', () => {
    setUrl('/home?lang=it&policy=privacy#top')
    expect(clearPolicyDeepLink()).toBe(true)
    expect(window.location.pathname).toBe('/home')
    expect(window.location.search).toBe('?lang=it')
    expect(window.location.hash).toBe('#top')
    expect(window.history.state).toEqual({ idx: 3, key: 'k' })
  })

  it('leaves a URL without the parameter untouched', () => {
    setUrl('/?lang=it')
    const spy = vi.spyOn(window.history, 'replaceState')
    expect(clearPolicyDeepLink()).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('is inert without a window or a history', () => {
    expect(clearPolicyDeepLink(null)).toBe(false)
    expect(clearPolicyDeepLink({ location: { href: 'http://x/?policy=terms' } })).toBe(false)
    expect(POLICY_PARAM).toBe('policy')
  })
})

describe('PolicyBookProvider deep link', () => {
  it.each(['privacy', 'cookies', 'terms'])('opens the %s book on load', kind => {
    setUrl(`/?policy=${kind}`)
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    expect(result.current.policyBook).toBe(kind)
  })

  it('ignores an unknown value: nothing opens', () => {
    setUrl('/?policy=unknown')
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    expect(result.current.policyBook).toBeNull()
    expect(window.location.search).toBe('?policy=unknown')
  })

  it('removes the parameter from the URL when the book closes', () => {
    setUrl('/?policy=privacy')
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.closePolicyBook())
    expect(result.current.policyBook).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('renders the opened kind to its children', () => {
    setUrl('/?policy=terms')
    function Show() { return <span data-testid="kind">{usePolicyBook().policyBook}</span> }
    render(<PolicyBookProvider><Show /></PolicyBookProvider>)
    expect(screen.getByTestId('kind').textContent).toBe('terms')
  })
})

describe('i18n EN/IT parity', () => {
  it('both languages carry exactly the same keys', () => {
    const enKeys = flatKeys(en).sort()
    const itKeys = flatKeys(it_).sort()
    expect(itKeys.filter(k => !enKeys.includes(k))).toEqual([])
    expect(enKeys.filter(k => !itKeys.includes(k))).toEqual([])
  })

  it('has the nine keys added for the launch', () => {
    const itKeys = flatKeys(it_)
    for (const key of ['book.bonuses', 'book.multiplayerDesc', 'book.statistics', 'book.stats.statisticsDesc',
      'game.endGameCard.title', 'game.endGameCard.description', 'game.endGameComplete', 'game.endGameShort',
      'game.movement.notNeighbor']) {
      expect(itKeys).toContain(key)
    }
  })

  it('translates the environment badge in Italian', () => {
    expect(it_.envBadge.alpha).toBe('Versione alpha')
    expect(en.envBadge.alpha).toBe('Alpha version')
  })
})

describe('privacy retention text', () => {
  it.each([['en', en, /60 days/, /14 days/, /at least one match/],
    ['it', it_, /60 giorni/, /14 giorni/, /almeno una partita/]])('%s states the retention rules', (_, dict, guest, logs, kept) => {
    const body = dict.modals.privacy.retentionBody
    expect(body).toMatch(guest)
    expect(body).toMatch(logs)
    expect(body).toMatch(kept)
    expect(body).toMatch(/IP/)
    expect(body).not.toMatch(/RATELIMIT|DynamoDB|CloudWatch|TTL/)
  })
})

describe('cookie consent labels', () => {
  it('offers "Reject all" in English and "Rifiuta tutti" in Italian on the first banner', async () => {
    vi.resetModules()
    run.mockClear()
    const { initCookieConsent } = await import('../consent/cookieConsent')
    initCookieConsent('en')
    const { translations } = run.mock.calls[0][0].language
    expect(translations.en.consentModal.acceptNecessaryBtn).toBe('Reject all')
    expect(translations.it.consentModal.acceptNecessaryBtn).toBe('Rifiuta tutti')
  })
})
