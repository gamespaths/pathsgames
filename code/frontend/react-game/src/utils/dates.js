// Step 40 — dates as the three backends send them: ISO strings (java, python) or epoch-ms (AWS).

/** Epoch milliseconds of an ISO string, an epoch-ms number or digits; null when unreadable. */
export function toEpochMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return Number(text)
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : ms
}

/** The date (and time) in the language's locale; null when missing or invalid. */
export function formatDate(value, lang = 'en', withTime = true) {
  const ms = toEpochMs(value)
  if (ms === null) return null
  const options = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }
  try {
    return new Intl.DateTimeFormat(lang || 'en', options).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString()
  }
}

const RELATIVE_UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400],
  ['hour', 3600], ['minute', 60]]

/** v1.7.0 step 9 — "2 hours ago" in the locale (the browser's when none); null when missing or invalid. */
export function formatRelative(value, lang, now = Date.now()) {
  const ms = toEpochMs(value)
  if (ms === null) return null
  const seconds = Math.round((ms - now) / 1000)
  const [unit, size] = RELATIVE_UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ['second', 1]
  try {
    return new Intl.RelativeTimeFormat(lang || undefined, { numeric: 'auto' }).format(Math.round(seconds / size), unit)
  } catch {
    return new Date(ms).toISOString()
  }
}
