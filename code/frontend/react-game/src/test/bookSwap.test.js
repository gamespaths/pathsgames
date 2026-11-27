import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  REDIRECT_STATE, bookOf, routeTransition, coverText, coverFace, setCoverText, swapTotal, swapTimings, SWAP_PHASES,
  swapSlice, scrollTop, bookCopy, swapSnapshot, phaseRun, runSwap, turnSnapshot, runRouteTurn, openBook,
  OPEN_FRAMES, CLOSE_FRAMES, TABLESS, runOpening,
} from '../components/book/bookSwap'
import { BASE_TIMINGS, scaledTimings } from '../constants/animations'
import { mobileTurnBusy } from '../features/gameplay/js/mobileView'
import { installWaapi } from './fixtures/waapi'

// Step 15 (to-do 2) — the book change between routes: route table, cover, capped timings and the runs (WAAPI stubbed).

const T = (({ open, close, fade, flip, slide, sheet, zoom }) => ({ open, close, fade, flip, slide, sheet, zoom }))(BASE_TIMINGS)
const loc = (pathname, state = null) => ({ pathname, search: '', state, key: pathname })
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top })
const t = key => `t:${key}`

/** A book as Book renders it: a stage, a shell (with its pile), the cover with tabs, pages and a turn layer. */
function makeBook({ title = null, tabs = true, text = 'old', box = rect(100, 80, 1000, 600), scrolled = false,
  right = false } = {}) {
  const stage = document.createElement('div')
  stage.className = 'book-stage'
  stage.innerHTML = `
    <div class="book-shell">
      <div class="book-wrapper" ${title ? `data-cover-title="${title}"` : ''}>
        ${tabs ? `<div class="book-bookmarks-row"><div class="book-bookmarks book-bookmarks--left">
          <button id="tab" data-testid="tab" data-tip="Tab">T</button></div>${right
  ? '<div class="book-bookmarks book-bookmarks--right"><button>H</button></div>' : ''}</div>` : ''}
        <div class="book-page book-page-left"><div class="page-inner"><p data-testid="left">${text} left</p>
          <iframe title="x"></iframe></div></div>
        <div class="book-page book-page-right"><div class="page-inner"><p>${text} right</p></div></div>
        <div class="book-turn-layer"><div class="stale">stale</div></div>
      </div>
      <div class="deck-pile"></div>
    </div>`
  document.body.appendChild(stage)
  const wrapper = stage.querySelector('.book-wrapper')
  wrapper.getBoundingClientRect = () => box
  if (scrolled) Object.defineProperty(wrapper.querySelector('.page-inner'), 'scrollTop', { configurable: true, value: 40 })
  return { stage, wrapper }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
let waapi
async function step(times = 1) {
  for (let i = 0; i < times; i += 1) {
    waapi.finishAll()
    await settle()
  }
}
const last = () => waapi.animations.at(-1)

beforeEach(() => { waapi = installWaapi() })
afterEach(() => {
  waapi.restore()
  document.body.innerHTML = ''
  document.documentElement.classList.remove('is-turning')
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('bookOf / routeTransition — the route table', () => {
  it('bookOf: the Home book (Home 0, player 1), one story book per story (set-up 1, start 2, game 3), none elsewhere', () => {
    expect(bookOf('/')).toEqual({ book: 'home', id: null, rank: 0 })
    expect(bookOf('/player')).toEqual({ book: 'home', id: null, rank: 1 })
    expect(bookOf('/story/s1')).toEqual({ book: 'story', id: 's1', rank: 1 })
    expect(bookOf('/start-match/s1')).toEqual({ book: 'story', id: 's1', rank: 2 })
    expect(bookOf('/play/s1/')).toEqual({ book: 'story', id: 's1', rank: 3 })
    expect(bookOf('/nope')).toBeNull()
    expect(bookOf(undefined)).toBeNull()
  })

  it.each([
    ['/', '/story/s1', 'swap'], // story card, Tutorial
    ['/', '/play/s1', 'swap'], // Resume (owner)
    ['/', '/player', 'forward'], ['/player', '/', 'back'],
    ['/story/s1', '/', 'swap'], // home tab, brand, Back, story not found
    ['/story/s1', '/start-match/s1', 'forward'], ['/start-match/s1', '/play/s1', 'forward'],
    ['/start-match/s1', '/story/s1', 'back'], ['/play/s1', '/story/s1', 'back'],
    ['/start-match/s1', '/', 'swap'], ['/play/s1', '/', 'swap'], // home tab; Leave, Back to home, fatal error
    ['/story/s1', '/player', 'swap'], ['/player', '/play/s1', 'swap'], ['/start-match/s1', '/player', 'swap'],
    ['/story/a', '/story/b', 'swap'], ['/play/a', '/story/b', 'swap'],
  ])('%s → %s: %s', (from, to, expected) => {
    expect(routeTransition(loc(from), loc(to))).toBe(expected)
  })

  it('nothing for the same path (new state), redirects, paths with no book and a missing side', () => {
    expect(routeTransition(loc('/play/s1'), loc('/play/s1', { matchUuid: 'm' }))).toBeNull()
    expect(routeTransition(loc('/play/s1'), loc('/story/s1', REDIRECT_STATE))).toBeNull()
    expect(routeTransition(loc('/nope'), loc('/', REDIRECT_STATE))).toBeNull()
    expect(routeTransition(loc('/nope'), loc('/'))).toBeNull()
    expect(routeTransition(loc('/story/s1'), loc('/story/s1/'))).toBeNull()
    expect(routeTransition(null, loc('/'))).toBeNull()
    expect(routeTransition(loc('/'), undefined)).toBeNull()
  })
})

describe('coverText / coverFace', () => {
  it('the Home book: the brand and "Web gamebook"; a story: attribute, else router state, else the d20 alone', () => {
    expect(coverText({ pathname: '/player', attr: 'x', t })).toEqual({ title: 't:nav.brand', sub: 't:book.coverSub' })
    const state = { story: { title: 'From state' } }
    expect(coverText({ pathname: '/play/s1', attr: 'Attr', state, t })).toEqual({ title: 'Attr', sub: 't:nav.brand' })
    expect(coverText({ pathname: '/play/s1', state, t })).toEqual({ title: 'From state', sub: 't:nav.brand' })
    expect(coverText({ pathname: '/story/s1', state: { config: {} } })).toEqual({ title: null, sub: null })
    expect(coverText({ pathname: '/' })).toEqual({ title: 'nav.brand', sub: 'book.coverSub' })
  })

  it('the cover: tooled frame, the card back d20, title and subtitle as text; hidden and inert; text rewritten', () => {
    const face = coverFace({ title: '<b>Dune</b>', sub: 'Paths Games' }, 'flap-face')
    expect(face).toHaveClass('cover-face', 'flap-face')
    expect(face).toHaveAttribute('aria-hidden', 'true')
    expect(face).toHaveAttribute('inert')
    expect(face.querySelector('.cover-frame')).not.toBeNull()
    expect(face.querySelector('svg.cover-d20 path')).not.toBeNull()
    expect(face.querySelector('.cover-title').textContent).toBe('<b>Dune</b>')
    expect(face.querySelector('b')).toBeNull()
    expect(face.querySelector('.cover-sub')).toHaveTextContent('Paths Games')
    setCoverText(face, { title: 'Other' })
    expect(face.querySelectorAll('.cover-title')).toHaveLength(1)
    expect(face.querySelector('.cover-title')).toHaveTextContent('Other')
    expect(face.querySelector('.cover-sub').textContent).toBe('')
    setCoverText(face)
    expect(face.querySelector('.cover-title, .cover-sub')).toBeNull()
    expect(coverFace({ title: null }).querySelector('.cover-title')).toBeNull()
    expect(coverFace().className).toBe('cover-face')
  })
})

describe('swapTimings — at most VITE_ANIM_COVER_MAX_S', () => {
  // v1.15.0 — `zoom` (320 ms at 1×) twice in every full change; every mode fades the tabs out and in (`fade`, 200 ms).
  it('1×: desktop full 4.04 s, phone 3.48 s, simple 1.31 s (no zoom), unchanged under the 10 s cap', () => {
    expect(T.zoom).toBe(320)
    expect(swapTotal(T)).toBe(4040)
    expect(swapTotal(T, { layout: 'phone' })).toBe(3480)
    expect(swapTotal(T, { layout: 'phone', mode: 'simple' })).toBe(1310)
    expect(swapTimings(T, { maxMs: 10000 })).toEqual(T)
    expect(SWAP_PHASES).toEqual(['open', 'close', 'fade', 'flip', 'slide', 'sheet', 'zoom'])
  })

  it('¼×: desktop full 16.16 s capped to 10 s, every phase (zoom too) by the same factor (0.62)', () => {
    const quarter = scaledTimings(0.25)
    expect(swapTotal(quarter)).toBe(16160)
    const capped = swapTimings(quarter, { layout: 'desktop', mode: 'full', maxMs: 10000 })
    const k = 10000 / 16160
    expect(k).toBeCloseTo(0.62, 2)
    for (const key of SWAP_PHASES) expect(capped[key]).toBe(Math.round(quarter[key] * k))
    expect(capped).toMatchObject({ fade: 495, flip: 2228, zoom: 792, slide: 1485 })
    expect(2 * (capped.fade + capped.flip + capped.zoom + capped.slide)).toBeLessThanOrEqual(10000)
  })

  it('¼×: phone 13.92 s capped to 10 s; simple (5.24 s) stays under the cap; 0 = no limit', () => {
    const quarter = scaledTimings(0.25)
    const pick = o => Object.fromEntries(SWAP_PHASES.map(key => [key, o[key]]))
    expect(swapTotal(quarter, { layout: 'phone' })).toBe(13920)
    const phone = swapTimings(quarter, { layout: 'phone', maxMs: 10000 })
    for (const key of SWAP_PHASES) expect(phone[key]).toBe(Math.round(quarter[key] * 10000 / 13920))
    // each phase rounded to the ms: at most 4 ms over the cap
    expect(2 * (phone.fade + phone.sheet + phone.zoom + phone.slide)).toBeLessThanOrEqual(10004)
    expect(swapTimings(quarter, { mode: 'simple', maxMs: 10000 })).toEqual(pick(quarter))
    expect(swapTotal(quarter, { mode: 'simple' })).toBe(5240)
    expect(swapTimings(quarter, { maxMs: 0 })).toEqual(pick(quarter))
    expect(swapTimings(quarter)).toEqual(pick(quarter))
    expect(swapTimings(quarter, { maxMs: 4000 }).flip).toBe(Math.round(3600 * 4000 / 16160))
  })
})

describe('slices, copies, scroll', () => {
  it('swapSlice: the book cut to the screen under the navbar, its tab groups included; null when none shows', () => {
    const { wrapper } = makeBook({ box: rect(0, 100, 360, 2000) })
    wrapper.querySelector('.book-bookmarks--left').getBoundingClientRect = () => rect(42, 56, 300, 44)
    expect(swapSlice(wrapper)).toMatchObject({ left: 0, top: 56, width: 360, height: window.innerHeight - 56 })
    wrapper.querySelector('.book-bookmarks--left').getBoundingClientRect = () => rect(0, 0, 0, 0)
    expect(swapSlice(wrapper).top).toBe(100)
    wrapper.getBoundingClientRect = () => rect(0, -3000, 360, 100)
    expect(swapSlice(wrapper)).toBeNull()
    expect(swapSlice(null)).toBeNull()
  })

  it('scrollTop: the very top at once; a missing scrollTo is ignored', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    scrollTop()
    expect(spy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    spy.mockImplementation(() => { throw new Error('jsdom') })
    expect(() => scrollTop()).not.toThrow()
  })

  it('bookCopy: a shell box at the book place, a clean cover (no id, test id, tooltip, iframe), the turn layer empty, no pile', () => {
    const { wrapper } = makeBook({ title: 'Old' })
    const copy = bookCopy(wrapper)
    expect(copy.el).toHaveClass('book-shell', 'book-swap__book')
    expect(copy.el).toHaveAttribute('inert')
    expect(copy.el).toHaveAttribute('aria-hidden', 'true')
    expect(copy.el.style).toMatchObject({ left: '100px', top: '80px', width: '1000px', height: '600px' })
    expect(copy.book).toHaveAttribute('data-cover-title', 'Old')
    expect(copy.book.querySelector('[id], [data-testid], [data-tip], iframe')).toBeNull()
    expect(copy.book.querySelector('.turn-iframe-box')).not.toBeNull()
    expect(copy.book.querySelector('.book-turn-layer')).toBeEmptyDOMElement()
    expect(wrapper.querySelector('.book-turn-layer')).not.toBeEmptyDOMElement()
    expect(copy.el.querySelector('.deck-pile')).toBeNull()
  })
})

describe('phaseRun', () => {
  it('steps resolve true while running; end() cancels what runs, cleans up once and settles', async () => {
    const cleanup = vi.fn()
    const run = phaseRun(cleanup)
    const a = document.body.animate([], {})
    const stepping = run.step([a, null])
    a.finish()
    expect(await stepping).toBe(true)
    const b = document.body.animate([], {})
    const pending = run.step([b])
    run.end()
    run.finish()
    expect(b.cancel).toHaveBeenCalled()
    expect(await pending).toBe(false)
    expect(await run.step([])).toBe(false)
    expect(cleanup).toHaveBeenCalledOnce()
    await run.finished
  })

  it('an animation whose cancel throws is skipped', () => {
    const run = phaseRun(() => {})
    const broken = { finished: new Promise(() => {}), cancel: () => { throw new Error('gone') } }
    run.step([broken])
    expect(() => run.end()).not.toThrow()
  })
})

describe('runSwap — desktop full (concept swapBook)', () => {
  it('tabs out, the right half folds with the old title, shrinks, out left; in small with the new title, grows, opens, tabs in', async () => {
    const old = makeBook({ title: 'Old', box: rect(100, 80, 1000, 600), scrolled: true, right: true })
    const shot = swapSnapshot(old.wrapper, { phone: false, text: { title: 'Old', sub: 'Paths Games' } })
    expect(shot.copy.scrolls).toHaveLength(1)
    old.stage.remove()
    const next = makeBook({ title: 'New', text: 'new', box: rect(120, 16, 960, 700), right: true })
    const hide = vi.fn()
    const reveal = vi.fn()
    const hideTabs = vi.fn()
    const showTabs = vi.fn()
    const nextText = vi.fn(live => ({ title: live.getAttribute('data-cover-title'), sub: 'Paths Games' }))
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const handle = runSwap(shot, { timings: T, mode: 'full', liveBook: () => next.wrapper, nextText, hide, reveal,
      hideTabs, showTabs })
    expect(hideTabs).toHaveBeenCalledOnce()

    const layer = document.querySelector('body > .book-swap')
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(hide).toHaveBeenCalledOnce()
    expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    const oldCopy = layer.querySelector('.book-swap__book')
    expect(oldCopy.querySelector('[data-testid]')).toBeNull()
    // 1. tabs out: v1.15.0 every group, never the row (display: contents on tablets); then the layer hides later copies' tabs
    const out = waapi.running()
    expect(out.map(a => a.target)).toEqual([...oldCopy.querySelectorAll('.book-bookmarks-row > .book-bookmarks')])
    expect(out).toHaveLength(2)
    out.forEach(a => expect(a).toMatchObject({ keyframes: [{ opacity: 1 }, { opacity: 0 }],
      options: { duration: T.fade, fill: 'forwards' } }))
    expect(layer).not.toHaveClass(TABLESS)
    await step()
    expect(layer).toHaveClass(TABLESS)
    // 2. the right half folds over the spine, the cover with the old title on its back
    const flap = oldCopy.querySelector(':scope > .book-flap')
    expect(oldCopy.querySelector(':scope > .book-wrapper').style.clipPath).toBe('inset(-60px 50% -80px -60px)')
    expect(flap.querySelector('.flap-front > .flap-copy').style).toMatchObject({ left: '-500px', width: '1000px', clipPath: '' })
    expect(flap.querySelector('.flap-back.cover-face .cover-title')).toHaveTextContent('Old')
    const folding = waapi.running()
    expect(folding[0]).toMatchObject({ target: flap, options: { duration: T.flip, fill: 'forwards' } })
    expect(folding[0].keyframes).toEqual([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }])
    expect(folding).toHaveLength(3)
    await step()
    // 3. v1.15.0: the closed book shrinks where it is (around the spine: the shell's centre), then slides out left small
    expect(last()).toMatchObject({ target: oldCopy, options: { duration: T.zoom, easing: 'ease-in-out', fill: 'forwards' } })
    expect(last().keyframes).toEqual([{ transform: 'translateX(0px) scale(1)' }, { transform: 'translateX(0px) scale(0.62)' }])
    await step()
    expect(last()).toMatchObject({ target: oldCopy, options: { duration: T.slide } })
    expect(last().keyframes).toEqual([{ transform: 'translateX(0px) scale(0.62)' }, { transform: 'translateX(-680px) scale(0.62)' }])
    await step()
    // 4. the new one, closed with its title, slides in to its place
    expect(oldCopy.isConnected).toBe(false)
    const newCopy = layer.querySelector('.book-swap__book')
    expect(newCopy.style).toMatchObject({ left: '120px', top: '16px', width: '960px' })
    expect(newCopy.closest(`.${TABLESS}`)).toBe(layer)
    const newFlap = newCopy.querySelector('.book-flap')
    expect(newFlap.style.transform).toBe('rotateY(-180deg)')
    expect(newFlap.querySelector('.cover-title')).toHaveTextContent('New')
    expect(nextText).toHaveBeenCalledWith(next.wrapper)
    expect(last()).toMatchObject({ target: newCopy, options: { duration: T.slide } })
    expect(last().keyframes).toEqual([{ transform: `translateX(${window.innerWidth - 120 + 80}px) scale(0.62)` },
      { transform: 'translateX(0px) scale(0.62)' }])
    await step()
    // 5. it grows back to its size with a light overshoot
    expect(last()).toMatchObject({ target: newCopy, options: { duration: T.zoom, easing: 'cubic-bezier(.3,1.35,.6,1)' } })
    expect(last().keyframes).toEqual([{ transform: 'translateX(0px) scale(0.62)' }, { transform: 'translateX(0px) scale(1)' }])
    await step()
    // 6. the cover opens
    expect(waapi.running()[0].keyframes).toEqual([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }])
    expect(reveal).not.toHaveBeenCalled()
    await step()
    // 7. opened: the copy goes, the live book shows, its tab groups fade in; then the hiding class goes
    expect(newCopy.isConnected).toBe(false)
    expect(reveal).toHaveBeenCalledOnce()
    const fades = waapi.running()
    expect(fades.map(a => a.target)).toEqual([...next.wrapper.querySelectorAll('.book-bookmarks')])
    fades.forEach(a => expect(a).toMatchObject({ keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: T.fade, fill: 'forwards' } }))
    expect(showTabs).not.toHaveBeenCalled()
    await step()
    await handle.finished
    expect(document.querySelector('.book-swap')).toBeNull()
    expect(showTabs).toHaveBeenCalled()
    fades.forEach(a => expect(a.cancel).toHaveBeenCalled())
  })

  it('a book with no tabs skips the tab fades; with no live book after the slide out it just ends', async () => {
    const old = makeBook({ tabs: false })
    const shot = swapSnapshot(old.wrapper)
    expect(shot.text).toEqual({})
    const handle = runSwap(shot, { timings: T, liveBook: () => null, nextText: () => ({}) })
    await step()
    await step()
    await step()
    await step()
    await handle.finished
    expect(document.querySelector('.book-swap')).toBeNull()
  })

  it('finish() at any time removes every layer and shows the live book', () => {
    const old = makeBook()
    const reveal = vi.fn()
    const handle = runSwap(swapSnapshot(old.wrapper), { timings: T, liveBook: () => old.wrapper, nextText: () => ({}), reveal })
    handle.finish()
    expect(document.querySelector('.book-swap')).toBeNull()
    expect(reveal).toHaveBeenCalledOnce()
  })

  it('an error inside the run ends it (layers gone, book shown)', async () => {
    const old = makeBook()
    const reveal = vi.fn()
    const handle = runSwap(swapSnapshot(old.wrapper), { timings: T, reveal, nextText: () => ({}),
      liveBook: () => { throw new Error('boom') } })
    await step()
    await step()
    await step()
    await step()
    await handle.finished
    expect(reveal).toHaveBeenCalledOnce()
    expect(document.querySelector('.book-swap')).toBeNull()
  })
})

