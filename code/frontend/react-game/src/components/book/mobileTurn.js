import { DONE, canAnimate, cleanClone, handleOf, px, runSimple } from './pageTurn'
import { setMobileTurnBusy } from '@/features/gameplay/js/mobileView'

/* mobileTurn — step 16: the phone turn, one page hinged on its left edge. Only the visible slice of the book is
   copied, on a fixed sheet on <body>; the scroll jumps under it, then the sheet turns away (or a new one turns in). */

const PERSPECTIVE = 'perspective(1400px)'

/** The top of the free screen: under the sticky navbar (step 15: the tabs stand on the book, outside the slice). */
export function viewTop() {
  const nav = document.querySelector('.navbar-medieval')?.getBoundingClientRect()
  return Math.max(0, nav?.bottom ?? 0)
}

/** The book's rectangle cut to the viewport, below the navbar; null when none of it shows. */
export function visibleSlice(bookEl) {
  if (!bookEl) return null
  const book = bookEl.getBoundingClientRect()
  const top = Math.max(book.top, viewTop())
  const bottom = Math.min(book.bottom, window.innerHeight)
  const left = Math.max(book.left, 0)
  const right = Math.min(book.right, window.innerWidth)
  if (bottom <= top || right <= left) return null
  return { left, top, width: right - left, height: bottom - top, book }
}

/** A copy of the whole book cut to `slice`, on a fixed sheet: no id, test id, tooltip or iframe; hidden and inert. */
export function sheetOf(bookEl, slice) {
  const sheet = document.createElement('div')
  sheet.className = 'm-sheet'
  sheet.setAttribute('aria-hidden', 'true')
  Object.assign(sheet.style, px(slice))
  const copy = cleanClone(bookEl)
  copy.node.classList.add('m-sheet__book')
  copy.node.querySelector(':scope > .book-turn-layer')?.replaceChildren()
  Object.assign(copy.node.style, px({ left: slice.book.left - slice.left, top: slice.book.top - slice.top,
    width: slice.book.width, height: slice.book.height }), { margin: '0' })
  sheet.appendChild(copy.node)
  return { sheet, scrolls: copy.scrolls }
}

/** Step 15 — every page change lands at the very top of the document, the tabs on the book's edge in view. */
function land() {
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function addLayer(shot, el, before = null) {
  document.body.insertBefore(el, before)
  shot.layers.push(el)
  return el
}

function addSheet(shot, bookEl, slice) {
  const { sheet, scrolls } = sheetOf(bookEl, slice)
  addLayer(shot, sheet)
  scrolls.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left })
  return sheet
}

function layerEl(className, slice = null) {
  const el = document.createElement('div')
  el.className = className
  el.setAttribute('aria-hidden', 'true')
  if (slice) Object.assign(el.style, px(slice))
  return el
}

/** Removes every layer of the turn and gives the scroll back (also when called twice). */
function release(shot) {
  if (shot.released) return
  shot.released = true
  shot.layers.forEach(el => el.remove())
  shot.layers = []
  document.documentElement.classList.remove('is-turning')
  setMobileTurnBusy(false)
}

/** Before the commit: scroll locked (root class and a touch blocker for iOS), the old slice copied on a still sheet. */
function snapshot(bookEl, request = 'forward') {
  if (!bookEl || request === 'fade') return null
  const shot = { mobile: true, layers: [], released: false, sheet: null, slice: null }
  shot.dispose = () => release(shot)
  document.documentElement.classList.add('is-turning')
  setMobileTurnBusy(true)
  addLayer(shot, layerEl('m-blocker'))
  shot.slice = visibleSlice(bookEl)
  if (shot.slice) shot.sheet = addSheet(shot, bookEl, shot.slice)
  return shot
}

function sheetAnimations(sheet, cast, timings, fwd) {
  const opts = { duration: timings.sheet, fill: 'forwards' }
  const shade = sheet.appendChild(layerEl('flip-shade'))
  const open = `${PERSPECTIVE} rotateY(0deg)`
  const edge = `${PERSPECTIVE} rotateY(-90deg)`
  return [
    sheet.animate([{ transform: fwd ? open : edge }, { transform: fwd ? edge : open }],
      { ...opts, easing: fwd ? 'cubic-bezier(.55,.05,.85,.45)' : 'cubic-bezier(.15,.55,.45,.95)' }),
    shade.animate(fwd ? [{ opacity: 0 }, { opacity: 0.6 }] : [{ opacity: 0.6 }, { opacity: 0 }],
      { ...opts, easing: fwd ? 'ease-in' : 'ease-out' }),
    cast.animate(fwd ? [{ opacity: 0.55 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0.55 }],
      { ...opts, easing: fwd ? 'ease-out' : 'ease-in' }),
  ]
}

/** Forward: jump under the old sheet, then it turns away on its left edge (0 → −90deg) over a fading cast shadow. */
function runForward(shot, timings) {
  land()
  if (!shot.sheet || !canAnimate(shot.sheet)) {
    shot.dispose()
    return DONE
  }
  const cast = addLayer(shot, layerEl('m-cast', shot.slice), shot.sheet)
  return handleOf(sheetAnimations(shot.sheet, cast, timings, true), shot.dispose)
}

/** Back: the old sheet stays still, jump, then a copy of the new slice turns in over it (−90deg → 0). */
function runBack(shot, bookEl, timings) {
  land()
  const slice = visibleSlice(bookEl)
  if (!slice || !shot.sheet || !canAnimate(shot.sheet)) {
    shot.dispose()
    return DONE
  }
  const cast = addLayer(shot, layerEl('m-cast', slice))
  const sheet = addSheet(shot, bookEl, slice)
  return handleOf(sheetAnimations(sheet, cast, timings, false), shot.dispose)
}

/** A held copy released with a fade (a play that did not move): the jump to the top under it, then it fades out. */
function runFade(shot, timings) {
  land()
  if (!shot.sheet || !canAnimate(shot.sheet)) {
    shot.dispose()
    return DONE
  }
  const anim = shot.sheet.animate([{ opacity: 1 }, { opacity: 0 }],
    { duration: timings.fade, easing: 'ease-out', fill: 'forwards' })
  return handleOf([anim], shot.dispose)
}

/** After the commit; `simple` jumps, drops the sheet and swings the live pages as step 15's simple turn. */
function run({ snapshot: shot, bookEl, layer, direction, timings, turnMode }) {
  if (!shot) return DONE
  if (direction === 'fade') return runFade(shot, timings)
  if (turnMode === 'simple') {
    land()
    shot.dispose()
    return runSimple({ bookEl, layer, direction, timings })
  }
  return direction === 'back' ? runBack(shot, bookEl, timings) : runForward(shot, timings)
}

/** The `mobile` strategy of pageTurn: no Book fade on phones (FadeIn fades the previews), the hold is the sheet itself. */
export const mobileStrategy = Object.freeze({
  mobile: true,
  wants: request => request !== 'fade',
  snapshot,
  hold: () => {},
  run,
})
