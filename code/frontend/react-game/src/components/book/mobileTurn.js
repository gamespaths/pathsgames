import { DONE, canAnimate, cleanClone, handleOf, px } from './pageTurn'
import { setMobileTurnBusy } from '@/features/gameplay/js/mobileView'

/* mobileTurn — step 16: the phone page change. The visible slice of the book is copied on a fixed sheet on <body>;
   the scroll jumps under it. v1.15.0: no page turn, its cards spin into the page deck while the rest fades (shuffle). */

// Cards of the copy that get their own delay: the ninth leaves with the eighth.
export const GATHER_MAX_STAGGER = 8
const GATHER_EASE = 'cubic-bezier(.5,.05,.6,1)'

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

/** v1.15.0 — the sticky page deck's centre, clamped to the screen's bottom-right corner; the corner when it is not shown. */
export function deckGoal(bookEl) {
  const w = window.innerWidth
  const h = window.innerHeight
  const r = bookEl?.querySelector('.book-page-right > .deck')?.getBoundingClientRect()
  if (!r?.width || r.bottom <= viewTop() || r.top >= h) return { x: w - 50, y: h - 60, width: 54 }
  return { x: Math.min(r.left + r.width / 2, w - 40), y: Math.min(r.top + r.height / 2, h - 50), width: r.width }
}

/** Step 15 — every page change lands at the very top of the document, the tabs on the book's edge in view. */
function land() {
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function addLayer(shot, el) {
  document.body.appendChild(el)
  shot.layers.push(el)
  return el
}

function addSheet(shot, bookEl, slice) {
  const { sheet, scrolls } = sheetOf(bookEl, slice)
  addLayer(shot, sheet)
  scrolls.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left })
  return sheet
}

function layerEl(className) {
  const el = document.createElement('div')
  el.className = className
  el.setAttribute('aria-hidden', 'true')
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
  const shot = { mobile: true, layers: [], released: false, sheet: null, slice: null, goal: deckGoal(bookEl) }
  shot.dispose = () => release(shot)
  document.documentElement.classList.add('is-turning')
  setMobileTurnBusy(true)
  addLayer(shot, layerEl('m-blocker'))
  shot.slice = visibleSlice(bookEl)
  if (shot.slice) shot.sheet = addSheet(shot, bookEl, shot.slice)
  return shot
}

const SKIPPED = '.is-discarded, .is-played, [data-deal="waiting"]'

/** The small cards of the copy on screen (not discarded, played or still on the deck), in page order. */
export function leavingCards(sheet, slice) {
  const bottom = slice.top + slice.height
  return [...sheet.querySelectorAll('.pg-card')].filter(card => {
    if (card.matches(SKIPPED)) return false
    const r = card.getBoundingClientRect()
    return r.bottom > slice.top && r.top < bottom
  })
}

const isWrapper = el => el.classList.contains('book-content')
const isCovered = el => el.classList.contains('book-content--covered')

/** What fades on the copy: every part of its pages but the small cards (they leave on their own way) and their lists. */
export function fadingParts(bookEl) {
  const parts = []
  const walk = el => [...el.children].forEach(child => {
    if (isCovered(child) || child.classList.contains('pg-card')) return
    if (isWrapper(child) || child.querySelector('.pg-card')) walk(child)
    else parts.push(child)
  })
  bookEl?.querySelectorAll(':scope > .book-page > .page-inner').forEach(walk)
  return parts
}

/** What fades in on the live page: the boxes inside its pages (a `.book-content` is no box, its children are). */
export function pageParts(bookEl) {
  const parts = []
  const walk = el => [...el.children].forEach(child => {
    if (isCovered(child)) return
    if (isWrapper(child)) walk(child)
    else parts.push(child)
  })
  bookEl?.querySelectorAll(':scope > .book-page > .page-inner').forEach(walk)
  return parts
}

/** One card of the copy spins in its plane (no 3D: a fading 3D card shows its front mirrored) and shrinks into the deck. */
function gather(card, goal, sign, i, timings) {
  const r = card.getBoundingClientRect()
  const dx = goal.x - (r.left + r.width / 2)
  const dy = goal.y - (r.top + r.height / 2)
  return card.animate([
    { transform: 'none', opacity: 1 },
    { transform: `translate(${dx * 0.15}px, ${dy * 0.15 - 24}px) rotate(${sign * 70}deg) scale(0.85)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${sign * 240}deg) scale(0.3)`, opacity: 1, offset: 0.9 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${sign * 260}deg) scale(0.25)`, opacity: 0 },
  ], { duration: timings.gather, delay: Math.min(i, GATHER_MAX_STAGGER) * timings.gatherStep, easing: GATHER_EASE,
    fill: 'forwards' })
}

/** Forward and back, both modes: jump, the copy's cards gather into the deck, the rest fades, then the new page fades in. */
function runShuffle(shot, bookEl, direction, timings) {
  land()
  if (!shot.sheet || !canAnimate(shot.sheet)) {
    shot.dispose()
    return DONE
  }
  const sign = direction === 'back' ? -1 : 1
  const cards = leavingCards(shot.sheet, shot.slice)
  const parts = fadingParts(shot.sheet.firstChild)
  const leaving = [
    ...cards.map((card, i) => gather(card, shot.goal, sign, i, timings)),
    ...parts.map(part => part.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: timings.fade, easing: 'ease-out', fill: 'forwards' })),
  ]
  const gone = Math.max(cards.length ? Math.min(cards.length - 1, GATHER_MAX_STAGGER) * timings.gatherStep + timings.gather : 0,
    parts.length ? timings.fade : 0)
  const sheet = shot.sheet
  Promise.all(leaving.map(a => a.finished)).catch(() => {}).then(() => sheet.remove())
  const arriving = pageParts(bookEl).map(part => part.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: timings.fade, delay: gone, easing: 'ease-out', fill: 'backwards' }))
  return handleOf([...leaving, ...arriving], shot.dispose)
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

/** After the commit; v1.15.0: phones shuffle in both turn modes, the fade direction keeps the copy's fade. */
function run({ snapshot: shot, bookEl, direction, timings }) {
  if (!shot) return DONE
  if (direction === 'fade') return runFade(shot, timings)
  return runShuffle(shot, bookEl, direction, timings)
}

/** The `mobile` strategy of pageTurn: no Book fade on phones (FadeIn fades the previews), the hold is the sheet itself. */
export const mobileStrategy = Object.freeze({
  mobile: true,
  wants: request => request !== 'fade',
  snapshot,
  hold: () => {},
  run,
})