describe('runSwap — simple (both layouts)', () => {
  it('desktop: the copy closes (fade, tilt −8°, 0.92), then the live book opens with the former bookOpen', async () => {
    const old = makeBook()
    const shot = swapSnapshot(old.wrapper, { text: { title: 'Old' } })
    old.stage.remove()
    const next = makeBook({ text: 'new' })
    const reveal = vi.fn()
    const showTabs = vi.fn()
    const handle = runSwap(shot, { timings: T, mode: 'simple', liveBook: () => next.wrapper, nextText: () => ({}), reveal,
      showTabs })
    const copy = document.querySelector('.book-swap .book-swap__book')
    // v1.15.0 — tabs out before the close
    expect(last()).toMatchObject({ target: copy.querySelector('.book-bookmarks'), keyframes: [{ opacity: 1 }, { opacity: 0 }] })
    await step()
    expect(document.querySelector('.book-swap')).toHaveClass(TABLESS)
    expect(last()).toMatchObject({ target: copy, keyframes: CLOSE_FRAMES, options: { duration: T.close, fill: 'forwards' } })
    expect(CLOSE_FRAMES[1]).toEqual({ opacity: 0, transform: 'perspective(1200px) rotateX(-8deg) scale(0.92)' })
    await step()
    expect(copy.isConnected).toBe(false)
    expect(reveal).toHaveBeenCalled()
    expect(last()).toMatchObject({ target: next.wrapper, keyframes: OPEN_FRAMES, options: { duration: T.open } })
    await step()
    expect(last()).toMatchObject({ target: next.wrapper.querySelector('.book-bookmarks'),
      keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: T.fade } })
    expect(showTabs).not.toHaveBeenCalled()
    await step()
    await handle.finished
    expect(showTabs).toHaveBeenCalled()
    expect(document.querySelector('.book-swap')).toBeNull()
  })

  it('phones: the slice copy closes, the page jumps to the top, the live book opens; the scroll lock goes', async () => {
    const old = makeBook({ box: rect(0, 60, 360, 1500) })
    const shot = swapSnapshot(old.wrapper, { phone: true, text: {} })
    expect(document.documentElement).toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(true)
    expect(document.querySelector('body > .m-blocker')).not.toBeNull()
    const sheet = document.querySelector('body > .m-sheet.m-sheet--tabs')
    expect(sheet.querySelector('.book-wrapper.m-sheet__book')).not.toBeNull()
    old.stage.remove()
    const next = makeBook({ text: 'new' })
    const handle = runSwap(shot, { timings: T, mode: 'simple', liveBook: () => next.wrapper, nextText: () => ({}) })
    expect(document.querySelector('.book-swap')).toBeNull()
    expect(last()).toMatchObject({ target: sheet.querySelector('.m-sheet__book > .book-bookmarks-row > .book-bookmarks'),
      keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: T.fade } })
    await step()
    expect(sheet).toHaveClass(TABLESS)
    expect(last()).toMatchObject({ target: sheet, keyframes: CLOSE_FRAMES })
    await step()
    expect(last()).toMatchObject({ target: next.wrapper, keyframes: OPEN_FRAMES })
    await step()
    expect(last()).toMatchObject({ target: next.wrapper.querySelector('.book-bookmarks'), keyframes: [{ opacity: 0 }, { opacity: 1 }] })
    await step()
    await handle.finished
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
    expect(document.documentElement).not.toHaveClass('is-turning')
    expect(mobileTurnBusy()).toBe(false)
  })

  it('phones with nothing to copy (the book off screen) and no live book: it just ends', async () => {
    const old = makeBook({ box: rect(0, -5000, 360, 100) })
    const shot = swapSnapshot(old.wrapper, { phone: true })
    expect(shot.sheet).toBeNull()
    const handle = runSwap(shot, { timings: T, mode: 'simple', liveBook: () => null, nextText: () => ({}) })
    await step()
    await handle.finished
    expect(document.querySelector('.m-blocker')).toBeNull()
  })
})

