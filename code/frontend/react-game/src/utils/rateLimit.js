// v0.41.0 — 429 RATE_LIMITED helpers: detection, retry delay and the translated sentence.
// t() has no interpolation, so `{time}` in the i18n templates is replaced here.

export const RATE_LIMITED = 'RATE_LIMITED'

/** True for an axios error answered 429 or carrying the RATE_LIMITED code. */
export function isRateLimited(err) {
  const res = err?.response
  return res?.status === 429 || res?.data?.error === RATE_LIMITED
}

function positive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Seconds to wait: body `retryAfterSeconds` first, then the Retry-After header, else 0 (unknown). */
export function retryAfterSeconds(err) {
  const res = err?.response
  const fromBody = positive(res?.data?.retryAfterSeconds)
  if (fromBody) return fromBody
  const headers = res?.headers
  const raw = typeof headers?.get === 'function' ? headers.get('retry-after') : headers?.['retry-after']
  return positive(raw)
}

/** "N min" up to 90 minutes, "N h" beyond (the per-guest window lasts a day); unknown → t('errors.rateLimitSoon'). */
export function formatWait(seconds, t) {
  const s = positive(seconds)
  if (!s) return t('errors.rateLimitSoon')
  const minutes = Math.ceil(s / 60)
  return minutes <= 90 ? `${minutes} min` : `${Math.ceil(s / 3600)} h`
}

/** The i18n template `key` with `{time}` filled in. */
export function rateLimitMessage(t, key, seconds) {
  return t(key).replace('{time}', formatWait(seconds, t))
}
