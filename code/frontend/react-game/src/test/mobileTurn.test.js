import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  viewTop, visibleSlice, sheetOf, mobileStrategy, deckGoal, leavingCards, fadingParts, pageParts, GATHER_MAX_STAGGER,
} from '../components/book/mobileTurn'
import { mobileTurnBusy, setMobileTurnBusy } from '../features/gameplay/js/mobileView'
import { installWaapi } from './fixtures/waapi'

// Step 16 — the phone turn: the visible slice of the book on a fixed sheet, the jump under it (WAAPI stubbed).
// v1.15.0 — no page turn on phones: the cards of the copy gather into the page deck, the rest fades (shuffle).

const TIMINGS = { sheet: 620, simple: 520, fade: 200, gather: 420, gatherStep: 60 }
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top })

/** A phone book like Book renders it: wrapper > tab row (step 15: on the book's edge), pages, turn layer; plus the navbar. */
function makeBook({ left = 'old left', right = 'old right', bookTop = -200, rowBottom = 104 } = {}) {
  const nav = document.createElement('nav')
  nav.className = 'navbar-medieval'
  nav.getBoundingClientRect = () => rect(0, 0, 360, 56)
  document.body.appendChild(nav)
  const book = document.createElement('div')
  book.className = 'book-wrapper'
  book.setAttribute('data-page-key', '1')
  book.innerHTML = `
    <div class="book-bookmarks-row"><button data-tip="Map" aria-label="Map"></button></div>
    <div class="book-page book-page-left"><div class="page-inner"><p id="l" data-testid="left-text" data-tip="tip">${left}</p><img src="a.png"></div></div>
    <div class="book-page book-page-right"><div class="page-inner"><p data-testid="right-text">${right}</p><iframe title="t"></iframe></div></div>
    <div class="book-turn-layer"><span>stale</span></div>`
  document.body.appendChild(book)
  book.getBoundingClientRect = () => rect(0, bookTop, 360, 1500)
  book.querySelector('.book-bookmarks-row').getBoundingClientRect = () => rect(0, rowBottom - 48, 360, 48)
  const scrolls = { book: vi.fn(), left: vi.fn(), right: vi.fn() }
  book.scrollIntoView = scrolls.book
  book.querySelector('.book-page-left').scrollIntoView = scrolls.left
  book.querySelector('.book-page-right').scrollIntoView = scrolls.right
  return { book, nav, scrolls, layer: book.querySelector('.book-turn-layer') }
}
const setText = (book, side, text) => { book.querySelector(`.book-page-${side} p`).textContent = text }
const sheets = () => [...document.querySelectorAll('body > .m-sheet')]
const html = document.documentElement

