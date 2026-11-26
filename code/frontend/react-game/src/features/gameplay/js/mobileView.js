/**
 * mobileView.js — v1.14.0 one tree: on phones the same Book stacks its pages (left on top, right
 * below) and the document scrolls them; on desktop both helpers are no-ops.
 */
// Narrow screens, plus medium ones wider than tall and at most 500px high: a phone turned sideways.
export const MOBILE_MQ = '(max-width: 767px), (max-width: 991px) and (orientation: landscape) and (max-height: 500px)'
// Step 15 — desktop: the bookmarks hang down the book's right side (book.css), wider than the 3-column edge.
export const SIDE_TABS_MQ = '(min-width: 1121px)'

let turnBusy = false

/** True on the stacked mobile layout — the one place the media query is spelled out. */
export function isMobileViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_MQ).matches
}

/** True on the desktop layout whose tabs stand on the book's right side (their tooltips open on the left). */
export function isSideTabsViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(SIDE_TABS_MQ).matches
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

/** Step 15 — phones: back to the very top, the tabs on the book's edge in view; a no-op on desktop and under a turn. */
export function scrollBookToTop(behavior = 'instant') {
  if (!isMobileViewport()) return
  requestAnimationFrame(() => {
    if (turnBusy) return
    window.scrollTo({ top: 0, behavior })
  })
}
