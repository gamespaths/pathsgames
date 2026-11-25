/**
 * mobileView.js — v1.14.0 one tree: on phones the same Book stacks its pages (left on top, right
 * below) and the document scrolls them; on desktop both helpers are no-ops.
 */
// Narrow screens, plus medium ones wider than tall and at most 500px high: a phone turned sideways.
export const MOBILE_MQ = '(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)'

let turnBusy = false

/** True on the stacked mobile layout — the one place the media query is spelled out. */
export function isMobileViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_MQ).matches
}

/** Step 16 — set by the mobile page turn while its sheet is up: the turn lands the scroll itself. */
export function setMobileTurnBusy(busy) {
  turnBusy = !!busy
}

export function mobileTurnBusy() {
  return turnBusy
}

/** Bring one stacked column into view; a no-op on desktop. Step 16: instant by default ('instant' beats Bootstrap's smooth :root), skipped under a turn. */
export function scrollMobileIntoView(selector, behavior = 'instant') {
  if (!isMobileViewport()) return
  requestAnimationFrame(() => {
    if (turnBusy) return
    document.querySelector(selector)?.scrollIntoView?.({ behavior, block: 'start' })
  })
}

/** Back to the top of the stacked board, after a reload swapped the cards under the player. */
export function scrollBookToTop(behavior = 'instant') {
  scrollMobileIntoView('.book-page-left', behavior)
}
