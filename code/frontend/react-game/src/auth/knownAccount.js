/** v1.7.0 step 12 — a non-personal flag: this device signed in with Google once (kept at logout, removed at deletion). */
export const KNOWN_ACCOUNT_KEY = 'pathsgames.knownAccount'

export function isKnownAccount() {
  try {
    return window.localStorage.getItem(KNOWN_ACCOUNT_KEY) === '1'
  } catch {
    return false
  }
}

/** Written at a Google login: a constant value, no identifier and no email. */
export function markKnownAccount() {
  try {
    window.localStorage.setItem(KNOWN_ACCOUNT_KEY, '1')
  } catch {
    // storage unavailable (private mode): the hint is simply not shown
  }
}

export function forgetKnownAccount() {
  try {
    window.localStorage.removeItem(KNOWN_ACCOUNT_KEY)
  } catch {
    // storage unavailable: nothing was kept
  }
}
