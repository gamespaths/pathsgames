import { useEffect, useRef } from 'react'
import usePageReturn from './usePageReturn'
import { inFlightCount } from '@/api/inFlight'

/** v1.7.0 step 8 — WebKit: every iOS browser (iPadOS too, a Mac with touch) and desktop Safari. */
export function isWebkitBrowser(nav = typeof navigator === 'undefined' ? null : navigator) {
  const ua = String(nav?.userAgent ?? '')
  if (/iPhone|iPad|iPod/.test(ua)) return true
  if (/Macintosh/.test(ua) && Number(nav?.maxTouchPoints ?? 0) > 1) return true
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|Android/.test(ua)
}

/** Whether this browser refetches a match on page return: "all", or "webkit" on a WebKit browser. */
export function shouldRefetchOnReturn(browsers, nav) {
  const list = (browsers ?? []).map(b => String(b).toLowerCase())
  if (list.includes('all')) return true
  return list.includes('webkit') && isWebkitBrowser(nav)
}

/** Calls `onRefetch` back on the page after `minHiddenSeconds` away, or back online; never mid-request. */
export default function useMatchRefetchOnReturn(onRefetch, { browsers, minHiddenSeconds = 30, enabled = true, nav } = {}) {
  const hiddenAt = useRef(null)
  const active = Boolean(enabled) && shouldRefetchOnReturn(browsers, nav)

  useEffect(() => {
    if (!active) return undefined
    const onVisibility = () => { if (document.visibilityState === 'hidden') hiddenAt.current = Date.now() }
    const onPageHide = () => { hiddenAt.current = Date.now() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [active])

  usePageReturn((kind) => {
    const since = hiddenAt.current
    if (inFlightCount() > 0) return
    if (kind === 'online') {
      onRefetch?.()
      return
    }
    hiddenAt.current = null
    if (since !== null && Date.now() - since >= minHiddenSeconds * 1000) onRefetch?.()
  }, { enabled: active })
}