describe('runSwap — phones (concept mobileSwap)', () => {
  it('a cover closes over the slice (tabs included), shrinks, slides out, the title changes, slides in, grows and opens', async () => {
    const old = makeBook({ box: rect(0, 100, 360, 1500) })
    old.wrapper.querySelector('.book-bookmarks--left').getBoundingClientRect = () => rect(42, 56, 300, 44)
    const shot = swapSnapshot(old.wrapper, { phone: true, text: { title: 'Old', sub: 'Paths Games' } })
    expect(shot.slice).toMatchObject({ top: 56 })
    old.stage.remove()
    const next = makeBook({ text: 'new', box: rect(0, 46, 300, 900) })
    const reveal = vi.fn()
    const handle = runSwap(shot, { timings: T, liveBook: () => next.wrapper, reveal,
      nextText: () => ({ title: 'New', sub: 'Paths Games' }) })
    // v1.15.0 — the slice's tabs fade out before the cover closes over it
    expect(document.querySelector('body > .m-cover')).toBeNull()
    expect(last()).toMatchObject({ target: shot.sheet.querySelector('.book-bookmarks'), keyframes: [{ opacity: 1 }, { opacity: 0 }] })
    await step()
    expect(shot.sheet).toHaveClass(TABLESS)
    const cover = document.querySelector('body > .m-sheet.m-cover.cover-face')
    expect(cover.style.top).toBe('56px')
    expect(cover.querySelector('.cover-title')).toHaveTextContent('Old')
    const closing = waapi.running()
    expect(closing[0]).toMatchObject({ target: cover, options: { duration: T.sheet } })
    expect(closing[0].keyframes).toEqual([{ transform: 'perspective(1400px) rotateY(-90deg)' },
      { transform: 'perspective(1400px) rotateY(0deg)' }])
    await step()
    expect(document.querySelector('.m-sheet--tabs')).toBeNull()
    // v1.15.0: the hinge is the left edge, so the scale is re-centred by (1 − 0.62) × 360 / 2 = 68.4px
    expect(last()).toMatchObject({ target: cover, options: { duration: T.zoom, easing: 'ease-in-out' } })
    expect(last().keyframes.map(k => k.transform)).toEqual([
      'perspective(1400px) translateX(calc(0px + 0px)) scale(1) rotateY(0deg)',
      'perspective(1400px) translateX(calc(0px + 68.4px)) scale(0.62) rotateY(0deg)'])
    await step()
    expect(last()).toMatchObject({ target: cover, options: { duration: T.slide } })
    expect(last().keyframes[1].transform).toBe('perspective(1400px) translateX(calc(-110vw + 68.4px)) scale(0.62) rotateY(0deg)')
    await step()
    expect(cover.querySelector('.cover-title')).toHaveTextContent('New')
    expect(cover.style.top).toBe('46px')
    // the next slice is 300px wide: (1 − 0.62) × 300 / 2 = 57px
    expect(last().keyframes[0].transform).toBe('perspective(1400px) translateX(calc(110vw + 57px)) scale(0.62) rotateY(0deg)')
    await step()
    expect(last()).toMatchObject({ target: cover, options: { duration: T.zoom, easing: 'cubic-bezier(.3,1.35,.6,1)' } })
    expect(last().keyframes[1].transform).toBe('perspective(1400px) translateX(calc(0px + 0px)) scale(1) rotateY(0deg)')
    expect(reveal).not.toHaveBeenCalled()
    await step()
    expect(reveal).toHaveBeenCalledOnce()
    expect(waapi.running()[0].keyframes[1].transform).toContain('rotateY(-90deg)')
    await step()
    expect(last()).toMatchObject({ target: next.wrapper.querySelector('.book-bookmarks'), keyframes: [{ opacity: 0 }, { opacity: 1 }] })
    expect(document.querySelector('.m-cover')).not.toBeNull()
    await step()
    await handle.finished
    expect(document.querySelector('.m-cover, .m-blocker')).toBeNull()
    expect(document.documentElement).not.toHaveClass('is-turning')
  })

  it('no slice (the book off screen): no cover, it just ends; a lost live book keeps the cover where it was', async () => {
    const off = makeBook({ box: rect(0, -5000, 360, 100) })
    const handle = runSwap(swapSnapshot(off.wrapper, { phone: true }), { timings: T, liveBook: () => null,
      nextText: () => ({}) })
    await handle.finished
    expect(document.querySelector('.m-cover')).toBeNull()

    const old = makeBook({ box: rect(0, 100, 360, 900) })
    const run = runSwap(swapSnapshot(old.wrapper, { phone: true }), { timings: T, liveBook: () => null,
      nextText: () => ({}) })
    await step(4)
    expect(document.querySelector('.m-cover').style.top).toBe('100px')
    await step(4)
    await run.finished
  })
})

