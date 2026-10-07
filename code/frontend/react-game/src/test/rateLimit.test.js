import { describe, it, expect } from 'vitest'
import { RATE_LIMITED, isRateLimited, retryAfterSeconds, formatWait, rateLimitMessage } from '../utils/rateLimit'

// v0.41.0 — the 429 body is { error: RATE_LIMITED, message, retryAfterSeconds, timestamp } plus Retry-After.
const T = {
  'errors.rateLimitSoon': 'a few minutes',
  'startMatch.errorRateLimited': 'Too many new matches. Try again in {time}.',
}
const t = (k) => T[k] ?? k

describe('rateLimit utils', () => {
  it('detects a 429 or the RATE_LIMITED code, nothing else', () => {
    expect(RATE_LIMITED).toBe('RATE_LIMITED')
    expect(isRateLimited({ response: { status: 429 } })).toBe(true)
    expect(isRateLimited({ response: { status: 400, data: { error: 'RATE_LIMITED' } } })).toBe(true)
    expect(isRateLimited({ response: { status: 409, data: { error: 'ACTIVE_MATCH_ALREADY_EXISTS' } } })).toBe(false)
    expect(isRateLimited(new Error('Network Error'))).toBe(false)
    expect(isRateLimited(undefined)).toBe(false)
  })

  it('reads the wait from the body first, then from the Retry-After header', () => {
    expect(retryAfterSeconds({ response: { data: { retryAfterSeconds: 120 }, headers: { 'retry-after': '30' } } })).toBe(120)
    expect(retryAfterSeconds({ response: { data: {}, headers: { 'retry-after': '30' } } })).toBe(30)
    expect(retryAfterSeconds({ response: { data: { retryAfterSeconds: 0 }, headers: { get: (h) => (h === 'retry-after' ? '45' : null) } } })).toBe(45)
  })

  it('answers 0 when no usable wait came back', () => {
    expect(retryAfterSeconds({ response: { data: { retryAfterSeconds: 'soon' }, headers: {} } })).toBe(0)
    expect(retryAfterSeconds({ response: { data: null } })).toBe(0)
    expect(retryAfterSeconds({ response: { headers: { 'retry-after': '-5' } } })).toBe(0)
    expect(retryAfterSeconds(null)).toBe(0)
  })

  it('formats minutes up to 90, hours beyond, and a vague wait when unknown', () => {
    expect(formatWait(1, t)).toBe('1 min')
    expect(formatWait(60, t)).toBe('1 min')
    expect(formatWait(61, t)).toBe('2 min')
    expect(formatWait(5400, t)).toBe('90 min')
    expect(formatWait(5401, t)).toBe('2 h')
    expect(formatWait(86400, t)).toBe('24 h')
    expect(formatWait(0, t)).toBe('a few minutes')
    expect(formatWait(undefined, t)).toBe('a few minutes')
  })

  it('fills {time} in the translated template', () => {
    expect(rateLimitMessage(t, 'startMatch.errorRateLimited', 600)).toBe('Too many new matches. Try again in 10 min.')
    expect(rateLimitMessage(t, 'startMatch.errorRateLimited', 0)).toBe('Too many new matches. Try again in a few minutes.')
  })

  it('every EN/IT template carries the {time} placeholder', async () => {
    const en = (await import('../i18n/en.json')).default
    const it_ = (await import('../i18n/it.json')).default
    for (const lang of [en, it_]) {
      expect(lang.startMatch.errorRateLimited).toContain('{time}')
      expect(lang.nav.error.rateLimited).toContain('{time}')
      expect(lang.errors.rateLimitSoon).toBeTruthy()
    }
  })
})
