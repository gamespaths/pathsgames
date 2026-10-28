/** v1.10.0 — the flag of 1.7.0-1.9.0 (this device signed in with Google once) is retired: removed at start. */
export const KNOWN_ACCOUNT_KEY = 'pathsgames.knownAccount'

export function purgeKnownAccount() {
  try {
    window.localStorage.removeItem(KNOWN_ACCOUNT_KEY)
  } catch {
    // storage unavailable: nothing was kept
  }
}
