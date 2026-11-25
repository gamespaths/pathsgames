import { isMobileViewport } from '@/features/gameplay/js/mobileView'
import { mobileStrategy } from './mobileTurn'

/* pageTurn — step 15: the page turn strategies. A snapshot clones the old pages before React commits the new
   ones; `run` animates the clones over the new pages (WAAPI) in `.book-turn-layer`, then empties it. */

const STRIPPED = ['id', 'data-testid', 'data-tip']

/** True where the Web Animations API exists (jsdom has none: every effect takes the plain path). */
export function canAnimate(el = globalThis.document?.documentElement) {
  return typeof el?.animate === 'function'
}

/** Whether a turn may run now: the turn flag on, no reduced motion, WAAPI (step 16: phones turn too). */
export function turnsActive(settings) {
  return !!settings?.turn && !settings?.reduced && canAnimate()
}

/** A copy safe to show over the live page: no id, test id or tooltip, iframes as empty boxes, inert. */
export function cleanClone(node) {
  const copy = node.cloneNode(true)
  const scrolls = []
  scrub(node, copy, scrolls)
  copy.setAttribute('inert', '')
  copy.setAttribute('aria-hidden', 'true')
  return { node: copy, scrolls }
}

function scrub(src, dst, scrolls) {
  STRIPPED.forEach(name => dst.removeAttribute(name))
  if (src.scrollTop || src.scrollLeft) scrolls.push({ el: dst, top: src.scrollTop, left: src.scrollLeft })
  const from = src.children
  const to = dst.children
  for (let i = from.length - 1; i >= 0; i -= 1) {
    if (to[i].tagName === 'IFRAME') {
      // Turnstile or Google would load again inside the copy: an empty box of the same size instead.
      const box = document.createElement('div')
      box.className = 'turn-iframe-box'
      box.style.width = `${from[i].offsetWidth}px`
      box.style.height = `${from[i].offsetHeight}px`
      to[i].replaceWith(box)
    } else {
      scrub(from[i], to[i], scrolls)
    }
  }
}

function boxOf(page) {
  return { left: page.offsetLeft, top: page.offsetTop, width: page.offsetWidth, height: page.offsetHeight }
}

export function px(box) {
  return { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }
}

export function pageOf(bookEl, side) {
  return bookEl?.querySelector(`:scope > .book-page-${side}`) ?? null
}

function restoreScrolls(clone) {
  clone.scrolls.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left })
}

/** Puts a page clone in the layer over the page it copies (a no-op when it is already there). */
export function place(layer, clone, box = clone.box) {
  if (clone.node.parentNode === layer) return
  Object.assign(clone.node.style, { position: 'absolute', margin: '0' }, px(box))
  layer.appendChild(clone.node)
  restoreScrolls(clone)
}

/** Both pages of the book as clones with their boxes, or null when the book has no pages. */
export function snapshotPages(bookEl) {
  const left = pageOf(bookEl, 'left')
  const right = pageOf(bookEl, 'right')
  if (!left || !right) return null
  return { left: { ...cleanClone(left), box: boxOf(left) }, right: { ...cleanClone(right), box: boxOf(right) } }
}

/** Shows the snapshot still over the new pages (the hold while the board reloads). */
export function holdPages(layer, snapshot) {
  place(layer, snapshot.left)
  place(layer, snapshot.right)
}

export const DONE = Object.freeze({ finished: Promise.resolve(), finish() {} })

/** One handle for a set of animations: `finished` once all end (cleanup run), `finish()` ends them at once. */
export function handleOf(animations, cleanup) {
  let over = false
  const end = () => { if (!over) { over = true; cleanup() } }
  const finished = Promise.all(animations.map(a => a.finished)).catch(() => {}).then(end)
  return {
    finished,
    finish() {
      animations.forEach(a => { try { a.finish() } catch { a.cancel() } })
      end()
    },
  }
}

function shade() {
  const el = document.createElement('div')
  el.className = 'flip-shade'
  return el
}

