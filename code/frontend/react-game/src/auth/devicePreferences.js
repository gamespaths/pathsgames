/**
 * v1.7.0 — the preferences kept on this device (localStorage): the only store of a guest, a cache of
 * the profile for a Google user. The language key is written by the i18n context.
 */
export const LANG_KEY = 'pathsgames.lang'
export const HIGH_CONTRAST_KEY = 'pathsgames.highContrast'

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