let waapi = null
let scrollTo = null
beforeEach(() => { scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => {
  scrollTo.mockRestore()
  waapi?.restore()
  waapi = null
  document.body.innerHTML = ''
  html.classList.remove('is-turning')
  setMobileTurnBusy(false)
})

describe('mobileTurn — the visible slice', () => {
  // Step 15 — no sticky tab row any more: the tabs stand on the book's edge, so only the navbar bounds the slice.
  it('viewTop is the navbar bottom only (a tab row lower down is ignored)', () => {
    const { nav } = makeBook({ rowBottom: 104 })
    expect(viewTop()).toBe(56)
    nav.remove()
    expect(viewTop()).toBe(0)
  })

  it('visibleSlice cuts the book to the screen below the navbar; null when none of it shows', () => {
    const { book } = makeBook({ bookTop: -200, rowBottom: 104 })
    const slice = visibleSlice(book)
    expect(slice).toMatchObject({ left: 0, top: 56, width: 360, height: window.innerHeight - 56 })
    expect(slice.book.top).toBe(-200)
    // the book starts low on the screen: its own top bounds the slice
    book.getBoundingClientRect = () => rect(10, 300, 340, 200)
    book.querySelector('.book-bookmarks-row').getBoundingClientRect = () => rect(10, 300, 340, 0)
    expect(visibleSlice(book)).toMatchObject({ left: 10, top: 300, width: 340, height: 200 })
    // scrolled past the book / not laid out
    book.getBoundingClientRect = () => rect(0, -2000, 360, 1500)
    expect(visibleSlice(book)).toBeNull()
    book.getBoundingClientRect = () => rect(0, 0, 0, 0)
    expect(visibleSlice(book)).toBeNull()
    expect(visibleSlice(null)).toBeNull()
  })

  it('the sheet copies the whole book at its place in the slice: no id, test id, tooltip or iframe; hidden and inert', () => {
    const { book } = makeBook()
    const slice = visibleSlice(book)
    const { sheet } = sheetOf(book, slice)
    expect(sheet).toHaveClass('m-sheet')
    expect(sheet).toHaveAttribute('aria-hidden', 'true')
    expect(sheet.style.top).toBe('56px')
    const copy = sheet.firstChild
    expect(copy).toHaveClass('book-wrapper', 'm-sheet__book')
    expect(copy).toHaveAttribute('inert')
    expect(copy.style.top).toBe('-256px')
    expect(copy.style.width).toBe('360px')
    expect(copy.querySelector('[id], [data-testid], [data-tip], iframe')).toBeNull()
    expect(copy.querySelector('.turn-iframe-box')).not.toBeNull()
    expect(copy.querySelector('.book-turn-layer')).toBeEmptyDOMElement()
    expect(copy.textContent).toContain('old left')
    // the live book keeps everything
    expect(book.querySelector('#l')).toHaveAttribute('data-tip', 'tip')
    expect(book.querySelector('iframe')).not.toBeNull()
  })
})

describe('mobileTurn — the strategy', () => {
  it('wants every turn but a fade (FadeIn fades the phone previews); a fade takes no snapshot', () => {
    const { book } = makeBook()
    expect(mobileStrategy.mobile).toBe(true)
    expect(mobileStrategy.wants('forward')).toBe(true)
    expect(mobileStrategy.wants('hold')).toBe(true)
    expect(mobileStrategy.wants('fade')).toBe(false)
    expect(mobileStrategy.snapshot(book, 'fade')).toBeNull()
    expect(mobileStrategy.snapshot(null, 'forward')).toBeNull()
    expect(() => mobileStrategy.hold()).not.toThrow()
    expect(mobileStrategy.run({ snapshot: null })).toBeTruthy()
  })

  it('the snapshot locks the scroll (root class, touch blocker), marks the turn busy and puts the still sheet up', () => {
    const { book } = makeBook()
    book.querySelector('.book-page-left .page-inner').scrollTop = 30
    const shot = mobileStrategy.snapshot(book, 'hold')
    // a scrolled box of the book is copied once the sheet is on the page
    expect(shot.sheet.querySelector('.book-page-left .page-inner').scrollTop).toBe(30)
    expect(shot.mobile).toBe(true)
    expect(html).toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(true)
    expect(document.querySelector('body > .m-blocker')).not.toBeNull()
    expect(sheets()).toHaveLength(1)
    expect(sheets()[0].textContent).toContain('old left')
    shot.dispose()
    shot.dispose()
    expect(html).not.toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(false)
    expect(document.querySelector('.m-blocker, .m-sheet')).toBeNull()
  })

  it('the plain path (jsdom, no WAAPI): commit and jump at once, nothing left behind', async () => {
    const { book, layer } = makeBook()
    for (const direction of ['forward', 'back', 'fade']) {
      const shot = mobileStrategy.snapshot(book, direction === 'fade' ? 'hold' : direction)
      const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction, timings: TIMINGS })
      await handle.finished
      expect(document.querySelector('.m-sheet, .m-cast, .m-blocker')).toBeNull()
      expect(html).not.toHaveClass('is-turning')
    }
    expect(scrollTo).toHaveBeenCalledTimes(3) // forward, back and the fade release all land at the top
  })

  it('a book off the screen: no sheet, the jump still lands and the lock goes', () => {
    waapi = installWaapi()
    const { book, layer } = makeBook({ bookTop: 2000 })
    const shot = mobileStrategy.snapshot(book, 'forward')
    expect(shot.sheet).toBeNull()
    expect(sheets()).toHaveLength(0)
    mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(waapi.animations).toHaveLength(0)
    expect(html).not.toHaveClass('is-turning')
  })

  // Step 15 §9 — a play that did not move: the jump to the top happens under the held sheet, which then fades.
  it('a held sheet released with a fade: the jump to the top under it, then it fades out', async () => {
    waapi = installWaapi()
    const { book, layer } = makeBook()
    const shot = mobileStrategy.snapshot(book, 'hold')
    const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'fade', timings: TIMINGS })
    expect(waapi.animations[0].target).toBe(shot.sheet)
    expect(waapi.animations[0].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(waapi.animations[0].options.duration).toBe(200)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    waapi.finishAll()
    await handle.finished
    expect(sheets()).toHaveLength(0)
  })

})