describe('turnSnapshot / runRouteTurn — a page of the same book', () => {
  it('desktop full: the step 15 sheet in a fixed layer on the new book, gone at the end', async () => {
    const old = makeBook()
    const shot = turnSnapshot(old.wrapper, { direction: 'forward', turnMode: 'full' })
    expect(shot).toMatchObject({ direction: 'forward', phone: false })
    old.stage.remove()
    const next = makeBook({ text: 'new', box: rect(120, 16, 960, 700) })
    const handle = runRouteTurn(shot, { liveBook: () => next.wrapper, timings: { flip: 900 }, turnMode: 'full' })
    const layer = document.querySelector('body > .book-swap > .book-turn-layer')
    expect(layer.style).toMatchObject({ left: '120px', top: '16px', width: '960px', height: '700px' })
    expect(layer.querySelector('.page-flipper.is-fwd .flip-front')).toHaveTextContent('old right')
    expect(layer.querySelector('.page-flipper.is-fwd .flip-back')).toHaveTextContent('new left')
    await step()
    await handle.finished
    expect(document.querySelector('.book-swap')).toBeNull()
  })

  it('desktop simple swings the live pages; finish() drops the layer at once', () => {
    const old = makeBook()
    const shot = turnSnapshot(old.wrapper, { direction: 'back', turnMode: 'simple' })
    old.stage.remove()
    const next = makeBook({ text: 'new' })
    const handle = runRouteTurn(shot, { liveBook: () => next.wrapper, timings: { simple: 520 }, turnMode: 'simple' })
    expect(last().keyframes[0].transform).toContain('rotateY(35deg)')
    handle.finish()
    expect(document.querySelector('.book-swap')).toBeNull()
  })

  it('phones: the mobile strategy (sheet on <body>), no fixed layer', async () => {
    const old = makeBook({ box: rect(0, 60, 360, 900) })
    const shot = turnSnapshot(old.wrapper, { direction: 'back', turnMode: 'full', phone: true })
    expect(document.querySelector('body > .m-sheet')).not.toBeNull()
    old.stage.remove()
    const next = makeBook({ text: 'new', box: rect(0, 60, 360, 900) })
    const handle = runRouteTurn(shot, { liveBook: () => next.wrapper, timings: { sheet: 620 }, turnMode: 'full' })
    expect(document.querySelector('.book-swap')).toBeNull()
    await step()
    await handle.finished
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
  })

  it('no pages to copy: null; no live book after the commit: nothing runs, the phone sheet is disposed', () => {
    const empty = document.createElement('div')
    expect(turnSnapshot(empty, { direction: 'forward', turnMode: 'full' })).toBeNull()
    const old = makeBook({ box: rect(0, 60, 360, 900) })
    const shot = turnSnapshot(old.wrapper, { direction: 'forward', turnMode: 'full', phone: true })
    const handle = runRouteTurn(shot, { liveBook: () => null, timings: {}, turnMode: 'full' })
    expect(document.querySelector('.m-sheet, .m-blocker')).toBeNull()
    expect(() => handle.finish()).not.toThrow()
    const desk = makeBook()
    expect(() => runRouteTurn(turnSnapshot(desk.wrapper, { direction: 'forward', turnMode: 'full' }),
      { liveBook: () => null })).not.toThrow()
  })

  it('openBook: the former bookOpen keyframes on WAAPI, eased', () => {
    const { wrapper } = makeBook()
    openBook(wrapper, 2600)
    expect(last()).toMatchObject({ target: wrapper, keyframes: OPEN_FRAMES,
      options: { duration: 2600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } })
    expect(OPEN_FRAMES[0]).toEqual({ opacity: 0, transform: 'perspective(1200px) rotateX(20deg) scale(0.85)' })
  })
})

