/**
 * v1.2.0 several tabs, one session: a single tab refreshes at a time (Web Locks, or a plain run when
 * the browser has none) and a BroadcastChannel tells the other tabs about login, logout and refresh.
 */
export const CHANNEL = 'pathsgames.session'
export const REFRESH_LOCK = 'pathsgames.refresh'

let chain = Promise.resolve()

/** Runs `fn` while holding the refresh lock: concurrent refreshes of the same browser queue up. */
export function withRefreshLock(fn) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) {
    return locks.request(REFRESH_LOCK, () => fn())
  }
  // Same-tab fallback: chain the calls so two refreshes never overlap.
  const run = chain.then(() => fn())
  chain = run.catch(() => undefined)
  return run
}

/** Opens the session channel; answers { post(type), close() } (no-ops without BroadcastChannel). */
export function openSessionChannel(onMessage) {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: () => {}, close: () => {} }
  }
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event) => onMessage?.(event?.data?.type)
  return {
    post: (type) => channel.postMessage({ type }),
    close: () => channel.close(),
  }
}
