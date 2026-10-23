// v1.7.0 V1 step 11 — the pure rules of the Users pages.
import { describe, it, expect } from 'vitest'
import {
  USER_REASONS, REASON_MAX, buildUserQuery, composeReason, freeTextMax, reasonError, suspendBounds,
  untilError, allowedActions, errorText, isEmailSearch, fmtPlayTime,
} from '../../constants/userAdmin'

const NOW = new Date('2026-10-22T15:00:00Z')

describe('buildUserQuery (search routing)', () => {
  it('sends no state for the default active view', () => {
    expect(buildUserQuery('', '2', 50)).toEqual({ limit: 50 })
  })

  it('an "@" is an exact lowercase email search without state', () => {
    expect(buildUserQuery('  Ann@Example.COM ', '3', 50, 'c1')).toEqual({ limit: 50, cursor: 'c1', email: 'ann@example.com' })
    expect(isEmailSearch('a@b')).toBe(true)
    expect(isEmailSearch(null)).toBe(false)
  })

  it('anything else is a nickname prefix with the state filter', () => {
    expect(buildUserQuery(' ann ', '2', 50)).toEqual({ limit: 50, nickname: 'ann', state: '2' })
    expect(buildUserQuery('ann', '', 50)).toEqual({ limit: 50, nickname: 'ann' })
  })

  it('a non default state without search sends the state', () => {
    expect(buildUserQuery('', '4', 20, 'c2')).toEqual({ limit: 20, cursor: 'c2', state: '4' })
    expect(buildUserQuery(undefined, '', 20)).toEqual({ limit: 20 })
  })
})

describe('reasons', () => {
  it('has the six standard reasons', () => {
    expect(USER_REASONS.map(r => r.label)).toEqual(['Spam', 'Abuse', 'Cheating', 'Security', 'Support request', 'Other'])
  })

  it('composes the final text and keeps it within 500 characters', () => {
    expect(composeReason('CHEATING', '  used a bot  ')).toBe('Cheating: used a bot')
    expect(composeReason('UNKNOWN', undefined)).toBe('Other: ')
    expect(freeTextMax('SUPPORT_REQUEST')).toBe(REASON_MAX - 'Support request: '.length)
    expect(composeReason('SUPPORT_REQUEST', 'x'.repeat(freeTextMax('SUPPORT_REQUEST'))).length).toBe(REASON_MAX)
  })

  it('validates the reason and the free text length', () => {
    expect(reasonError('', 'long enough text')).toBe('Pick a reason.')
    expect(reasonError('SPAM', '  short  ')).toBe('Write at least 10 characters.')
    expect(reasonError('SPAM', undefined)).toBe('Write at least 10 characters.')
    expect(reasonError('SPAM', 'x'.repeat(10))).toBe('')
    expect(reasonError('SPAM', 'x'.repeat(freeTextMax('SPAM') + 1))).toBe(`Write at most ${freeTextMax('SPAM')} characters.`)
  })
})

describe('suspension dates', () => {
  it('limits the end to tomorrow .. today + 90 days (UTC)', () => {
    expect(suspendBounds(NOW)).toEqual({ min: '2026-10-23', max: '2027-01-20' })
    expect(suspendBounds().min.length).toBe(10)
  })

  it('validates the end date', () => {
    expect(untilError('', NOW)).toBe('Pick the end date of the suspension.')
    expect(untilError('2026-10-22', NOW)).toMatch(/between 2026-10-23 and 2027-01-20/)
    expect(untilError('2027-01-21', NOW)).toMatch(/between/)
    expect(untilError('not-a-date', NOW)).toMatch(/between/)
    expect(untilError('2026-10-23', NOW)).toBe('')
    expect(untilError('2027-01-20', NOW)).toBe('')
    expect(untilError('2099-01-01')).toMatch(/between/)
  })
})

describe('allowedActions', () => {
  const google = { accountType: 'GOOGLE', role: 'PLAYER', state: 2, identities: [{ provider: 'GOOGLE' }] }

  it('allows nothing without a user', () => {
    expect(allowedActions(null)).toEqual({ ban: false, suspend: false, unblock: false, relink: false, deletion: false })
  })

  it('an active Google player can be banned, suspended, re-linked and deleted', () => {
    expect(allowedActions(google)).toEqual({ ban: true, suspend: true, unblock: false, relink: true, deletion: true })
  })

  it('a suspended user can be unblocked, banned or suspended again', () => {
    expect(allowedActions({ ...google, state: 3 })).toMatchObject({ ban: true, suspend: true, unblock: true })
  })

  it('a banned user can only be unblocked (and re-linked or deleted)', () => {
    expect(allowedActions({ ...google, state: 4 })).toEqual({ ban: false, suspend: false, unblock: true, relink: true, deletion: true })
  })

  it('a deleting user keeps only the ban', () => {
    expect(allowedActions({ ...google, state: 7 })).toEqual({ ban: true, suspend: false, unblock: false, relink: false, deletion: false })
  })

  it('an armed re-link cannot be armed again', () => {
    expect(allowedActions({ ...google, relinkPending: true }).relink).toBe(false)
  })

  it('an ADMIN is never banned, suspended or deleted', () => {
    expect(allowedActions({ ...google, role: 'ADMIN' })).toEqual({ ban: false, suspend: false, unblock: false, relink: true, deletion: false })
  })

  it('guests and internal users get no Google action', () => {
    expect(allowedActions({ ...google, accountType: 'GUEST', guest: true, state: 6 })).toEqual(
      { ban: false, suspend: false, unblock: false, relink: false, deletion: false })
    expect(allowedActions({ ...google, accountType: 'INTERNAL', identities: undefined })).toMatchObject({ ban: false, relink: false })
  })
})

describe('errorText', () => {
  it('maps the step 10 codes', () => {
    expect(errorText({ code: 'GUEST_NOT_BANNABLE', message: 'x' })).toMatch(/Guests cannot be banned.*\(GUEST_NOT_BANNABLE\)$/)
    expect(errorText({ code: 'ADMIN_NOT_BANNABLE' })).toMatch(/ADMIN can never/)
    expect(errorText({ code: 'SUSPEND_UNTIL_INVALID' })).toMatch(/90 days/)
    expect(errorText({ code: 'INVALID_STATE_TRANSITION' })).toMatch(/does not allow/)
  })

  it('falls back to the message, the code and the default text', () => {
    expect(errorText({ code: 'OTHER_CODE', message: 'Server says no' })).toBe('Server says no (OTHER_CODE)')
    expect(errorText({ message: 'Network Error' })).toBe('Network Error')
    expect(errorText(null, 'Failed')).toBe('Failed')
    expect(errorText(undefined)).toBe('The request failed')
  })
})

describe('fmtPlayTime', () => {
  it('formats hours, minutes and seconds', () => {
    expect(fmtPlayTime(3_725_000)).toBe('1h 02m')
    expect(fmtPlayTime(303_000)).toBe('5m 03s')
    expect(fmtPlayTime(undefined)).toBe('0m 00s')
    expect(fmtPlayTime(-5)).toBe('0m 00s')
  })
})
