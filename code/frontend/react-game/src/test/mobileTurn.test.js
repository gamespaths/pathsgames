import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  viewTop, visibleSlice, sheetOf, mobileStrategy,
} from '../components/book/mobileTurn'
import { mobileTurnBusy, setMobileTurnBusy } from '../features/gameplay/js/mobileView'
import { installWaapi } from './fixtures/waapi'

// Step 16 — the phone turn: the visible slice of the book on a fixed sheet, the jump under it (WAAPI stubbed).

const TIMINGS = { sheet: 620, simple: 520, fade: 200 }
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

  it('forward: jumps under the old sheet, which turns away on its left edge over a cast shadow, then all leaves', async () => {
    waapi = installWaapi()
    const { book, scrolls, layer } = makeBook()
    const shot = mobileStrategy.snapshot(book, 'forward')
    setText(book, 'left', 'new left')
    const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    // step 15: every page change lands at the very top of the document, tabs in view
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(scrolls.book).not.toHaveBeenCalled()
    expect(scrolls.right).not.toHaveBeenCalled()
    const cast = document.querySelector('body > .m-cast')
    expect(cast.nextElementSibling).toBe(shot.sheet)
    const [turn, shade, shadow] = waapi.animations
    expect(turn.target).toBe(shot.sheet)
    expect(turn.keyframes.map(k => k.transform)).toEqual(['perspective(1400px) rotateY(0deg)', 'perspective(1400px) rotateY(-90deg)'])
    expect(turn.options.duration).toBe(620)
    expect(shade.target).toHaveClass('flip-shade')
    expect(shade.keyframes).toEqual([{ opacity: 0 }, { opacity: 0.6 }])
    expect(shadow.target).toBe(cast)
    expect(shadow.keyframes).toEqual([{ opacity: 0.55 }, { opacity: 0 }])
    expect(html).toHaveClass('is-turning')
    waapi.finishAll()
    await handle.finished
    expect(document.querySelector('.m-sheet, .m-cast, .m-blocker')).toBeNull()
    expect(html).not.toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(false)
  })

  it('back: the old sheet stays still, a copy of the new slice turns in over it (−90deg → 0), then all leaves', async () => {
    waapi = installWaapi()
    const { book, scrolls, layer } = makeBook()
    const shot = mobileStrategy.snapshot(book, 'back')
    setText(book, 'right', 'new right')
    const handle = mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'back', timings: TIMINGS })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(scrolls.right).not.toHaveBeenCalled()
    expect(sheets()).toHaveLength(2)
    expect(sheets()[0].textContent).toContain('old right')
    expect(sheets()[1].textContent).toContain('new right')
    const [turn, shade, shadow] = waapi.animations
    expect(turn.target).toBe(sheets()[1])
    expect(turn.keyframes.map(k => k.transform)).toEqual(['perspective(1400px) rotateY(-90deg)', 'perspective(1400px) rotateY(0deg)'])
    expect(shade.keyframes).toEqual([{ opacity: 0.6 }, { opacity: 0 }])
    expect(shadow.keyframes).toEqual([{ opacity: 0 }, { opacity: 0.55 }])
    handle.finish()
    expect(document.querySelector('.m-sheet, .m-cast, .m-blocker')).toBeNull()
    expect(html).not.toHaveClass('is-turning')
  })

  it('back with the book gone from the screen after the jump: no new copy, all leaves at once', () => {
    waapi = installWaapi()
    const { book, layer } = makeBook()
    const shot = mobileStrategy.snapshot(book, 'back')
    book.getBoundingClientRect = () => rect(0, 2000, 360, 100)
    mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'back', timings: TIMINGS })
    expect(waapi.animations).toHaveLength(0)
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
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

  it('simple turn mode: the same jump, the sheet leaves, the live pages swing in as step 15\'s simple turn', () => {
    waapi = installWaapi()
    const { book, layer } = makeBook()
    const shot = mobileStrategy.snapshot(book, 'forward')
    mobileStrategy.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS, turnMode: 'simple' })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(sheets()).toHaveLength(0)
    expect(layer).toBeEmptyDOMElement()
    expect(waapi.animations.map(a => a.target.className)).toEqual(['page-inner', 'page-inner'])
    expect(waapi.animations[1].keyframes[0].transform).toContain('rotateY(-35deg)')
  })
})
