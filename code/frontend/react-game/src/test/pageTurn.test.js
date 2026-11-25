import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canAnimate, turnsActive, cleanClone, place, snapshotPages, holdPages, STRATEGIES, pickStrategy,
} from '../components/book/pageTurn'
import { mobileStrategy } from '../components/book/mobileTurn'
import { installWaapi, setBox } from './fixtures/waapi'

// Step 15 — the page turn strategies: clones of the old pages turned over the new ones (WAAPI stubbed).

const TIMINGS = { flip: 900, simple: 520, fade: 200 }

/** A book like BookPages renders it: wrapper > left page, right page, layer. */
function makeBook({ left = 'old left', right = 'old right' } = {}) {
  const book = document.createElement('div')
  book.className = 'book-wrapper'
  book.innerHTML = `
    <div class="book-page book-page-left"><div class="page-inner"><p id="l" data-testid="left-text" data-tip="tip">${left}</p></div></div>
    <div class="book-page book-page-right"><div class="page-inner"><p data-testid="right-text">${right}</p></div></div>
    <div class="book-turn-layer"></div>`
  document.body.appendChild(book)
  setBox(book.querySelector('.book-page-left'), { left: 12, top: 12, width: 400, height: 500 })
  setBox(book.querySelector('.book-page-right'), { left: 412, top: 12, width: 400, height: 500 })
  return { book, layer: book.querySelector('.book-turn-layer') }
}
const setText = (book, side, text) => { book.querySelector(`.book-page-${side} p`).textContent = text }

let waapi = null
afterEach(() => {
  waapi?.restore()
  waapi = null
  document.body.innerHTML = ''
  delete window.matchMedia
})

describe('pageTurn — capability and choice', () => {
  it('canAnimate follows Element.prototype.animate (jsdom has none)', () => {
    expect(canAnimate()).toBe(false)
    expect(canAnimate(null)).toBe(false)
    waapi = installWaapi()
    expect(canAnimate()).toBe(true)
    expect(canAnimate(document.createElement('div'))).toBe(true)
  })

  it('turnsActive needs the turn flag, no reduced motion and WAAPI (step 16: phones turn too)', () => {
    expect(turnsActive({ turn: true })).toBe(false) // no WAAPI
    waapi = installWaapi()
    expect(turnsActive({ turn: true, reduced: false })).toBe(true)
    expect(turnsActive({ turn: false })).toBe(false)
    expect(turnsActive({ turn: true, reduced: true })).toBe(false)
    expect(turnsActive(null)).toBe(false)
    window.matchMedia = vi.fn(() => ({ matches: true }))
    expect(turnsActive({ turn: true })).toBe(true)
  })

  it('pickStrategy: fade for a fade, the turn mode otherwise, only mobile (step 16, mobileTurn.js) on phones', () => {
    expect(pickStrategy({ direction: 'fade', turnMode: 'full', mobile: false })).toBe(STRATEGIES.fade)
    expect(pickStrategy({ direction: 'forward', turnMode: 'full', mobile: false })).toBe(STRATEGIES.full)
    expect(pickStrategy({ direction: 'back', turnMode: 'simple', mobile: false })).toBe(STRATEGIES.simple)
    expect(pickStrategy({ direction: 'forward', turnMode: 'full', mobile: true })).toBe(mobileStrategy)
    expect(pickStrategy({ direction: 'fade', turnMode: 'simple', mobile: true })).toBe(mobileStrategy)
    expect(STRATEGIES.mobile).toBe(mobileStrategy)
    window.matchMedia = vi.fn(() => ({ matches: false }))
    expect(pickStrategy({ direction: 'forward' })).toBe(STRATEGIES.full)
  })
})

