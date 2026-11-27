import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))

import Card, { playClassOf } from '../components/layout/Card'
import { AnimationProvider } from '../context/AnimationContext'
import {
  PlayProvider, usePlayController, usePlay, usePlayState, flightTarget, FALL_MAX_STAGGER, PILE_CARD_W,
} from '../features/gameplay/play/PlayContext'
import { installWaapi, setBox } from './fixtures/waapi'

// Step 15 — the play: lift and glow, the other small cards dim then fall, a fixed clone flies into the story.

const SPEED_1 = { VITE_ANIM_SPEED: '1' } // lift 240, fly 560, discard 320, discardStep 50
const ref = { api: null, state: null, played: null }

function Probe() {
  ref.api = usePlay()
  ref.state = usePlayState()
  return null
}

function Board({ onPlayStart, pile = false, children }) {
  const controller = usePlayController({ onPlayStart })
  ref.played = controller.played
  return (
    <PlayProvider controller={controller}>
      <Probe />
      <div className="book-shell">
        <div className="book-wrapper">
          <div className="book-page book-page-left"><img className="book-page-img" alt="here" /></div>
          <div className="book-page book-page-right">{children}</div>
        </div>
        {pile && <div className="played-pile" data-testid="pile" />}
      </div>
    </PlayProvider>
  )
}

