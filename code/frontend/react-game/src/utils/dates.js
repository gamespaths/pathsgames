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
