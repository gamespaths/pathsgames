import { PREFERENCES_VERSION, sanitizePreferences } from '@/preferences/settings'

/**
 * v1.7.0 — the preferences kept on this device (localStorage): the only store of a guest, a cache of
 * the profile for a Google user. The language key is written by the i18n context.
 * Step 16 — `pathsgames.preferences`: the display choices of the device, never sent to the server.
 */
export const LANG_KEY = 'pathsgames.lang'
export const HIGH_CONTRAST_KEY = 'pathsgames.highContrast'
export const PREFERENCES_KEY = 'pathsgames.preferences'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The language chosen on this device, if any. */
export function deviceLanguage() {
  return read(LANG_KEY) || undefined
}

/** The high-contrast flag of this device: true, false or undefined when never set. */
export function deviceHighContrast() {
  const value = read(HIGH_CONTRAST_KEY)
  return value === 'true' ? true : value === 'false' ? false : undefined
}

/** Stores the high-contrast flag of this device (ignored when not a boolean). */
export function setDeviceHighContrast(value) {
  if (typeof value !== 'boolean') return
  try {
    localStorage.setItem(HIGH_CONTRAST_KEY, String(value))
  } catch {
    // private mode: the flag lives for this page only
  }
}

/** The PATCH /api/auth/me body of the device values; null when the device has none. */
export function devicePreferencesBody() {
  const body = {}
  const language = deviceLanguage()
  const highContrast = deviceHighContrast()
  if (language) body.language = language
  if (highContrast !== undefined) body.highContrast = highContrast
  return Object.keys(body).length > 0 ? body : null
}

/** Step 16 — the display choices of this device, whitelisted; {} when none, broken or unreadable. */
export function devicePreferences() {
  try {
    return sanitizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

/** Step 16 — stores the display choices (whitelisted); false when the storage refuses (private mode). */
export function setDevicePreferences(prefs) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: PREFERENCES_VERSION, ...sanitizePreferences(prefs) }))
    return true
  } catch {
    return false
  }
}

/** Step 16 — forgets the display choices (the language stays). */
export function clearDevicePreferences() {
  try {
    localStorage.removeItem(PREFERENCES_KEY)
  } catch {
    // private mode: nothing was kept
  }
}