describe('pageTurn — clone hygiene', () => {
  it('strips id, data-testid and data-tip, makes the copy inert and hidden, keeps the original', () => {
    const { book } = makeBook()
    const page = book.querySelector('.book-page-left')
    page.setAttribute('data-testid', 'page')
    const { node } = cleanClone(page)
    expect(node.getAttribute('data-testid')).toBeNull()
    expect(node.querySelector('[id], [data-testid], [data-tip]')).toBeNull()
    expect(node.hasAttribute('inert')).toBe(true)
    expect(node.getAttribute('aria-hidden')).toBe('true')
    expect(node.textContent).toContain('old left')
    expect(page.querySelector('#l')).toHaveAttribute('data-tip', 'tip')
  })

  it('replaces iframes (Turnstile, Google) with empty boxes of the same size', () => {
    const host = document.createElement('div')
    host.innerHTML = '<div><iframe src="about:blank"></iframe><span>x</span></div>'
    setBox(host.querySelector('iframe'), { width: 300, height: 65 })
    const { node } = cleanClone(host)
    expect(node.querySelector('iframe')).toBeNull()
    const box = node.querySelector('.turn-iframe-box')
    expect(box.style.width).toBe('300px')
    expect(box.style.height).toBe('65px')
    expect(node.textContent).toBe('x')
  })

  it('copies the scroll position of scrolled descendants once placed', () => {
    const { book, layer } = makeBook()
    const inner = book.querySelector('.book-page-left .page-inner')
    inner.scrollTop = 40
    const shot = snapshotPages(book)
    expect(shot.left.scrolls).toHaveLength(1)
    place(layer, shot.left)
    expect(shot.left.node.parentNode).toBe(layer)
    expect(shot.left.node.querySelector('.page-inner').scrollTop).toBe(40)
    expect(shot.left.node.style.left).toBe('12px')
    expect(shot.left.node.style.width).toBe('400px')
    place(layer, shot.left) // already there: no second copy
    expect(layer.children).toHaveLength(1)
  })

  it('snapshotPages is null for a book without its two pages', () => {
    expect(snapshotPages(null)).toBeNull()
    expect(snapshotPages(document.createElement('div'))).toBeNull()
  })

  it('holdPages shows both old pages still over the new ones', () => {
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    holdPages(layer, shot)
    expect(layer.children).toHaveLength(2)
    expect(layer.textContent).toContain('old left')
    expect(layer.textContent).toContain('old right')
  })
})