describe('runSwap — finish() during any phase stops the run there', () => {
  const cases = [
    ['desktop full', false, 'full', 8],
    ['desktop simple', false, 'simple', 4],
    ['phone cover', true, 'full', 8],
    ['phone simple', true, 'simple', 4],
  ]
  it.each(cases)('%s: each phase', async (name, phone, mode, phases) => {
    for (let at = 0; at < phases; at += 1) {
      document.body.innerHTML = ''
      const old = makeBook({ box: rect(0, 100, 360, 900), scrolled: true })
      const shot = swapSnapshot(old.wrapper, { phone, text: { title: 'Old' } })
      const next = makeBook({ text: 'new', box: rect(0, 100, 360, 900) })
      const reveal = vi.fn()
      const showTabs = vi.fn()
      const handle = runSwap(shot, { timings: T, mode, liveBook: () => next.wrapper, nextText: () => ({ title: 'New' }), reveal,
        showTabs })
      for (let i = 0; i < at; i += 1) await step()
      handle.finish()
      await settle()
      await handle.finished
      // shown at the end in any case (the simple and phone runs show it once more before the opening), tabs too
      expect(reveal).toHaveBeenCalled()
      expect(showTabs).toHaveBeenCalled()
      expect(document.querySelector('.book-swap, .m-sheet, .m-blocker')).toBeNull()
      expect(document.documentElement).not.toHaveClass('is-turning')
    }
  })
})