/** A phone page with a dealt grid: `data-box` gives a layout box (jsdom has none), copies included. */
function makeGrid({ cards = 10 } = {}) {
  const made = makeBook()
  const { book } = made
  const grid = Array.from({ length: cards }, (_, i) =>
    `<div class="pg-card" data-box="${20 + (i % 2) * 170},${120 + Math.floor(i / 2) * 100},160,240">c${i}</div>`).join('')
  book.querySelector('.book-page-right').innerHTML = `
    <div class="page-inner">
      <div class="book-content">
        <h3 class="heading">Head</h3>
        <div class="selection-scroll"><div class="selection-list pg-dealt">${grid}
          <div class="pg-card" data-box="20,2000,160,240">below</div>
          <div class="pg-card is-discarded" data-box="20,120,160,240">fell</div>
          <div class="pg-card" data-deal="waiting" data-box="20,120,160,240">waits</div>
        </div></div>
      </div>
      <div class="book-content book-content--covered"><p>covered</p></div>
    </div>
    <div class="deck" data-box="280,600,54,81"></div>`
  const real = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function box() {
    const b = this.getAttribute?.('data-box')
    if (!b) return real.call(this)
    const [left, top, width, height] = b.split(',').map(Number)
    return rect(left, top, width, height)
  })
  return made
}