describe('pageTurn — strategies', () => {
  beforeEach(() => { waapi = installWaapi() })

  it('full forward: old left held, the old right page turns over the spine showing the new left on its back', async () => {
    const { book, layer } = makeBook()
    const shot = STRATEGIES.full.snapshot(book)
    setText(book, 'left', 'new left')
    setText(book, 'right', 'new right')
    const handle = STRATEGIES.full.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })

    const flipper = layer.querySelector('.page-flipper')
    expect(flipper).toHaveClass('is-fwd')
    expect(flipper.style.left).toBe('412px')
    expect(flipper.querySelector('.flip-front').textContent).toContain('old right')
    expect(flipper.querySelector('.flip-back').textContent).toContain('new left')
    expect(layer.querySelector(':scope > .book-page-left').textContent).toContain('old left')
    expect(layer.querySelector('.turn-shadow.from-left')).not.toBeNull()
    expect(layer.querySelectorAll('.flip-shade')).toHaveLength(2)
    const turn = waapi.animations.find(a => a.target === flipper)
    expect(turn.keyframes[1].transform).toBe('rotateY(-180deg)')
    expect(turn.options.duration).toBe(900)

    waapi.finishAll()
    await handle.finished
    expect(layer.children).toHaveLength(0)
  })

  it('full back: the old right held, the old left page turns to the right showing the new right', async () => {
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    setText(book, 'right', 'new right')
    const handle = STRATEGIES.full.run({ snapshot: shot, bookEl: book, layer, direction: 'back', timings: TIMINGS })
    const flipper = layer.querySelector('.page-flipper')
    expect(flipper).toHaveClass('is-back')
    expect(flipper.style.left).toBe('12px')
    expect(flipper.querySelector('.flip-front').textContent).toContain('old left')
    expect(flipper.querySelector('.flip-back').textContent).toContain('new right')
    expect(layer.querySelector('.turn-shadow.from-right')).not.toBeNull()
    expect(waapi.animations.find(a => a.target === flipper).keyframes[1].transform).toBe('rotateY(180deg)')
    handle.finish()
    await handle.finished
    expect(layer.children).toHaveLength(0)
  })

  it('full after a hold: the held copies are reused (no third copy) and turned', () => {
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    holdPages(layer, shot)
    STRATEGIES.full.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    expect(layer.querySelectorAll(':scope > .book-page')).toHaveLength(1)
    expect(layer.querySelector('.flip-front').style.left).toBe('')
  })

  it('simple: no copies, the live pages swing in (fade on the left, enter on the right)', async () => {
    const { book, layer } = makeBook()
    layer.appendChild(document.createElement('div'))
    const forward = STRATEGIES.simple.run({ snapshot: null, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    expect(layer.children).toHaveLength(0)
    const [left, right] = waapi.animations
    expect(left.target).toBe(book.querySelector('.book-page-left .page-inner'))
    expect(left.keyframes[0].filter).toBe('blur(3px)')
    expect(right.keyframes[0].transform).toContain('rotateY(-35deg)')
    expect(right.keyframes[0].transformOrigin).toBe('left center')
    expect(right.options.duration).toBe(520)
    waapi.finishAll()
    await forward.finished
    STRATEGIES.simple.run({ snapshot: null, bookEl: book, layer, direction: 'back', timings: TIMINGS })
    expect(waapi.animations.at(-1).keyframes[0].transform).toContain('rotateY(35deg)')
    expect(waapi.animations.at(-1).keyframes[0].transformOrigin).toBe('right center')
  })

  it('fade: both old copies fade out over the live pages, then leave', async () => {
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    const handle = STRATEGIES.fade.run({ snapshot: shot, bookEl: book, layer, direction: 'fade', timings: TIMINGS })
    expect(layer.children).toHaveLength(2)
    expect(waapi.animations).toHaveLength(2)
    expect(waapi.animations[0].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(waapi.animations[0].options.duration).toBe(200)
    waapi.finishAll()
    await handle.finished
    expect(layer.children).toHaveLength(0)
  })

  it('overlap: finish() ends a running turn at once (also when an animation refuses to finish)', () => {
    const { book, layer } = makeBook()
    const handle = STRATEGIES.fade.run({ snapshot: snapshotPages(book), bookEl: book, layer, direction: 'fade', timings: TIMINGS })
    waapi.animations[0].finish.mockImplementation(() => { throw new Error('infinite') })
    handle.finish()
    expect(waapi.animations[0].cancel).toHaveBeenCalled()
    expect(waapi.animations[1].finish).toHaveBeenCalled()
    expect(layer.children).toHaveLength(0)
    handle.finish() // twice: harmless
  })

  it('a cancelled animation still cleans the layer', async () => {
    const { book, layer } = makeBook()
    const handle = STRATEGIES.fade.run({ snapshot: snapshotPages(book), bookEl: book, layer, direction: 'fade', timings: TIMINGS })
    waapi.animations[0].cancel()
    await handle.finished
    expect(layer.children).toHaveLength(0)
  })
})

describe('pageTurn — the plain path (no WAAPI, or no page)', () => {
  it('every strategy cleans up at once and resolves', async () => {
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    holdPages(layer, shot)
    for (const name of ['full', 'fade', 'simple']) {
      const handle = STRATEGIES[name].run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
      await handle.finished
      handle.finish()
      expect(layer.children).toHaveLength(0)
    }
  })

  it('full with no page to uncover takes the plain path even with WAAPI', async () => {
    waapi = installWaapi()
    const { book, layer } = makeBook()
    const shot = snapshotPages(book)
    book.querySelector('.book-page-left').remove()
    const handle = STRATEGIES.full.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS })
    await handle.finished
    expect(waapi.animations).toHaveLength(0)
    expect(STRATEGIES.simple.run({ snapshot: shot, bookEl: book, layer, direction: 'forward', timings: TIMINGS }).finished)
      .toBeInstanceOf(Promise)
  })
})
