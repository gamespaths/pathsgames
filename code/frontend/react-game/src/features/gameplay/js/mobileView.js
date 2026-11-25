/**
 * mobileView.js — mobile is a single stacked column (left on top, right below); v1.13.0 — the
 * document scrolls it. On desktop the `.book-mobile-*` wrappers are display:none.
 */
// Narrow screens, plus medium ones wider than tall and at most 500px high: a phone turned sideways.
export const MOBILE_MQ = '(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)'

/** True on the stacked mobile layout — the one place the media query is spelled out. */
export function isMobileViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_MQ).matches
}

/** Bring one stacked column into view; a no-op on desktop. `behavior`: 'smooth' (default) or 'auto'. */
export function scrollMobileIntoView(selector, behavior = 'smooth') {
  if (!isMobileViewport()) return
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView?.({ behavior, block: 'start' })
  })
}

/** Back to the top of the stacked board, after a reload swapped the cards under the player. */
export function scrollBookToTop(behavior = 'smooth') {
  requestAnimationFrame(() => {
    document.querySelector('.book-mobile-left')?.scrollIntoView?.({ behavior, block: 'start' })
  })
}
