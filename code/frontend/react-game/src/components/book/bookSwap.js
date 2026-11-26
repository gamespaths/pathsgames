import { D20_PATH, D20_TRANSFORM } from '@/components/layout/CardBack'
import { setMobileTurnBusy } from '@/features/gameplay/js/mobileView'
import { DONE, cleanClone, pickStrategy, px } from './pageTurn'
import { sheetOf, viewTop } from './mobileTurn'

/* bookSwap — step 15: the book of each route, what a route change does (a book change or a page turn) and the change:
   the open book closes, slides out left, the next one slides in closed and opens (copies only, on fixed layers). */

/** Router state of a redirect (`*`, the direct-load guards): no change, no turn, an open chapter kept. */
export const REDIRECT_STATE = { redirected: true }

// The Home book (Home, player page) and one story book per story (set-up, start match, game); rank = page order.
const ROUTE_BOOKS = [
  [/^\/$/, 'home', 0],
  [/^\/player\/?$/, 'home', 1],
  [/^\/story\/([^/]+)\/?$/, 'story', 1],
  [/^\/start-match\/([^/]+)\/?$/, 'story', 2],
  [/^\/play\/([^/]+)\/?$/, 'story', 3],
]

/** `{ book, id, rank }` of a pathname, or null for a path with no book of its own (a redirect). */
export function bookOf(pathname) {
  const path = String(pathname ?? '')
  for (const [pattern, book, rank] of ROUTE_BOOKS) {
    const hit = pattern.exec(path)
    if (hit) return { book, id: hit[1] ?? null, rank }
  }
  return null
}

/** What a change of the shown route does: 'swap' (another book), 'forward' / 'back' (same book, by rank) or null. */
export function routeTransition(prev, next) {
  if (!prev || !next || next.state?.redirected || prev.pathname === next.pathname) return null
  const from = bookOf(prev.pathname)
  const to = bookOf(next.pathname)
  if (!from || !to) return null
  if (from.book !== to.book || from.id !== to.id) return 'swap'
  if (to.rank === from.rank) return null
  return to.rank > from.rank ? 'forward' : 'back'
}

const IDENTITY = key => key

/** A cover's title and subtitle: the Home book's name, else the story title (book attribute, router state), else none. */
export function coverText({ pathname, attr = null, state = null, t = IDENTITY }) {
  if (bookOf(pathname)?.book === 'home') return { title: t('nav.brand'), sub: t('book.coverSub') }
  const title = attr || state?.story?.title || null
  return title ? { title, sub: t('nav.brand') } : { title: null, sub: null }
}

export const SWAP_PHASES = Object.freeze(['open', 'close', 'fade', 'flip', 'slide', 'sheet'])

/** How long a book change lasts at these timings: desktop full, phone cover, or simple (both layouts). */
export function swapTotal(timings, { layout = 'desktop', mode = 'full' } = {}) {
  if (mode === 'simple') return timings.close + timings.open
  if (layout === 'phone') return 2 * (timings.sheet + timings.slide)
  return 2 * (timings.fade + timings.flip + timings.slide)
}

/** The phases of a book change, all shrunk by the same factor when the total passes `maxMs` (0 = no limit). */
export function swapTimings(timings, { layout = 'desktop', mode = 'full', maxMs = 0 } = {}) {
  const total = swapTotal(timings, { layout, mode })
  const factor = maxMs > 0 && total > maxMs ? maxMs / total : 1
  return Object.fromEntries(SWAP_PHASES.map(key => [key, Math.round(timings[key] * factor)]))
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function div(className, text = null) {
  const node = document.createElement('div')
  node.className = className
  if (text !== null) node.textContent = text
  return node
}

function d20() {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'cover-d20')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('focusable', 'false')
  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('transform', D20_TRANSFORM)
  g.setAttribute('fill', 'currentColor')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', D20_PATH)
  g.appendChild(path)
  svg.appendChild(g)
  return svg
}

/** Writes the cover's title and subtitle; without a title the d20 stays alone. */
export function setCoverText(face, { title = null, sub = null } = {}) {
  face.querySelectorAll(':scope > .cover-title, :scope > .cover-sub').forEach(node => node.remove())
  if (!title) return
  face.append(div('cover-title', title), div('cover-sub', sub ?? ''))
}

/** The front cover (concept .cover-face): tooled leather, gold frame, the card back's d20 and the title; hidden, inert. */
export function coverFace(text, className = '') {
  const face = div(['cover-face', className].filter(Boolean).join(' '))
  face.setAttribute('aria-hidden', 'true')
  face.setAttribute('inert', '')
  face.append(div('cover-frame'), d20())
  setCoverText(face, text)
  return face
}