/** A pending action: the card stays lifted until the test settles it. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject, fn: vi.fn(() => promise) }
}

function renderBoard(children, { env = SPEED_1, onPlayStart, pile = false } = {}) {
  return render(<AnimationProvider env={env}><Board onPlayStart={onPlayStart} pile={pile}>{children}</Board></AnimationProvider>)
}

const smallCards = (action, n = 3) => Array.from({ length: n }, (_, i) => (
  <Card key={i} card={{ title: `card ${i}` }} playId={`action:${i}`} testId={`c${i}`}
    onAction={i === 0 ? action : vi.fn()} actionLabel={`go ${i}`} />
))
// The small cards in order (the played one loses its button to the spinner, so not by test id).
const root = i => document.querySelectorAll('.book-page-right .pg-card')[i]

let waapi
beforeEach(() => {
  waapi = installWaapi()
  ref.api = null
  ref.state = null
  ref.played = null
})
afterEach(() => {
  waapi.restore()
  delete window.matchMedia
  document.querySelectorAll('.flying-card').forEach(n => n.remove())
})

describe('playClassOf', () => {
  it('lifts then hides the played card; a small-card play dims then drops the other small cards only', () => {
    const small = { playId: 'a', phase: 'lift', small: true }
    expect(playClassOf(null, 'a', false)).toBe('')
    expect(playClassOf(small, 'a', false)).toBe(' is-playing')
    expect(playClassOf({ ...small, phase: 'land' }, 'a', false)).toBe(' is-played')
    expect(playClassOf(small, 'b', false)).toBe(' is-dimmed')
    expect(playClassOf(small, null, false)).toBe(' is-dimmed')
    expect(playClassOf({ ...small, phase: 'land' }, 'b', false)).toBe(' is-discarded')
    // reading pages never dim, and the same play id on the reading page is not the played small card
    expect(playClassOf(small, 'a', true)).toBe('')
    const page = { playId: 'a', phase: 'lift', small: false }
    expect(playClassOf(page, 'a', true)).toBe(' is-playing')
    expect(playClassOf(page, 'b', false)).toBe('')
  })
})

describe('PlayContext — begin and cancel', () => {
  it('outside a game book there is no play: usePlay and usePlayState are null', () => {
    render(<Probe />)
    expect(ref.api).toBeNull()
    expect(ref.state).toBeNull()
  })

  it('begin runs onPlayStart inside the click, lifts the card and dims the other small cards', () => {
    const action = deferred()
    const onPlayStart = vi.fn()
    renderBoard(<>{smallCards(action.fn)}<Card variant="page" card={{ title: 'page' }} /></>, { onPlayStart })
    fireEvent.click(screen.getByTestId('c0-action'))
    expect(onPlayStart).toHaveBeenCalledTimes(1)
    expect(action.fn).toHaveBeenCalled()
    expect(root(0)).toHaveClass('is-playing')
    // the played card shows the spinner, the others are dimmed; the reading page never dims
    expect(document.querySelectorAll('.pg-card.is-dimmed')).toHaveLength(2)
    expect(document.querySelector('.book-page-content')).not.toHaveClass('is-dimmed')
    expect(ref.state).toMatchObject({ playId: 'action:0', phase: 'lift', small: true })
  })

  it('a failed call puts the lifted card down (CardButtons cancels in finally)', async () => {
    const action = deferred()
    renderBoard(smallCards(action.fn))
    fireEvent.click(screen.getByTestId('c0-action'))
    expect(root(0)).toHaveClass('is-playing')
    await act(async () => { action.reject(new Error('STALE_MATCH')) })
    expect(document.querySelector('.is-playing, .is-dimmed')).toBeNull()
    expect(ref.state).toBeNull()
  })

  it('with the play flag off, under reduced motion or without WAAPI nothing lifts (onPlayStart still runs)', () => {
    const onPlayStart = vi.fn()
    const action = deferred()
    renderBoard(smallCards(action.fn), { env: { VITE_ANIM_PLAY: 'false' }, onPlayStart })
    fireEvent.click(screen.getByTestId('c0-action'))
    expect(onPlayStart).toHaveBeenCalled()
    expect(document.querySelector('.is-playing')).toBeNull()
    expect(ref.api.begin('x', null)).toBe(false)
    expect(ref.api.land()).toBeNull()
  })

  it('without WAAPI begin refuses and the board keeps today\'s behaviour', () => {
    waapi.restore()
    const action = deferred()
    renderBoard(smallCards(action.fn))
    fireEvent.click(screen.getByTestId('c0-action'))
    expect(action.fn).toHaveBeenCalled()
    expect(document.querySelector('.is-playing')).toBeNull()
  })

  it('cancel only drops a play still lifting', () => {
    renderBoard(smallCards(vi.fn()))
    act(() => { ref.api.begin('action:0', root(0)) })
    act(() => { ref.api.land() })
    act(() => { ref.api.cancel() })
    expect(ref.state.phase).toBe('land')
    act(() => { ref.api.end() })
    expect(ref.state).toBeNull()
    act(() => { ref.api.end() }) // nothing left: harmless
  })
})

describe('PlayContext — land', () => {
  it('the other small cards fall one after the other, the card flies to the left picture, then all ends', async () => {
    renderBoard(smallCards(vi.fn(), 12))
    const picture = setBox(document.querySelector('.book-page-left .book-page-img'), { left: 100, top: 100, width: 200, height: 100 })
    setBox(root(0), { left: 600, top: 300, width: 100, height: 150 })
    act(() => { ref.api.begin('action:0', root(0)) })
    root(5).setAttribute('data-deal', 'waiting') // still on the deck: it is not dealt, so it does not fall
    let landing
    act(() => { landing = ref.api.land() })

    expect(root(0)).toHaveClass('is-played')
    expect(document.querySelectorAll('.pg-card.is-discarded')).toHaveLength(11)
    const falls = waapi.animations.filter(a => a.target.classList.contains('pg-card')
      && !a.target.classList.contains('flying-card'))
    expect(falls).toHaveLength(10)
    expect(falls.map(a => a.options.delay)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 400])
    expect(FALL_MAX_STAGGER).toBe(8)
    expect(falls[0].keyframes[1].opacity).toBe(0)

    const clone = document.body.querySelector(':scope > .flying-card')
    expect(clone).not.toBeNull()
    expect(clone).not.toHaveClass('is-playing')
    expect(clone.querySelector('[data-testid]')).toBeNull()
    expect(clone.style.left).toBe('600px')
    const flight = waapi.animations.find(a => a.target === clone)
    expect(flight.options.duration).toBe(560)
    // from the card centre (650, 375) to the picture centre (200, 150)
    expect(flight.keyframes[2].transform).toBe('translate(-450px, -225px) rotate(-16deg) scale(0.3)')
    expect(picture).toBeInTheDocument()

    let resolved = false
    landing.then(() => { resolved = true })
    await act(async () => { await Promise.resolve() })
    expect(resolved).toBe(false)
    await act(async () => { waapi.finishAll() })
    expect(resolved).toBe(true)
    expect(document.querySelector('.flying-card')).toBeNull()
    // the end states stay in classes until the handler ends the play in the hold's commit
    expect(root(0)).toHaveClass('is-played')
    act(() => { ref.api.end() })
    expect(document.querySelector('.is-played, .is-discarded')).toBeNull()
    falls.forEach(a => expect(a.cancel).toHaveBeenCalled())
  })

  it('a reading-page play flies the whole card and dims or drops nothing', async () => {
    const action = deferred()
    renderBoard(<>
      {smallCards(vi.fn(), 2)}
      <Card variant="page" card={{ title: 'move', urlImage: 'x.png' }} playId="movement:m1"
        onAction={action.fn} actionLabel="walk" testId="page" />
    </>)
    fireEvent.click(screen.getByTestId('page-action'))
    const page = document.querySelector('.book-page-right .book-page-content')
    expect(page).toHaveClass('is-playing')
    expect(document.querySelector('.is-dimmed')).toBeNull()
    let landing
    act(() => { landing = ref.api.land() })
    expect(page).toHaveClass('is-played')
    expect(document.querySelector('.is-discarded')).toBeNull()
    const clone = document.body.querySelector(':scope > .flying-card')
    expect(clone).toHaveClass('book-page-content')
    expect(clone).not.toHaveClass('is-playing')
    expect(clone.querySelector('img.book-page-img')).not.toBeNull()
    expect(waapi.animations).toHaveLength(1)
    await act(async () => { waapi.finishAll(); await landing })
    expect(document.querySelector('.flying-card')).toBeNull()
  })

  it('a reading page with no picture flies too: the whole card is the copy', async () => {
    renderBoard(<Card variant="page" card={{ title: 'no picture' }} playId="sleep" onAction={vi.fn()} testId="p" />)
    const page = document.querySelector('.book-page-right .book-page-content')
    act(() => { ref.api.begin('sleep', page) })
    let landing
    act(() => { landing = ref.api.land() })
    expect(document.body.querySelector(':scope > .flying-card.book-page-content')).not.toBeNull()
    expect(waapi.animations).toHaveLength(1)
    await act(async () => { waapi.finishAll(); await landing })
    expect(document.querySelector('.flying-card')).toBeNull()
  })

  it('a play whose card left the page meanwhile lands with no flight', async () => {
    renderBoard(<Card variant="page" card={{ title: 'gone' }} playId="sleep" onAction={vi.fn()} testId="p" />)
    const page = document.querySelector('.book-page-right .book-page-content')
    act(() => { ref.api.begin('sleep', page) })
    page.remove()
    let landing
    act(() => { landing = ref.api.land() })
    await act(async () => { await landing })
    expect(waapi.animations).toHaveLength(0)
  })

  it('land with nothing lifting is null (the handlers keep their synchronous path)', () => {
    renderBoard(smallCards(vi.fn()))
    expect(ref.api.land()).toBeNull()
  })

  it('unmounting removes a flying clone', () => {
    const { unmount } = renderBoard(smallCards(vi.fn()))
    act(() => { ref.api.begin('action:0', root(0)) })
    act(() => { ref.api.land() })
    expect(document.querySelector('.flying-card')).not.toBeNull()
    unmount()
    expect(document.querySelector('.flying-card')).toBeNull()
  })

  it('"Do" (the select button) plays the card too', async () => {
    const select = deferred()
    renderBoard(<>
      <Card card={{ title: 'option' }} playId="choice:c1" onSelect={select.fn} selectLabel="do" testId="opt" />
      <Card card={{ title: 'other' }} onSelect={vi.fn()} selectLabel="other" testId="other" />
    </>)
    fireEvent.click(screen.getByTestId('opt-select'))
    expect(screen.getByTestId('opt-select').closest('.pg-card')).toHaveClass('is-playing')
    expect(screen.getByTestId('other-select').closest('.pg-card')).toHaveClass('is-dimmed')
    // the select button of a card with no play id is a plain click
    await act(async () => { select.resolve() })
    expect(document.querySelector('.is-playing')).toBeNull()
  })
})

describe('flightTarget', () => {
  const PICTURE = { width: 0, rotate: -16, stays: false }
  it('without a pile: the left page picture centre, else the left page centre, else the screen centre', () => {
    const book = document.createElement('div')
    book.innerHTML = '<div class="book-page-left"><img class="book-page-img"></div>'
    setBox(book.querySelector('.book-page-img'), { left: 10, top: 20, width: 100, height: 60 })
    expect(flightTarget(book)).toEqual({ x: 60, y: 50, ...PICTURE })
    book.querySelector('.book-page-img').remove()
    setBox(book.querySelector('.book-page-left'), { left: 0, top: 0, width: 400, height: 600 })
    expect(flightTarget(book)).toEqual({ x: 200, y: 300, ...PICTURE })
    expect(flightTarget(null)).toEqual({ x: window.innerWidth / 2, y: window.innerHeight / 2, ...PICTURE })
  })

  // v1.15.0 — desktop and tablet: the face-up pile beside the book, a deck card's size (84px × the pile's scale).
  it('with the face-up pile shown: its centre, 84px × its scale wide, tilted −4°, and the card stays', () => {
    const shell = document.createElement('div')
    shell.innerHTML = '<div class="book-wrapper"><div class="book-page-left"></div></div><div class="played-pile"></div>'
    const book = shell.querySelector('.book-wrapper')
    setBox(book.querySelector('.book-page-left'), { left: 0, top: 0, width: 400, height: 600 })
    setBox(shell.querySelector('.played-pile'), { left: 1200, top: 500, width: 131.2, height: 172.2 })
    const target = flightTarget(book)
    expect(target).toMatchObject({ x: 1265.6, y: 586.1, rotate: -4, stays: true })
    expect(target.width).toBeCloseTo(84 * 0.82, 6)
    expect(PILE_CARD_W).toBe(84)
    // a pile not laid out (tablet hidden, deal off): the left page as before
    setBox(shell.querySelector('.played-pile'), { width: 0, height: 0 })
    expect(flightTarget(book)).toEqual({ x: 200, y: 300, ...PICTURE })
  })

  // v1.15.0 — phones: the sticky page deck, clamped to the bottom-right corner; the corner when it is not shown.
  it('on phones: the sticky page deck (clamped), else the screen\'s bottom-right corner; the card fades there', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const { innerWidth: w, innerHeight: h } = window
    const corner = { x: w - 50, y: h - 60, width: 54, rotate: -6, stays: false }
    expect(flightTarget(null)).toEqual(corner)
    const book = document.createElement('div')
    book.innerHTML = '<div class="book-page-right"><div class="deck"></div></div>'
    const deck = book.querySelector('.deck')
    setBox(deck, { left: 280, top: 400, width: 54, height: 81 })
    expect(flightTarget(book)).toEqual({ x: 307, y: 440.5, width: 54, rotate: -6, stays: false })
    setBox(deck, { left: w - 20, top: h - 70, width: 54, height: 81 })
    expect(flightTarget(book)).toMatchObject({ x: w - 40, y: h - 50 })
    setBox(deck, { left: 280, top: h + 100, width: 54, height: 81 })
    expect(flightTarget(book)).toEqual(corner)
    setBox(deck, { left: 280, top: -200, width: 54, height: 81 })
    expect(flightTarget(book)).toEqual(corner)
    setBox(deck, { width: 0, height: 0 })
    expect(flightTarget(book)).toEqual(corner)
  })
})

describe('PlayContext — the played cards (v1.15.0)', () => {
  it('a landed card flies onto the pile at the pile card size, stays opaque, then joins `played` (title, picture)', async () => {
    renderBoard(<Card card={{ title: 'Potion', urlImage: 'potion.png' }} playId="item:1" onAction={vi.fn()} testId="c" />,
      { pile: true })
    setBox(screen.getByTestId('pile'), { left: 1000, top: 421, width: 160, height: 210 })
    setBox(root(0), { left: 600, top: 300, width: 168, height: 252 })
    expect(ref.played).toEqual([])
    act(() => { ref.api.begin('item:1', root(0), { title: 'Potion', image: 'potion.png' }) })
    let landing
    act(() => { landing = ref.api.land() })
    const flight = waapi.animations.find(a => a.target.classList.contains('flying-card'))
    // from (684, 426) to the pile centre (1080, 526), 168px → 84px
    const [, mx, my] = flight.keyframes[1].transform.match(/translate\((.+)px, (.+)px\)/)
    expect(Number(mx)).toBeCloseTo(217.8, 6)
    expect(Number(my)).toBeCloseTo(-15, 6)
    expect(flight.keyframes[1].transform).toContain('rotate(-10deg) scale(0.7)')
    expect(flight.keyframes[2]).toEqual({ transform: 'translate(396px, 100px) rotate(-4deg) scale(0.5)', opacity: 1 })
    expect(ref.played).toEqual([])
    await act(async () => { waapi.finishAll(); await landing })
    expect(ref.played).toEqual([{ title: 'Potion', image: 'potion.png' }])
    expect(document.querySelector('.flying-card')).toBeNull()
  })

  it('a cancelled play adds nothing; a play without meta lands but is not kept; the list keeps the last five', async () => {
    renderBoard(smallCards(vi.fn(), 2))
    act(() => { ref.api.begin('action:0', root(0), { title: 'gone' }) })
    act(() => { ref.api.cancel() })
    expect(ref.played).toEqual([])
    act(() => { ref.api.begin('action:0', root(0)) })
    let landing
    act(() => { landing = ref.api.land() })
    await act(async () => { waapi.finishAll(); await landing })
    act(() => { ref.api.end() })
    expect(ref.played).toEqual([])
    for (let i = 1; i <= 7; i += 1) {
      act(() => { ref.api.begin('action:0', root(0), { title: `t${i}` }) })
      act(() => { landing = ref.api.land() })
      await act(async () => { waapi.finishAll(); await landing })
      act(() => { ref.api.end() })
    }
    expect(ref.played.map(c => c.title)).toEqual(['t3', 't4', 't5', 't6', 't7'])
    expect(ref.played[0]).toEqual({ title: 't3', image: null })
    act(() => { ref.api.begin('action:0', root(0), { image: 'only.png' }) })
    act(() => { landing = ref.api.land() })
    await act(async () => { waapi.finishAll(); await landing })
    expect(ref.played.at(-1)).toEqual({ title: null, image: 'only.png' })
  })
})
