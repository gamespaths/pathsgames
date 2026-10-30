// userAdmin.js — v1.7.0 V1 step 11: the constants and pure rules of the Users pages (search routing,
// reasons, suspension dates, the actions a user state allows, the step 10 error codes).

// The standard reasons; the backend stores only the final text "<label>: <free text>".
export const USER_REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSE', label: 'Abuse' },
  { value: 'CHEATING', label: 'Cheating' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'SUPPORT_REQUEST', label: 'Support request' },
  { value: 'OTHER', label: 'Other' },
]

export const REASON_MIN = 10
export const REASON_MAX = 500
export const SUSPEND_MAX_DAYS = 90

export const USER_STATES = {
  1: { label: 'Registration', badge: 'pg-badge-info' },
  2: { label: 'Active', badge: 'pg-badge-success' },
  3: { label: 'Suspended', badge: 'pg-badge-warning' },
  4: { label: 'Banned', badge: 'pg-badge-danger' },
  5: { label: 'Unused', badge: 'pg-badge-resolved' },
  6: { label: 'Guest', badge: 'pg-badge-info' },
  7: { label: 'Deleting', badge: 'pg-badge-resolved' },
}

// The state filter of the list: '2' is the default view, '' searches every state (guests never listed).
export const STATE_FILTERS = [
  { value: '2', label: 'Active' },
  { value: '3', label: 'Suspended' },
  { value: '4', label: 'Banned' },
  { value: '7', label: 'Deleting' },
  { value: '1', label: 'Registration' },
  { value: '', label: 'Any state (with a search)' },
]

export const ERROR_TEXT = {
  GUEST_NOT_BANNABLE: 'Guests cannot be banned, suspended or deleted here: they are limited per IP.',
  ADMIN_NOT_BANNABLE: 'An ADMIN can never be banned, suspended or deleted.',
  SUSPEND_UNTIL_INVALID: 'The suspension must end in the future and at most 90 days from today.',
  INVALID_STATE_TRANSITION: 'The current state of the user does not allow this action: the page was reloaded.',
  USER_NOT_FOUND: 'No user has this uuid.',
  INVALID_INPUT: 'The request was refused as invalid.',
}

/** The page message of a failed call: the known text of its code, the server message, the code. */
export function errorText(e, fallback = 'The request failed') {
  const code = e?.code
  const known = code ? ERROR_TEXT[code] : null
  const text = known || e?.message || fallback
  return code ? `${text} (${code})` : text
}

export const isEmailSearch = (text) => String(text ?? '').includes('@')

// List query: "@" = exact email (no state), else nickname prefix; Active without search = backend default view.
export function buildUserQuery(search, state, limit, cursor) {
  const text = String(search ?? '').trim()
  const query = { limit }
  if (cursor) query.cursor = cursor
  if (isEmailSearch(text)) {
    query.email = text.toLowerCase()
    return query
  }
  if (text) query.nickname = text
  if (state && (text || state !== '2')) query.state = state
  return query
}

/** The final reason text sent to the backend. */
export const composeReason = (code, text) => {
  const reason = USER_REASONS.find(r => r.value === code)
  return `${reason ? reason.label : 'Other'}: ${String(text ?? '').trim()}`
}

/** The longest free text that keeps the final reason within the backend limit of 500 characters. */
export const freeTextMax = (code) => REASON_MAX - composeReason(code, '').length

/** The validation message of a reason, or '' when it may be sent. */
export function reasonError(code, text) {
  const length = String(text ?? '').trim().length
  if (!code) return 'Pick a reason.'
  if (length < REASON_MIN) return `Write at least ${REASON_MIN} characters.`
  if (length > freeTextMax(code)) return `Write at most ${freeTextMax(code)} characters.`
  return ''
}

const isoDay = (date) => date.toISOString().slice(0, 10)

/** The dates the suspension may end on (UTC days): tomorrow to today plus 90 days. */
export function suspendBounds(now = new Date()) {
  const day = 24 * 60 * 60 * 1000
  return { min: isoDay(new Date(now.getTime() + day)), max: isoDay(new Date(now.getTime() + SUSPEND_MAX_DAYS * day)) }
}

/** The validation message of a suspension end, or '' when it may be sent. */
export function untilError(until, now = new Date()) {
  if (!until) return 'Pick the end date of the suspension.'
  const { min, max } = suspendBounds(now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < min || until > max) {
    return `The end date must be between ${min} and ${max}.`
  }
  return ''
}

// Step 10 rules: ban/suspend/deletion only for a Google non-ADMIN, unblock for suspended or banned, re-link for Google.
export function allowedActions(user) {
  if (!user) return { ban: false, suspend: false, unblock: false, relink: false, deletion: false }
  const google = user.accountType === 'GOOGLE' && !user.guest
  const player = google && user.role !== 'ADMIN'
  const hasGoogleIdentity = Array.isArray(user.identities) && user.identities.some(i => i.provider === 'GOOGLE')
  const state = Number(user.state)
  return {
    ban: player && state !== 4,
    suspend: player && (state === 2 || state === 3),
    unblock: state === 3 || state === 4,
    relink: google && hasGoogleIdentity && state !== 7 && !user.relinkPending,
    deletion: player && state !== 7,
  }
}

/** A play time in milliseconds as "1h 02m" / "5m 03s". */
export function fmtPlayTime(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}h ${pad(minutes)}m` : `${minutes}m ${pad(seconds)}s`
}
