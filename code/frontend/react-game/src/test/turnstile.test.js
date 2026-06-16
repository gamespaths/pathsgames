import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TURNSTILE_PASS_COOKIE,
  TURNSTILE_PASS_TTL_MIN,
  TURNSTILE_APPEARANCE,
  isTurnstilePassValid,
  recordTurnstilePass,
} from '../utils/turnstile'

describe('utils/turnstile', () => {
  beforeEach(() => {
    // wipe the pass cookie before each case
    document.cookie = `${TURNSTILE_PASS_COOKIE}=; max-age=0; path=/`
  })
  afterEach(() => {
    document.cookie = `${TURNSTILE_PASS_COOKIE}=; max-age=0; path=/`
  })

  it('defaults the TTL to 30 minutes when not configured', () => {
    expect(TURNSTILE_PASS_TTL_MIN).toBe(30)
  })

  it('falls back to "always" appearance for unset env keys', () => {
    expect(TURNSTILE_APPEARANCE.home).toBe('always')
    expect(TURNSTILE_APPEARANCE.config).toBe('always')
    expect(TURNSTILE_APPEARANCE.guest).toBe('always')
  })

  it('isTurnstilePassValid reflects the presence of the pass cookie', () => {
    expect(isTurnstilePassValid()).toBe(false)
    recordTurnstilePass()
    expect(isTurnstilePassValid()).toBe(true)
  })

  it('recordTurnstilePass writes the cookie with a max-age', () => {
    recordTurnstilePass()
    expect(document.cookie).toContain(`${TURNSTILE_PASS_COOKIE}=1`)
  })
})
