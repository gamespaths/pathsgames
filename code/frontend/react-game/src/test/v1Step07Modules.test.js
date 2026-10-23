// v1.7.0 V1 step 7 — bundles, device preferences, requests in flight, statistics, profile API calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({ default: { create: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

import axios from 'axios'
import { hasBundle, bundleLanguages, LANGUAGE_LABELS, TRANSLATIONS } from '../i18n/bundles'
import {
  LANG_KEY, HIGH_CONTRAST_KEY, deviceLanguage, deviceHighContrast, setDeviceHighContrast, devicePreferencesBody,
} from '../auth/devicePreferences'
import { beginRequest, endRequest, inFlightCount, whenIdle, resetInFlight } from '../api/inFlight'
import { playTimeParts, formatPlayTime, profileStatRows, PROFILE_STAT_KEYS } from '../utils/profileStats'
import { updateMe, logoutAll, deleteMe } from '../api/auth'
import { apiClient } from '../api/client'

const t = (k) => (k === 'profile.stats.playTimeValue' ? '{h} h {m} min' : k)

describe('i18n bundles', () => {
  it('knows the bundled languages and their names', () => {
    expect(Object.keys(TRANSLATIONS)).toEqual(['en', 'it'])
    expect(LANGUAGE_LABELS.it).toBe('Italiano')
    expect(hasBundle('it')).toBe(true)
    expect(hasBundle('fr')).toBe(false)
    expect(hasBundle(undefined)).toBe(false)
    expect(hasBundle('toString')).toBe(false)
  })

  it('keeps the server languages that have a bundle, else every bundle', () => {
    expect(bundleLanguages(['it', 'fr', 'it'])).toEqual(['it'])
    expect(bundleLanguages(['fr'])).toEqual(['en', 'it'])
    expect(bundleLanguages(null)).toEqual(['en', 'it'])
  })
})

describe('device preferences', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reads nothing on a fresh device', () => {
    expect(deviceLanguage()).toBeUndefined()
    expect(deviceHighContrast()).toBeUndefined()
    expect(devicePreferencesBody()).toBeNull()
  })

  it('reads and writes the language and the high-contrast flag', () => {
    localStorage.setItem(LANG_KEY, 'it')
    setDeviceHighContrast(true)
    expect(localStorage.getItem(HIGH_CONTRAST_KEY)).toBe('true')
    expect(devicePreferencesBody()).toEqual({ language: 'it', highContrast: true })
    setDeviceHighContrast(false)
    expect(deviceHighContrast()).toBe(false)
    setDeviceHighContrast('yes')
    expect(deviceHighContrast()).toBe(false)
    localStorage.setItem(HIGH_CONTRAST_KEY, 'maybe')
    expect(deviceHighContrast()).toBeUndefined()
    localStorage.removeItem(LANG_KEY)
    setDeviceHighContrast(true)
    expect(devicePreferencesBody()).toEqual({ highContrast: true })
  })

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private') })
    expect(deviceLanguage()).toBeUndefined()
    expect(deviceHighContrast()).toBeUndefined()
    expect(() => setDeviceHighContrast(true)).not.toThrow()
  })
})

describe('requests in flight', () => {
  beforeEach(() => resetInFlight())

  it('counts, never goes below zero and wakes the waiters when idle', async () => {
    await expect(whenIdle()).resolves.toBeUndefined()
    beginRequest()
    beginRequest()
    const woke = vi.fn()
    const idle = whenIdle().then(woke)
    endRequest()
    await Promise.resolve()
    expect(woke).not.toHaveBeenCalled()
    expect(inFlightCount()).toBe(1)
    endRequest()
    await idle
    expect(woke).toHaveBeenCalledTimes(1)
    endRequest()
    expect(inFlightCount()).toBe(0)
  })

  it('the API client counts its requests, also the failed ones', async () => {
    let onRequest
    const response = []
    const instance = { interceptors: {
      request: { use: vi.fn((fn) => { onRequest = fn }) },
      response: { use: vi.fn((ok, ko) => response.push({ ok, ko })) },
    } }
    axios.create.mockReturnValue(instance)
    apiClient()
    expect(onRequest({ url: '/x' })).toEqual({ url: '/x' })
    expect(inFlightCount()).toBe(1)
    expect(response[0].ok('r')).toBe('r')
    expect(inFlightCount()).toBe(0)
    onRequest({})
    await expect(response[0].ko(new Error('down'))).rejects.toThrow('down')
    expect(inFlightCount()).toBe(0)
  })
})

describe('profile statistics', () => {
  it('splits a play time into hours and minutes', () => {
    expect(playTimeParts(0)).toEqual({ hours: 0, minutes: 0 })
    expect(playTimeParts(59_999)).toEqual({ hours: 0, minutes: 0 })
    expect(playTimeParts(3_725_000)).toEqual({ hours: 1, minutes: 2 })
    expect(playTimeParts(-5)).toEqual({ hours: 0, minutes: 0 })
    expect(playTimeParts('x')).toEqual({ hours: 0, minutes: 0 })
    expect(formatPlayTime(26 * 3_600_000 + 5 * 60_000, t)).toBe('26 h 5 min')
  })

  it('answers one row per statistic, zeros when the server sent none', () => {
    const rows = profileStatRows({ matchesPlayed: 3, matchesCompleted: 1, matchesGameOver: 1, playTimeMs: 7_200_000,
      clocksPlayed: 42.7 }, t)
    expect(rows.map(r => r.key)).toEqual(PROFILE_STAT_KEYS)
    expect(rows.map(r => r.value)).toEqual(['3', '1', '1', '2 h 0 min', '42'])
    expect(rows[0].label).toBe('profile.stats.matchesPlayed')
    expect(profileStatRows(null, t).map(r => r.value)).toEqual(['0', '0', '0', '0 h 0 min', '0'])
  })
})

describe('profile API calls', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updateMe patches /api/auth/me with the bearer and the CSRF token', async () => {
    axios.patch.mockResolvedValue({ data: { preferences: { language: 'it' } } })
    expect(await updateMe('http://s', 'tok', 'csrf', { language: 'it' })).toEqual({ preferences: { language: 'it' } })
    expect(axios.patch).toHaveBeenCalledWith('http://s/api/auth/me', { language: 'it' },
      { timeout: 5000, headers: { Authorization: 'Bearer tok', 'X-CSRF-TOKEN': 'csrf' } })
    await updateMe('http://s', null, null, { highContrast: true })
    expect(axios.patch.mock.calls[1][2]).toEqual({ timeout: 5000, headers: {} })
  })

  it('logoutAll posts /api/auth/logout/all with the cookies', async () => {
    axios.post.mockResolvedValue({ data: { status: 'OK' } })
    expect(await logoutAll('http://s', 'tok')).toEqual({ status: 'OK' })
    expect(axios.post).toHaveBeenCalledWith('http://s/api/auth/logout/all', null,
      { withCredentials: true, timeout: 5000, headers: { Authorization: 'Bearer tok' } })
  })

  it('deleteMe sends the fresh ID token and its nonce', async () => {
    axios.delete.mockResolvedValue({ data: { status: 'DELETING' } })
    expect(await deleteMe('http://s', 'tok', { idToken: 'id', nonce: 'n' })).toEqual({ status: 'DELETING' })
    expect(axios.delete).toHaveBeenCalledWith('http://s/api/auth/me', { withCredentials: true, timeout: 10000,
      headers: { Authorization: 'Bearer tok' }, data: { idToken: 'id', nonce: 'n' } })
  })
})