describe('mobileTurn — v1.15.0 shuffle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('deckGoal: the sticky page deck centre, clamped to the bottom-right corner; the corner when not shown or off screen', () => {
    const { book } = makeGrid()
    const { innerWidth: w, innerHeight: h } = window
    expect(deckGoal(book)).toEqual({ x: 307, y: 640.5, width: 54 })
    expect(deckGoal(null)).toEqual({ x: w - 50, y: h - 60, width: 54 })
    const deck = book.querySelector('.deck')
    deck.setAttribute('data-box', `${w - 10},${h - 20},54,81`)
    expect(deckGoal(book)).toEqual({ x: w - 40, y: h - 50, width: 54 })
    deck.setAttribute('data-box', '280,-200,54,81')
    expect(deckGoal(book)).toEqual({ x: w - 50, y: h - 60, width: 54 })
    deck.setAttribute('data-box', '0,0,0,0')
    expect(deckGoal(book).x).toBe(w - 50)
  })

  it('the parts: cards on screen (not fallen, played or waiting), what fades around them, the live boxes', () => {
    const { book } = makeGrid({ cards: 3 })
    const slice = visibleSlice(book)
    expect(leavingCards(book, slice).map(c => c.textContent)).toEqual(['c0', 'c1', 'c2'])
    const fading = fadingParts(book)
    expect(fading.map(el => el.className || el.tagName)).toEqual(['P', 'IMG', 'heading'])
    expect(fading.some(el => el.closest('.book-content--covered'))).toBe(false)
    expect(pageParts(book).map(el => el.className || el.tagName)).toEqual(['P', 'IMG', 'heading', 'selection-scroll'])
    expect(fadingParts(null)).toEqual([])
  })

  it('forward: jump under the copy, its cards spin into the deck staggered, the rest fades; the copy goes, the page fades in', async () => {
    waapi = installWaapi()
    const { book, layer } = makeGrid()
    const shot = mobileStrategy.snapshot(book, 'forward')
    expect(shot.goal).toEqual({ x: 307, y: 640.5, width: 54 })
    setText(book, 'left', 'new left')
    const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS,
      turnMode: 'full' })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    const inCopy = a => !!a.target.closest('.m-sheet')
    const gathers = waapi.animations.filter(a => inCopy(a) && a.target.classList.contains('pg-card'))
    expect(gathers.map(a => a.target.textContent)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'])
    expect(GATHER_MAX_STAGGER).toBe(8)
    expect(gathers.map(a => a.options.delay)).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 480, 480])
    expect(gathers[0].options).toMatchObject({ duration: 420, fill: 'forwards' })
    // c0's centre (100, 240) to the deck (307, 640.5): an in-plane spin, no 3D, shrinking, gone at the end
    const frames = gathers[0].keyframes
    expect(frames[1].transform).toContain('rotate(70deg) scale(0.85)')
    expect(frames[2].transform).toBe('translate(207px, 400.5px) rotate(240deg) scale(0.3)')
    expect(frames[3]).toEqual({ transform: 'translate(207px, 400.5px) rotate(260deg) scale(0.25)', opacity: 0 })
    expect(frames.some(f => f.transform.includes('rotateY'))).toBe(false)
    const fades = waapi.animations.filter(a => inCopy(a) && !a.target.classList.contains('pg-card'))
    expect(fades.map(a => a.target.className || a.target.tagName)).toEqual(['P', 'IMG', 'heading'])
    expect(fades[0]).toMatchObject({ keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: 200 } })
    // the new page fades in once the last card has left (8 × 60 + 420 ms), under nothing
    const arriving = waapi.animations.filter(a => !inCopy(a))
    expect(arriving.map(a => a.target.className || a.target.tagName)).toEqual(['P', 'IMG', 'heading', 'selection-scroll'])
    expect(arriving[0]).toMatchObject({ keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 200, delay: 900, fill: 'backwards' } })
    // the copy goes when the cards and parts are gone; the lock stays until the fade in ends
    ;[...gathers, ...fades].forEach(a => a.finish())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(sheets()).toHaveLength(0)
    expect(html).toHaveClass('is-turning')
    expect(document.querySelector('.m-blocker')).not.toBeNull()
    waapi.finishAll()
    await handle.finished
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
    expect(html).not.toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(false)
  })

  it('back spins the other way; simple turn mode shuffles too; finish() ends at once', async () => {
    waapi = installWaapi()
    const { book, layer } = makeGrid({ cards: 2 })
    const shot = mobileStrategy.snapshot(book, 'back')
    const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'back', timings: TIMINGS,
      turnMode: 'simple' })
    const gathers = waapi.animations.filter(a => a.target.closest('.m-sheet') && a.target.classList.contains('pg-card'))
    expect(gathers).toHaveLength(2)
    expect(gathers[0].keyframes[1].transform).toContain('rotate(-70deg)')
    expect(gathers[0].keyframes[2].transform).toContain('rotate(-240deg)')
    expect(layer.querySelector('.page-flipper')).toBeNull()
    // a card animation cancelled (gone with its element) lets the copy go at once
    gathers[0].cancel()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(sheets()).toHaveLength(0)
    handle.finish()
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
    expect(html).not.toHaveClass('is-turning')
  })

  it('a page with no cards and nothing to fade: the new page fades in at once', () => {
    waapi = installWaapi()
    const { book, layer } = makeBook()
    book.querySelectorAll('.page-inner').forEach(p => p.replaceChildren())
    const shot = mobileStrategy.snapshot(book, 'forward')
    mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    expect(waapi.animations).toHaveLength(0)
  })
})
