/**
 * Step 42 — `?policy=privacy|cookies|terms` deep link: the policy book to open on load,
 * and the clean-up that drops the parameter from the address bar once the book closes.
 */
export const POLICY_PARAM = 'policy'
export const DEEP_LINK_KINDS = ['privacy', 'cookies', 'terms']

/** The policy kind named by the query string, or null when absent or unknown. */
export function readPolicyDeepLink(search = window.location.search) {
  const value = new URLSearchParams(search).get(POLICY_PARAM)
  const kind = String(value ?? '').trim().toLowerCase()
  return DEEP_LINK_KINDS.includes(kind) ? kind : null
}

/** Removes `policy` from the current URL (history entry replaced, router state kept). */
export function clearPolicyDeepLink(win = globalThis.window) {
  if (!win?.location || !win.history?.replaceState) return false
  const url = new URL(win.location.href)
  if (!url.searchParams.has(POLICY_PARAM)) return false
  url.searchParams.delete(POLICY_PARAM)
  win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return true
}