/** Phones: the visible part of the book under the navbar, the tabs over and under its cover included. */
export function swapSlice(bookEl) {
  if (!bookEl) return null
  const book = bookEl.getBoundingClientRect()
  let top = book.top
  let bottom = book.bottom
  bookEl.querySelectorAll(':scope > .book-bookmarks-row > .book-bookmarks').forEach(group => {
    const r = group.getBoundingClientRect()
    if (r.height > 0) {
      top = Math.min(top, r.top)
      bottom = Math.max(bottom, r.bottom)
    }
  })
  const from = Math.max(top, viewTop())
  const to = Math.min(bottom, window.innerHeight)
  const left = Math.max(book.left, 0)
  const right = Math.min(book.right, window.innerWidth)
  if (to <= from || right <= left) return null
  return { left, top: from, width: right - left, height: to - from, book }
}

/** The very top of the document, at once (Bootstrap's smooth scroll would move the page under the measures). */
export function scrollTop() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  } catch {
    // no scrolling available (jsdom)
  }
}

function restore(scrolls) {
  scrolls.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left })
}

/** Desktop: a still copy of the book where it is on screen — a shell box (its CSS variables), a clean cover, no pile. */
export function bookCopy(bookEl) {
  const box = bookEl.getBoundingClientRect()
  const shell = div('book-shell book-swap__book')
  shell.setAttribute('aria-hidden', 'true')
  shell.setAttribute('inert', '')
  Object.assign(shell.style, px(box))
  const copy = cleanClone(bookEl)
  copy.node.querySelector(':scope > .book-turn-layer')?.replaceChildren()
  shell.appendChild(copy.node)
  return { el: shell, book: copy.node, scrolls: copy.scrolls, box }
}

function lockPhone() {
  document.documentElement.classList.add('is-turning')
  setMobileTurnBusy(true)
  const blocker = div('m-blocker')
  blocker.setAttribute('aria-hidden', 'true')
  document.body.appendChild(blocker)
  return blocker
}

function unlockPhone() {
  document.documentElement.classList.remove('is-turning')
  setMobileTurnBusy(false)
}

/** Before the commit: the old book copied (desktop: whole; phones: the visible slice, tabs included) with its cover text. */
export function swapSnapshot(bookEl, { phone = false, text = {} } = {}) {
  if (!phone) return { phone: false, copy: bookCopy(bookEl), text, layers: [] }
  const layers = [lockPhone()]
  const slice = swapSlice(bookEl)
  let sheet = null
  if (slice) {
    const shot = sheetOf(bookEl, slice)
    sheet = shot.sheet
    sheet.classList.add('m-sheet--tabs')
    document.body.appendChild(sheet)
    restore(shot.scrolls)
    layers.push(sheet)
  }
  return { phone: true, slice, sheet, text, layers }
}

/** A run of phases: `step(animations)` waits for them (false once stopped); `end()` stops, cleans up once, settles. */
export function phaseRun(cleanup) {
  let over = false
  let settle
  const finished = new Promise(resolve => { settle = resolve })
  const live = new Set()
  const end = () => {
    if (over) return
    over = true
    live.forEach(a => { try { a.cancel() } catch { /* gone with its element */ } })
    live.clear()
    cleanup()
    settle()
  }
  return {
    finished,
    finish: end,
    end,
    async step(animations) {
      if (over) return false
      const list = animations.filter(Boolean)
      list.forEach(a => live.add(a))
      await Promise.all(list.map(a => a.finished)).catch(() => {})
      list.forEach(a => live.delete(a))
      return !over
    },
  }
}

const FOLD_EASE = 'cubic-bezier(.45,.05,.3,1)'
const OUT_EASE = 'cubic-bezier(.55,.05,.85,.45)'
const IN_EASE = 'cubic-bezier(.15,.55,.45,.95)'
// Only the left half of the cover stays (the right one is the flap); the margins keep its shadow.
const LEFT_HALF = 'inset(-60px 50% -80px -60px)'
const PERSPECTIVE = 'perspective(1400px)'

