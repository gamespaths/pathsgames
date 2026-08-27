/**
 * mobileView.js — mobile is a single stacked column (left on top, right below) that scrolls
 * as a whole inside `.book-overlay`; on desktop the `.book-mobile-*` wrappers are display:none.
 */
export const MOBILE_MQ = '(max-width: 767px)'

/** True on the stacked mobile layout — the one place the media query is spelled out. */
export function isMobileViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_MQ).matches
}

/** Bring one stacked column into view; a no-op on desktop. */
export function scrollMobileIntoView(selector) {
  if (!isMobileViewport()) return
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  })
}

/** Back to the top of the stacked board, after a reload swapped the cards under the player. */
export function scrollBookToTop() {
  requestAnimationFrame(() => {
    document.querySelector('.book-overlay')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    document.querySelector('.book-mobile-left')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  })
}
