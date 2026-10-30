import { useEffect, useRef } from 'react'

/** v1.7.0 — the events that mean "the player is back on the page" and the minimum gap between re-reads. */
export const PAGE_RETURN_EVENTS = ['visibilitychange', 'pageshow', 'online']
export const PAGE_RETURN_MIN_INTERVAL_MS = 2000

/** Calls `onReturn` on visible again, back-forward cache restore or online; a burst counts once. */
export default function usePageReturn(onReturn, { enabled = true, minIntervalMs = PAGE_RETURN_MIN_INTERVAL_MS } = {}) {
  const callback = useRef(onReturn)
  callback.current = onReturn

  useEffect(() => {
    if (!enabled) return undefined
    let last = 0
    // v1.7.0 step 8 — the callback learns which event fired: visible, pageshow or online
    const fire = (kind) => {
      const now = Date.now()
      if (now - last < minIntervalMs) return
      last = now
      callback.current?.(kind)
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') fire('visible') }
    const onPageShow = (event) => { if (event?.persisted) fire('pageshow') }
    const onOnline = () => fire('online')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, minIntervalMs])
}