// The former CSS `bookOpen` (first load, simple change) and the simple change's closing (concept pg-book-close).
export const OPEN_FRAMES = [
  { opacity: 0, transform: 'perspective(1200px) rotateX(20deg) scale(0.85)' },
  { opacity: 1, transform: 'perspective(1200px) rotateX(0deg) scale(1)' },
]
export const CLOSE_FRAMES = [
  { opacity: 1, transform: 'perspective(1200px) rotateX(0deg) scale(1)' },
  { opacity: 0, transform: 'perspective(1200px) rotateX(-8deg) scale(0.92)' },
]

/** The book opening (first load, the end of a simple change). */
export function openBook(bookEl, duration) {
  return bookEl.animate(OPEN_FRAMES, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
}

function closeCopy(node, duration) {
  return node.animate(CLOSE_FRAMES, { duration, easing: 'ease-in', fill: 'forwards' })
}

function shade() {
  return div('flip-shade')
}

function mount(layer, copy) {
  layer.appendChild(copy.el)
  restore(copy.scrolls)
}

function fadeTabs(copy, from, to, duration) {
  const row = copy.book.querySelector(':scope > .book-bookmarks-row')
  return row ? row.animate([{ opacity: from }, { opacity: to }], { duration, fill: 'forwards' }) : null
}

function slide(node, from, to, duration, easing) {
  return node.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
    { duration, easing, fill: 'forwards' })
}

/** The right half of a mounted copy as a flap hinged on the spine: its page in front, the cover (`text`) behind. */
function flapOf(copy, text) {
  const { width, height } = copy.box
  copy.book.style.clipPath = LEFT_HALF
  const inner = cleanClone(copy.book)
  inner.node.classList.add('flap-copy')
  Object.assign(inner.node.style, { clipPath: '', width: `${width}px`, height: `${height}px`, left: `${-width / 2}px` })
  const front = div('flap-face flap-front')
  const frontShade = shade()
  front.append(inner.node, frontShade)
  const back = coverFace(text, 'flap-face flap-back')
  const backShade = back.appendChild(shade())
  const flap = div('book-flap')
  flap.append(front, back)
  copy.el.appendChild(flap)
  restore(inner.scrolls)
  return { flap, frontShade, backShade }
}

/** The flap folds over the spine (closing) or opens from it, with the page turn's shades (concept fullTurn). */
function fold({ flap, frontShade, backShade }, flip, closing) {
  const half = flip / 2
  const [from, to] = closing ? [0, -180] : [-180, 0]
  return [
    flap.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }],
      { duration: flip, easing: FOLD_EASE, fill: 'forwards' }),
    (closing ? frontShade : backShade).animate([{ opacity: 0 }, { opacity: 0.55 }],
      { duration: half, easing: 'ease-in', fill: 'forwards' }),
    (closing ? backShade : frontShade).animate([{ opacity: 0.55 }, { opacity: 0 }],
      { delay: half, duration: half, fill: 'both' }),
  ]
}

/** Desktop `full` (concept swapBook): tabs out, the right half folds, out left; the next one in, it opens, tabs in. */
async function desktopFull(run, { T, shot, layer, liveBook, nextText }) {
  scrollTop()
  const old = shot.copy
  mount(layer, old)
  if (!(await run.step([fadeTabs(old, 1, 0, T.fade)]))) return
  if (!(await run.step(fold(flapOf(old, shot.text), T.flip, true)))) return
  if (!(await run.step([slide(old.el, 0, -(old.box.left + old.box.width / 2 + 80), T.slide, OUT_EASE)]))) return
  old.el.remove()
  const live = liveBook()
  if (!live) {
    run.end()
    return
  }
  const next = bookCopy(live)
  mount(layer, next)
  next.book.querySelector(':scope > .book-bookmarks-row')?.style.setProperty('opacity', '0')
  const cover = flapOf(next, nextText(live))
  cover.flap.style.transform = 'rotateY(-180deg)'
  if (!(await run.step([slide(next.el, window.innerWidth - next.box.left + 80, 0, T.slide, IN_EASE)]))) return
  if (!(await run.step(fold(cover, T.flip, false)))) return
  next.book.style.clipPath = ''
  cover.flap.remove()
  if (!(await run.step([fadeTabs(next, 0, 1, T.fade)]))) return
  run.end()
}

/** `simple`, desktop: the copy closes (fade, tilt, shrink), then the live book opens (a remount just ends it). */
async function desktopSimple(run, { T, shot, layer, liveBook, reveal }) {
  scrollTop()
  mount(layer, shot.copy)
  if (!(await run.step([closeCopy(shot.copy.el, T.close)]))) return
  shot.copy.el.remove()
  reveal()
  const live = liveBook()
  if (!(await run.step([live && openBook(live, T.open)]))) return
  run.end()
}

