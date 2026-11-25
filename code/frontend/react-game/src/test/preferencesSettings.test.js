import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  THEMES, SIZES, COLUMN_OPTIONS, COLUMN_LIMITS, DEFAULT_THEME, DEFAULT_SIZE, DEFAULT_COLUMNS, PREFERENCES_VERSION,
  sanitizePreferences, columnsLayout, clampColumns, columnAllowed, effectiveSettings, withPreference,
} from '../preferences/settings'
import {
  PREFERENCES_KEY, LANG_KEY, devicePreferences, setDevicePreferences, clearDevicePreferences,
  devicePreferencesBody, setDeviceHighContrast,
} from '../auth/devicePreferences'
import { readAnimationEnv } from '../constants/animations'
import { canVibrate, vibratePlay, PLAY_VIBRATION_MS } from '../utils/haptics'

// Step 16 — the preferences module: whitelisted storage, the merge with env and reduced motion, the columns.

const ENV = readAnimationEnv({}) // deal, faceDown, play, turn on; full; 0.25; under

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  delete navigator.vibrate
})

describe('settings — lists and defaults', () => {
  it('two themes, three sizes, auto and 1–4 columns; medieval, normal and auto by default', () => {
    expect(THEMES).toEqual(['medieval', 'parchment'])
    expect(SIZES).toEqual(['small', 'normal', 'large'])
    expect(COLUMN_OPTIONS).toEqual(['auto', 1, 2, 3, 4])
    expect([DEFAULT_THEME, DEFAULT_SIZE, DEFAULT_COLUMNS]).toEqual(['medieval', 'normal', 'auto'])
    const none = effectiveSettings({ prefs: {}, animDefaults: ENV, vibrationApi: false })
    expect(none).toMatchObject({ theme: 'medieval', size: 'normal', columns: 'auto', cols: 3, vibration: false,
      reducedMotion: false })
    expect(effectiveSettings({ prefs: null, animDefaults: ENV }).theme).toBe('medieval')
    expect(effectiveSettings().size).toBe('normal')
  })
})

describe('settings — sanitizePreferences', () => {
  it('keeps every valid field and drops unknown or invalid values', () => {
    const raw = {
      v: 1, theme: 'parchment', size: 'large', columns: 4, vibration: false, extra: 'x',
      anim: { deal: false, dealFaceDown: true, play: 'yes', turn: true, turnMode: 'simple', speed: 0.5, deck: 'over', fly: 1 },
    }
    expect(sanitizePreferences(raw)).toEqual({
      theme: 'parchment', size: 'large', columns: 4, vibration: false,
      anim: { deal: false, dealFaceDown: true, turn: true, turnMode: 'simple', speed: 0.5, deck: 'over' },
    })
    expect(sanitizePreferences({ theme: 'dark', size: 'huge', columns: 5, vibration: 'on',
      anim: { speed: 2, turnMode: 'slow', deck: 'beside' } })).toEqual({})
    expect(sanitizePreferences({ columns: 'auto', anim: [] })).toEqual({ columns: 'auto' })
  })

  it('anything but an object of this version is empty', () => {
    for (const bad of [null, undefined, 'x', 3, [], { v: 2, theme: 'parchment' }]) expect(sanitizePreferences(bad)).toEqual({})
    expect(PREFERENCES_VERSION).toBe(1)
  })

  it('withPreference sets a path (nested for anim), removes with undefined, and whitelists', () => {
    expect(withPreference({}, 'theme', 'parchment')).toEqual({ theme: 'parchment' })
    expect(withPreference({ theme: 'parchment' }, 'theme', undefined)).toEqual({})
    expect(withPreference({ anim: { deal: false } }, 'anim.speed', 1)).toEqual({ anim: { deal: false, speed: 1 } })
    expect(withPreference({ anim: 'broken' }, 'anim.turn', false)).toEqual({ anim: { turn: false } })
    expect(withPreference(null, 'columns', 9)).toEqual({})
  })
})

describe('settings — effectiveSettings', () => {
  it('a choice wins over the env, key by key', () => {
    const s = effectiveSettings({ prefs: { anim: { deal: false, speed: 1, turnMode: 'simple' } }, animDefaults: ENV })
    expect(s.anim).toMatchObject({ deal: false, dealFaceDown: true, play: true, turn: true, turnMode: 'simple', speed: 1,
      deck: 'under', reduced: false })
    expect(s.anim.timings.flip).toBe(900)
  })

  it('reduced motion wins over every animation flag; deck placement, speed and vibration stay', () => {
    navigator.vibrate = vi.fn()
    const s = effectiveSettings({ prefs: { anim: { deal: true, play: true, deck: 'over', speed: 0.5 } }, animDefaults: ENV,
      reducedMotion: true })
    expect(s.anim).toMatchObject({ deal: false, dealFaceDown: false, play: false, turn: false, deck: 'over', speed: 0.5,
      reduced: true })
    expect(s.reducedMotion).toBe(true)
    expect(s.vibration).toBe(true)
  })

  it('vibration: on unless the choice is off, and only where the API exists', () => {
    expect(effectiveSettings({ prefs: {}, vibrationApi: true }).vibration).toBe(true)
    expect(effectiveSettings({ prefs: { vibration: false }, vibrationApi: true }).vibration).toBe(false)
    expect(effectiveSettings({ prefs: { vibration: true }, vibrationApi: false }).vibration).toBe(false)
  })

  it('columns: the stored value and the one shown in the current layout', () => {
    expect(effectiveSettings({ prefs: { columns: 4 }, layout: 'phone' })).toMatchObject({ columns: 4, cols: 2 })
    expect(effectiveSettings({ prefs: {}, layout: 'sideways' })).toMatchObject({ columns: 'auto', cols: 3 })
  })
})