describe('runOpening — the first-load opening (v1.15.0: tabs after it)', () => {
  it('tabs hidden, the book opens (timings.open), then its groups fade in (timings.fade); the class goes, fades dropped', async () => {
    const { wrapper } = makeBook({ right: true })
    const hideTabs = vi.fn()
    const showTabs = vi.fn()
    const handle = runOpening({ timings: T, liveBook: () => wrapper, hideTabs, showTabs })
    expect(hideTabs).toHaveBeenCalledOnce()
    expect(last()).toMatchObject({ target: wrapper, keyframes: OPEN_FRAMES, options: { duration: T.open } })
    await step()
    const fades = waapi.running()
    expect(fades.map(a => a.target)).toEqual([...wrapper.querySelectorAll('.book-bookmarks')])
    fades.forEach(a => expect(a).toMatchObject({ keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: T.fade, fill: 'forwards' } }))
    expect(showTabs).not.toHaveBeenCalled()
    await step()
    await handle.finished
    expect(showTabs).toHaveBeenCalled()
    fades.forEach(a => expect(a.cancel).toHaveBeenCalled())
  })

  it('finish() while it opens or while the tabs fade in: tabs shown at once; a missing book just ends', async () => {
    const { wrapper } = makeBook({ tabs: false })
    const showTabs = vi.fn()
    const opening = runOpening({ timings: T, liveBook: () => wrapper, showTabs })
    opening.finish()
    await opening.finished
    expect(showTabs).toHaveBeenCalledOnce()
    const tabbed = makeBook()
    const fading = runOpening({ timings: T, liveBook: () => tabbed.wrapper, showTabs })
    await step()
    const fade = last()
    fading.finish()
    await fading.finished
    expect(fade.cancel).toHaveBeenCalled()
    expect(showTabs).toHaveBeenCalledTimes(2)
    const lost = runOpening({ timings: T, liveBook: () => null })
    await lost.finished
  })

  it('a book with no tabs opens and ends with no fade', async () => {
    const { wrapper } = makeBook({ tabs: false })
    const showTabs = vi.fn()
    const handle = runOpening({ timings: T, liveBook: () => wrapper, showTabs })
    await step()
    await handle.finished
    expect(waapi.animations).toHaveLength(1)
    expect(showTabs).toHaveBeenCalled()
  })
})