/** Phones (concept mobileSwap): a cover closes over the slice, slides out, the title changes, slides in and opens. */
async function phoneCover(run, { T, shot, add, liveBook, nextText, reveal }) {
  if (!shot.slice) {
    run.end()
    return
  }
  const cover = add(coverFace(shot.text, 'm-sheet m-cover'))
  Object.assign(cover.style, px(shot.slice))
  const coverShade = cover.appendChild(shade())
  const swing = (from, to, easing) => [
    cover.animate([{ transform: `${PERSPECTIVE} rotateY(${from}deg)` }, { transform: `${PERSPECTIVE} rotateY(${to}deg)` }],
      { duration: T.sheet, easing, fill: 'forwards' }),
    coverShade.animate(from ? [{ opacity: 0.6 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0.6 }],
      { duration: T.sheet, fill: 'forwards' }),
  ]
  const move = (from, to, easing) => cover.animate([
    { transform: `${PERSPECTIVE} translateX(${from}) rotateY(0deg)` },
    { transform: `${PERSPECTIVE} translateX(${to}) rotateY(0deg)` },
  ], { duration: T.slide, easing, fill: 'forwards' })
  if (!(await run.step(swing(-90, 0, IN_EASE)))) return
  shot.sheet?.remove()
  if (!(await run.step([move('0px', '-110vw', OUT_EASE)]))) return
  scrollTop()
  const live = liveBook()
  setCoverText(cover, nextText(live))
  const slice = swapSlice(live)
  if (slice) Object.assign(cover.style, px(slice))
  if (!(await run.step([move('110vw', '0px', IN_EASE)]))) return
  reveal()
  if (!(await run.step(swing(0, -90, OUT_EASE)))) return
  run.end()
}

/** `simple`, phones: the slice copy closes, the page jumps to the top, the live book opens. */
async function phoneSimple(run, { T, shot, liveBook, reveal }) {
  if (shot.sheet && !(await run.step([closeCopy(shot.sheet, T.close)]))) return
  shot.sheet?.remove()
  scrollTop()
  reveal()
  const live = liveBook()
  if (!(await run.step([live && openBook(live, T.open)]))) return
  run.end()
}

function fixedLayer() {
  const layer = div('book-swap')
  layer.setAttribute('aria-hidden', 'true')
  return layer
}

/** After the commit: the change on copies over the hidden live book; a handle `{ finished, finish }` as a page turn's. */
export function runSwap(shot, { timings, mode = 'full', liveBook, nextText, hide = () => {}, reveal = () => {} }) {
  const layers = [...shot.layers]
  const add = node => {
    document.body.appendChild(node)
    layers.push(node)
    return node
  }
  const layer = shot.phone ? null : add(fixedLayer())
  hide()
  const run = phaseRun(() => {
    layers.forEach(node => node.remove())
    if (shot.phone) unlockPhone()
    reveal()
  })
  const simple = mode === 'simple'
  const body = shot.phone ? (simple ? phoneSimple : phoneCover) : (simple ? desktopSimple : desktopFull)
  body(run, { T: timings, shot, layer, add, liveBook, nextText, reveal }).catch(() => run.end())
  return run
}

/** Before the commit: the old pages for a turn of the same book (step 15's strategy of the layout and mode). */
export function turnSnapshot(bookEl, { direction, turnMode, phone = false }) {
  const strategy = pickStrategy({ direction, turnMode, mobile: phone })
  const snapshot = strategy.snapshot(bookEl, direction)
  return snapshot ? { strategy, snapshot, direction, phone } : null
}

/** After the commit: the turn on the new book; desktop: in a fixed layer on it, so a loading → board remount cannot cut it. */
export function runRouteTurn(shot, { liveBook, timings, turnMode }) {
  const live = liveBook()
  if (!live) {
    shot.snapshot.dispose?.()
    return DONE
  }
  let frame = null
  let layer = document.createElement('div')
  if (!shot.phone) {
    scrollTop()
    frame = fixedLayer()
    layer = div('book-turn-layer')
    Object.assign(layer.style, px(live.getBoundingClientRect()))
    frame.appendChild(layer)
    document.body.appendChild(frame)
  }
  const handle = shot.strategy.run({ snapshot: shot.snapshot, bookEl: live, layer, direction: shot.direction, timings, turnMode })
  const drop = () => frame?.remove()
  return { finished: handle.finished.then(drop), finish() { handle.finish(); drop() } }
}