describe('settings — columns per layout', () => {
  it('limits: desktop 2–4, medium 1–3, phone 1–2, sideways 2–3, tiny always 1; auto 3, 2, 2, 3, 1', () => {
    expect(COLUMN_LIMITS.desktop).toEqual({ min: 2, max: 4, auto: 3 })
    expect(COLUMN_LIMITS.medium).toEqual({ min: 1, max: 3, auto: 2 })
    expect(COLUMN_LIMITS.phone).toEqual({ min: 1, max: 2, auto: 2 })
    expect(COLUMN_LIMITS.sideways).toEqual({ min: 2, max: 3, auto: 3 })
    expect(COLUMN_LIMITS.tiny).toEqual({ min: 1, max: 1, auto: 1 })
  })

  it('clamps a stored value to the layout range; auto is the layout default; unknown layouts are desktop', () => {
    expect(clampColumns(4, 'phone')).toBe(2)
    expect(clampColumns(1, 'desktop')).toBe(2)
    expect(clampColumns(4, 'medium')).toBe(3)
    expect(clampColumns(1, 'sideways')).toBe(2)
    expect(clampColumns(3, 'tiny')).toBe(1)
    expect(clampColumns('auto', 'medium')).toBe(2)
    expect(clampColumns(undefined, 'phone')).toBe(2)
    expect(clampColumns(4, 'tv')).toBe(4)
  })

  it('columnAllowed: auto always, a number inside the range', () => {
    expect(columnAllowed('auto', 'tiny')).toBe(true)
    expect(columnAllowed(1, 'desktop')).toBe(false)
    expect(columnAllowed(4, 'desktop')).toBe(true)
    expect(columnAllowed(3, 'phone')).toBe(false)
    expect(columnAllowed(2, 'sideways')).toBe(true)
  })

  it('columnsLayout: the first matching query (tiny, sideways, phone, medium), else desktop', () => {
    expect(columnsLayout(() => false)).toBe('desktop')
    expect(columnsLayout(q => q === '(max-width: 1120px)')).toBe('medium')
    expect(columnsLayout(q => q === '(max-width: 767px)' || q === '(max-width: 1120px)')).toBe('phone')
    expect(columnsLayout(q => q.includes('landscape') || q === '(max-width: 767px)')).toBe('sideways')
    expect(columnsLayout(() => true)).toBe('tiny')
    expect(columnsLayout()).toBe('desktop') // jsdom: no matchMedia
    window.matchMedia = vi.fn(q => ({ matches: q === '(max-width: 1120px)' }))
    expect(columnsLayout()).toBe('medium')
    delete window.matchMedia
  })
})

describe('devicePreferences — pathsgames.preferences', () => {
  it('reads, writes (with its version) and clears the key; the language stays', () => {
    expect(PREFERENCES_KEY).toBe('pathsgames.preferences')
    expect(devicePreferences()).toEqual({})
    localStorage.setItem(LANG_KEY, 'it')
    expect(setDevicePreferences({ theme: 'parchment', anim: { deck: 'over', speed: 3 } })).toBe(true)
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY))).toEqual({ v: 1, theme: 'parchment', anim: { deck: 'over' } })
    expect(devicePreferences()).toEqual({ theme: 'parchment', anim: { deck: 'over' } })
    clearDevicePreferences()
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull()
    expect(localStorage.getItem(LANG_KEY)).toBe('it')
  })

  it('broken JSON and unknown values read as nothing (an anim.deck other than under / over included)', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not json')
    expect(devicePreferences()).toEqual({})
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, size: 'small', anim: { deck: 'beside' }, foo: 1 }))
    expect(devicePreferences()).toEqual({ size: 'small' })
  })

  it('a storage that throws: {} on read, false on write, no throw on clear', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('private') })
    expect(devicePreferences()).toEqual({})
    expect(setDevicePreferences({ theme: 'parchment' })).toBe(false)
    expect(() => clearDevicePreferences()).not.toThrow()
  })

  it('devicePreferencesBody() still holds the language and the high contrast only', () => {
    setDevicePreferences({ theme: 'parchment', size: 'large', columns: 2, vibration: false, anim: { deal: false } })
    expect(devicePreferencesBody()).toBeNull()
    localStorage.setItem(LANG_KEY, 'en')
    setDeviceHighContrast(true)
    expect(devicePreferencesBody()).toEqual({ language: 'en', highContrast: true })
  })
})

describe('haptics — vibratePlay', () => {
  it('no API: a silent no-op', () => {
    expect(canVibrate()).toBe(false)
    expect(vibratePlay()).toBe(false)
  })

  it('with the API: vibrate(15) once', () => {
    navigator.vibrate = vi.fn(() => true)
    expect(canVibrate()).toBe(true)
    expect(vibratePlay()).toBe(true)
    expect(navigator.vibrate).toHaveBeenCalledOnce()
    expect(navigator.vibrate).toHaveBeenCalledWith(PLAY_VIBRATION_MS)
    expect(PLAY_VIBRATION_MS).toBe(15)
  })

  it('the choice off: nothing', () => {
    navigator.vibrate = vi.fn()
    expect(vibratePlay(false)).toBe(false)
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })

  it('a throwing API is swallowed', () => {
    navigator.vibrate = vi.fn(() => { throw new Error('blocked') })
    expect(vibratePlay(true)).toBe(false)
  })
})
