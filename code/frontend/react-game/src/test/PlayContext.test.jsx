import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))

import Card, { playClassOf } from '../components/layout/Card'
import { AnimationProvider } from '../context/AnimationContext'
import {
  PlayProvider, usePlayController, usePlay, usePlayState, flightTarget, FALL_MAX_STAGGER,
} from '../features/gameplay/play/PlayContext'
import { installWaapi, setBox } from './fixtures/waapi'

// Step 15 — the play: lift and glow, the other small cards dim then fall, a fixed clone flies into the story.

const SPEED_1 = { VITE_ANIM_SPEED: '1' } // lift 240, fly 560, discard 320, discardStep 50
const ref = { api: null, state: null }

function Probe() {
  ref.api = usePlay()
  ref.state = usePlayState()
  return null
}

function Board({ onPlayStart, children }) {
  const controller = usePlayController({ onPlayStart })
  return (
    <PlayProvider controller={controller}>
      <Probe />
      <div className="book-wrapper">
        <div className="book-page book-page-left"><img className="book-page-img" alt="here" /></div>
        <div className="book-page book-page-right">{children}</div>
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

function renderBoard(children, { env = SPEED_1, onPlayStart } = {}) {
  return render(<AnimationProvider env={env}><Board onPlayStart={onPlayStart}>{children}</Board></AnimationProvider>)
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
  it('the left page picture centre, else the left page centre, else the screen centre', () => {
    const book = document.createElement('div')
    book.innerHTML = '<div class="book-page-left"><img class="book-page-img"></div>'
    setBox(book.querySelector('.book-page-img'), { left: 10, top: 20, width: 100, height: 60 })
    expect(flightTarget(book)).toEqual({ x: 60, y: 50 })
    book.querySelector('.book-page-img').remove()
    setBox(book.querySelector('.book-page-left'), { left: 0, top: 0, width: 400, height: 600 })
    expect(flightTarget(book)).toEqual({ x: 200, y: 300 })
    expect(flightTarget(null)).toEqual({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  })

  it('on phones: the top centre, just under the navbar', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    expect(flightTarget(null)).toEqual({ x: window.innerWidth / 2, y: 60 })
    const nav = setBox(document.createElement('nav'), { top: 0, height: 56 })
    nav.className = 'navbar-medieval'
    document.body.appendChild(nav)
    expect(flightTarget(null)).toEqual({ x: window.innerWidth / 2, y: 116 })
    nav.remove()
  })

  // Step 15 — the tabs stand on the book's edge: a tab row on the screen no longer pushes the target down.
  it('step 16 — on phones: the top of the visible slice of the book, under the navbar only', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const nav = setBox(document.createElement('nav'), { top: 0, height: 56 })
    nav.className = 'navbar-medieval'
    document.body.appendChild(nav)
    const book = setBox(document.createElement('div'), { left: 8, top: -300, width: 344, height: 2000 })
    book.innerHTML = '<div class="book-bookmarks-row"></div>'
    setBox(book.querySelector('.book-bookmarks-row'), { left: 8, top: 56, width: 344, height: 48 })
    expect(flightTarget(book)).toEqual({ x: 180, y: 116 })
    nav.remove()
  })
})