/** `full`: a sheet hinged on the spine, the old page in front and the new one on its back (concept fullTurn). */
function runFull({ snapshot, bookEl, layer, direction, timings }) {
  const fwd = direction !== 'back'
  const held = fwd ? snapshot.left : snapshot.right
  const sheet = fwd ? snapshot.right : snapshot.left
  const uncovered = pageOf(bookEl, fwd ? 'left' : 'right')
  if (!uncovered || !canAnimate(layer)) {
    layer.replaceChildren()
    return DONE
  }
  place(layer, held)
  const back = cleanClone(uncovered)
  const flipper = document.createElement('div')
  flipper.className = `page-flipper ${fwd ? 'is-fwd' : 'is-back'}`
  Object.assign(flipper.style, px(sheet.box))
  Object.assign(sheet.node.style, { position: '', left: '', top: '', width: '', height: '', margin: '' })
  sheet.node.classList.add('flip-front')
  back.node.classList.add('flip-back')
  const frontShade = sheet.node.appendChild(shade())
  const backShade = back.node.appendChild(shade())
  flipper.append(sheet.node, back.node)
  const cast = document.createElement('div')
  cast.className = `turn-shadow ${fwd ? 'from-left' : 'from-right'}`
  Object.assign(cast.style, px(sheet.box))
  layer.append(cast, flipper)
  restoreScrolls(sheet)
  restoreScrolls(back)

  const half = timings.flip / 2
  const animations = [
    flipper.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${fwd ? -180 : 180}deg)` }],
      { duration: timings.flip, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }),
    frontShade.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: 'ease-in', fill: 'forwards' }),
    backShade.animate([{ opacity: 0.55 }, { opacity: 0 }], { delay: half, duration: half, easing: 'ease-out', fill: 'both' }),
    cast.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: timings.flip, easing: 'ease-out', fill: 'forwards' }),
  ]
  return handleOf(animations, () => layer.replaceChildren())
}

/** `simple`: no clones; the live pages swing in (concept page-enter / page-enter-back / page-fade). */
export function runSimple({ bookEl, layer, direction, timings }) {
  layer.replaceChildren()
  const left = pageOf(bookEl, 'left')?.querySelector(':scope > .page-inner')
  const right = pageOf(bookEl, 'right')?.querySelector(':scope > .page-inner')
  if (!left || !right || !canAnimate(left)) return DONE
  const back = direction === 'back'
  const origin = back ? 'right center' : 'left center'
  const angle = back ? 35 : -35
  const animations = [
    left.animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: timings.simple, easing: 'ease', fill: 'backwards' }),
    right.animate([
      { opacity: 0, transform: `perspective(1400px) rotateY(${angle}deg)`, transformOrigin: origin },
      { opacity: 1, transform: 'perspective(1400px) rotateY(0deg)', transformOrigin: origin },
    ], { duration: timings.simple, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }),
  ]
  return handleOf(animations, () => {})
}

/** `fade`: both old clones fade out over the live pages (an unchanged page crossfades with itself, unseen). */
function runFade({ snapshot, layer, timings }) {
  if (!canAnimate(layer)) {
    layer.replaceChildren()
    return DONE
  }
  holdPages(layer, snapshot)
  const animations = [snapshot.left, snapshot.right].map(c =>
    c.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: timings.fade, easing: 'ease-out', fill: 'forwards' }))
  return handleOf(animations, () => layer.replaceChildren())
}

/** Each strategy: `snapshot(bookEl)` before the commit, `run({ snapshot, bookEl, layer, direction, timings })` after it. */
export const STRATEGIES = {
  full: { snapshot: snapshotPages, run: runFull },
  simple: { snapshot: snapshotPages, run: runSimple },
  fade: { snapshot: snapshotPages, run: runFade },
  // Step 16 — a getter: mobileTurn.js imports this module back, so it is read only when a turn starts.
  get mobile() { return mobileStrategy },
}

/** The strategy of a turn: only `mobile` on the phone layout, `fade` for a fade, else the turn mode's. */
export function pickStrategy({ direction, turnMode, mobile = isMobileViewport() }) {
  if (mobile) return STRATEGIES.mobile
  if (direction === 'fade') return STRATEGIES.fade
  return turnMode === 'simple' ? STRATEGIES.simple : STRATEGIES.full
}
