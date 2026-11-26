import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import RouteBook, {
  NAV_WAIT_MAX_MS, routeBookStatus, routePlan, samePath, useRouteBook,
} from '../components/book/RouteBook'
import Book from '../components/book/Book'
import { useBookTurning } from '../components/book/BookPages'
import { CLOSE_FRAMES, OPEN_FRAMES, REDIRECT_STATE } from '../components/book/bookSwap'
import { scaledTimings } from '../constants/animations'
import { installWaapi } from './fixtures/waapi'

// Step 15 (to-do 2) — the routes' book: the change of book, the route turns and the navigation that waits.

const TIMINGS = { open: 650, close: 260, fade: 200, flip: 900, slide: 600, sheet: 620, simple: 520 }
const ANIM = { cover: true, turn: true, turnMode: 'full', reduced: false, coverMax: 10, timings: TIMINGS }
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top })

let nav = null
const mounted = []
const holds = {}
const blank = new Set()
const bare = new Set()
const stuck = new Set()
const plays = {}

function Nav() {
  nav = useNavigate()
  return <span data-testid="url">{useLocation().pathname}</span>
}

function Busy() {
  const route = useRouteBook()
  return <span data-testid="busy">{`${route?.busy}:${useBookTurning()}`}</span>
}

/** The shown location's state `n` (a same-path change). */
function Seen() {
  return <span data-testid="seen">{useLocation().state?.n ?? '-'}</span>
}

/** A play that never answers: busy reported to the routes' book until `plays[name](false)` or the unmount. */
function Stuck({ name }) {
  const report = useRouteBook()?.report
  const token = useRef({})
  const [busy, setBusy] = useState(true)
  plays[name] = setBusy
  useEffect(() => { report?.(token.current, busy) }, [report, busy])
  useEffect(() => () => report?.(token.current, false), [report])
  return null
}

function Page({ name }) {
  const [held, setHeld] = useState(false)
  const [key, setKey] = useState(0)
  holds[name] = { hold: setHeld, turn: () => setKey(k => k + 1) }
  if (!mounted.includes(name) || mounted.at(-1) !== name) mounted.push(name)
  if (blank.has(name)) return null
  if (bare.has(name)) return <div className="book-wrapper"><p data-testid="page">{name}</p></div>
  return (
    <Book left={<><p data-testid="page">{name}</p><Busy /><Seen />{stuck.has(name) && <Stuck name={name} />}</>}
      right={<p>{`${name} right`}</p>} holdTurn={held}
      pageKey={key} direction={key ? 'forward' : null} coverTitle={`${name} title`} />
  )
}

const T_PREFIX = key => `t:${key}`

function Harness({ anim, t }) {
  const location = useLocation()
  return (
    <RouteBook location={location} anim={anim} t={t}>
      {shown => (
        <Routes location={shown}>
          <Route path="/" element={<Page name="home" />} />
          <Route path="/player" element={<Page name="player" />} />
          <Route path="/story/:id" element={<Page name="story" />} />
          <Route path="/start-match/:id" element={<Page name="start" />} />
          <Route path="/play/:id" element={<Page name="game" />} />
          <Route path="*" element={<Navigate to="/" replace state={REDIRECT_STATE} />} />
        </Routes>
      )}
    </RouteBook>
  )
}

function renderAt(path = '/', anim = ANIM, t = T_PREFIX) {
  return render(<MemoryRouter initialEntries={[path]}><Nav /><Harness anim={anim} t={t} /></MemoryRouter>)
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
let waapi
/** Ends what runs, then lets the run take its next phase (and a pending route its tick). */
async function step(times = 1) {
  for (let i = 0; i < times; i += 1) await act(async () => { waapi.finishAll(); await settle() })
}
async function go(to) {
  await act(async () => { nav(to) })
}
const page = () => screen.getByTestId('page').textContent
const stage = () => document.querySelector('.book-stage')
const routeBook = () => document.querySelector('.route-book')
const swapLayer = () => document.querySelector('body > .book-swap')
const opens = () => waapi.animations.filter(a => a.keyframes === OPEN_FRAMES)

beforeEach(() => {
  waapi = installWaapi()
  mounted.length = 0
  blank.clear()
  bare.clear()
  stuck.clear()
})
afterEach(() => {
  vi.useRealTimers()
  waapi.restore()
  delete window.matchMedia
  vi.restoreAllMocks()
  document.querySelectorAll('body > .book-swap, body > .m-sheet, body > .m-blocker').forEach(n => n.remove())
  document.documentElement.classList.remove('is-turning')
})

describe('pure helpers', () => {
  it('samePath: the same page whatever its entry, query or state', () => {
    const a = { key: 'k', pathname: '/', search: '' }
    expect(samePath(a, a)).toBe(true)
    expect(samePath(a, { ...a, key: 'j', search: '?policy=terms', state: { n: 1 } })).toBe(true)
    expect(samePath(a, { ...a, pathname: '/player' })).toBe(false)
    expect(samePath(a, null)).toBe(false)
    expect(samePath(undefined, a)).toBe(false)
  })

  it('routePlan: cover gates the change, turn the route turns; reduced motion, no WAAPI or no settings: nothing', () => {
    expect(routePlan(ANIM, 'swap')).toBe('swap')
    expect(routePlan({ ...ANIM, cover: false }, 'swap')).toBeNull()
    expect(routePlan(ANIM, 'back')).toBe('back')
    expect(routePlan({ ...ANIM, turn: false }, 'forward')).toBeNull()
    expect(routePlan({ ...ANIM, reduced: true }, 'swap')).toBeNull()
    expect(routePlan(null, 'swap')).toBeNull()
    expect(routePlan(ANIM, null)).toBeNull()
    waapi.restore()
    expect(routePlan(ANIM, 'swap')).toBeNull()
  })
})

describe('RouteBook — first load', () => {
  it('the first book opens once (former bookOpen, timings.open), inert and busy until it ends; deal held', async () => {
    renderAt('/')
    expect(opens()).toHaveLength(1)
    // a DOM node in toMatchObject would walk React's fibers: the target is checked on its own
    expect(opens()[0].target).toBe(document.querySelector('.book-wrapper'))
    expect(opens()[0].options.duration).toBe(650)
    expect(stage()).toHaveAttribute('inert')
    expect(stage()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('busy')).toHaveTextContent('true:true')
    expect(routeBook()).not.toHaveClass('is-swapping')
    await step()
    expect(stage()).not.toHaveAttribute('inert')
    expect(screen.getByTestId('busy')).toHaveTextContent('false:false')
    await go('/player')
    await step(2)
    expect(opens()).toHaveLength(1)
  })

  it('a first page with no book (a redirect) opens the first book it lands on', async () => {
    renderAt('/nope')
    expect(page()).toBe('home')
    expect(opens()).toHaveLength(1)
    expect(swapLayer()).toBeNull()
    await step()
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('a page with no book and no redirect: nothing opens, the book is not busy', () => {
    blank.add('home')
    renderAt('/')
    expect(opens()).toHaveLength(0)
    expect(document.querySelector('.book-stage')).toBeNull()
  })

  it('the opening belongs to the first book only: cover off then on, nothing opens later', async () => {
    const tree = anim => <MemoryRouter initialEntries={['/']}><Nav /><Harness anim={anim} t={T_PREFIX} /></MemoryRouter>
    const { rerender } = render(tree({ ...ANIM, cover: false }))
    expect(opens()).toHaveLength(0)
    rerender(tree(ANIM))
    await act(async () => { nav('/', { replace: true, state: { any: 1 } }) })
    expect(opens()).toHaveLength(0)
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('cover off, the first book after a page with none: a route turn there, no opening', async () => {
    blank.add('home')
    renderAt('/', { ...ANIM, cover: false })
    await go('/player')
    expect(page()).toBe('player')
    expect(opens()).toHaveLength(0)
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('cover off, reduced motion or no WAAPI: no opening', () => {
    const { unmount } = renderAt('/', { ...ANIM, cover: false })
    expect(opens()).toHaveLength(0)
    expect(stage()).not.toHaveAttribute('inert')
    unmount()
    renderAt('/', { ...ANIM, reduced: true }).unmount()
    waapi.restore()
    renderAt('/')
    expect(stage()).not.toHaveAttribute('inert')
  })
})

describe('RouteBook — book change (desktop full)', () => {
  it('copy taken before the commit (stripped, turn layer emptied); live book hidden, the change, then shown', async () => {
    renderAt('/')
    await step()
    document.querySelector('.book-turn-layer').appendChild(document.createElement('i'))
    await go('/story/s1')
    expect(page()).toBe('story')
    expect(routeBook()).toHaveClass('is-swapping')
    expect(stage()).toHaveAttribute('inert')
    expect(stage()).toHaveAttribute('aria-busy', 'true')
    const copy = swapLayer().querySelector('.book-swap__book')
    expect(copy).toHaveTextContent('home right')
    expect(copy.querySelector('[data-testid], [data-tip], [id]')).toBeNull()
    expect(copy.querySelector('.book-turn-layer')).toBeEmptyDOMElement()
    await step()
    expect(copy.querySelector('.flap-back .cover-title')).toHaveTextContent('t:nav.brand')
    expect(copy.querySelector('.flap-back .cover-sub')).toHaveTextContent('t:book.coverSub')
    await step(2)
    expect(swapLayer().querySelector('.book-flap .cover-title')).toHaveTextContent('story title')
    expect(routeBook()).toHaveClass('is-swapping')
    await step(3)
    expect(swapLayer()).toBeNull()
    expect(routeBook()).not.toHaveClass('is-swapping')
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('the phase durations passed to animate are capped by coverMax (¼×: 13.6 s → 10 s); 0 = no limit', async () => {
    const quarter = { ...ANIM, timings: scaledTimings(0.25) }
    const { unmount } = renderAt('/', quarter)
    await step()
    let from = waapi.animations.length
    await go('/story/s1')
    await step(6)
    const capped = waapi.animations.slice(from).map(a => a.options.duration)
    expect(capped[0]).toBe(588)
    expect(capped).toContain(2647)
    expect(capped).toContain(1765)
    expect(capped).not.toContain(3600)
    unmount()
    renderAt('/', { ...quarter, coverMax: 0 })
    await step()
    from = waapi.animations.length
    await go('/story/s1')
    await step(6)
    expect(waapi.animations.slice(from).map(a => a.options.duration)).toEqual(expect.arrayContaining([800, 3600, 2400]))
  })

  it('simple mode: the copy closes, then the live book opens with the former bookOpen', async () => {
    renderAt('/', { ...ANIM, turnMode: 'simple' })
    await step()
    await go('/play/s1')
    expect(waapi.animations.at(-1).keyframes).toBe(CLOSE_FRAMES)
    expect(waapi.animations.at(-1).options.duration).toBe(260)
    await step()
    expect(routeBook()).not.toHaveClass('is-swapping')
    expect(waapi.animations.at(-1).keyframes).toBe(OPEN_FRAMES)
    expect(waapi.animations.at(-1).target).toBe(document.querySelector('.book-wrapper'))
    await step()
    expect(swapLayer()).toBeNull()
  })

  it('phones: a cover closes over the slice and opens on the new book', async () => {
    window.matchMedia = vi.fn(query => ({ matches: query.includes('max-width: 767px') }))
    renderAt('/')
    await step()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function box() {
      return this.classList?.contains('book-wrapper') ? rect(0, 60, 360, 1400) : rect(0, 0, 0, 0)
    })
    await go('/story/s1')
    expect(document.querySelector('body > .m-sheet.m-sheet--tabs')).not.toBeNull()
    const cover = document.querySelector('body > .m-cover')
    expect(cover.querySelector('.cover-title')).toHaveTextContent('t:nav.brand')
    expect(document.documentElement).toHaveClass('is-turning')
    await step(2)
    expect(cover.querySelector('.cover-title')).toHaveTextContent('story title')
    await step(3)
    expect(document.querySelector('body > .m-cover, body > .m-blocker')).toBeNull()
    expect(document.documentElement).not.toHaveClass('is-turning')
    expect(routeBook()).not.toHaveClass('is-swapping')
  })

  it('cover off or reduced motion: the new book just appears', async () => {
    const { unmount } = renderAt('/', { ...ANIM, cover: false })
    await go('/story/s1')
    expect(page()).toBe('story')
    expect(swapLayer()).toBeNull()
    expect(stage()).not.toHaveAttribute('inert')
    unmount()
    renderAt('/', { ...ANIM, reduced: true })
    await go('/play/s1')
    expect(swapLayer()).toBeNull()
    expect(waapi.animations).toHaveLength(0)
  })

  it('from a page with no book there is nothing to copy: the first book opens, later the book is free at once', async () => {
    blank.add('start')
    renderAt('/start-match/s1')
    await go('/')
    expect(page()).toBe('home')
    expect(swapLayer()).toBeNull()
    expect(opens()).toHaveLength(1)
    await step()
    expect(stage()).not.toHaveAttribute('inert')
    // a change towards a page with no book ends when the new book is missing
    await go('/start-match/s1')
    expect(swapLayer()).not.toBeNull()
    await step(3)
    expect(swapLayer()).toBeNull()
    await go('/')
    expect(swapLayer()).toBeNull()
    expect(opens()).toHaveLength(1)
    expect(stage()).not.toHaveAttribute('inert')
  })
})

describe('RouteBook — book change details', () => {
  it('without a translator the cover keeps the keys; without coverMax there is no limit', async () => {
    const quarter = { ...ANIM, coverMax: undefined, timings: scaledTimings(0.25) }
    renderAt('/', quarter, null)
    await step()
    const from = waapi.animations.length
    await go('/story/s1')
    await step()
    expect(swapLayer().querySelector('.flap-back .cover-title')).toHaveTextContent('nav.brand')
    expect(waapi.animations.slice(from).map(a => a.options.duration)).toContain(3600)
    await step(5)
    expect(swapLayer()).toBeNull()
  })

  it('a book with no pages to copy for a route turn: no turn, free at once', async () => {
    bare.add('home')
    renderAt('/')
    await step()
    await go('/player')
    expect(page()).toBe('player')
    expect(swapLayer()).toBeNull()
    expect(stage()).not.toHaveAttribute('inert')
  })
})

describe('RouteBook — route turns (same book)', () => {
  it('turns forward / back by rank with the step 15 strategy, in a fixed layer on the new book', async () => {
    renderAt('/')
    await step()
    await go('/player')
    expect(page()).toBe('player')
    expect(document.querySelector('body > .book-swap > .book-turn-layer .page-flipper.is-fwd')).not.toBeNull()
    expect(routeBook()).not.toHaveClass('is-swapping')
    expect(stage()).toHaveAttribute('inert')
    await step()
    expect(swapLayer()).toBeNull()
    expect(stage()).not.toHaveAttribute('inert')
    await go('/')
    expect(document.querySelector('.book-swap .page-flipper.is-back')).not.toBeNull()
    await step()
  })

  it('turn off: no route turn; same path with a new state and redirects: nothing', async () => {
    renderAt('/', { ...ANIM, turn: false })
    await step()
    await go('/player')
    expect(swapLayer()).toBeNull()
    await act(async () => { nav('/player', { replace: true, state: { any: 1 } }) })
    expect(swapLayer()).toBeNull()
    await act(async () => { nav('/', { state: REDIRECT_STATE }) })
    expect(page()).toBe('home')
    expect(swapLayer()).toBeNull()
  })
})

describe('RouteBook — a navigation waits for the book', () => {
  it('during a change: the shown page and its animation stay; then only the latest route, by the table', async () => {
    renderAt('/')
    await step()
    await go('/story/s1')
    await go('/player')
    await go('/play/s1')
    expect(screen.getByTestId('url')).toHaveTextContent('/play/s1')
    expect(page()).toBe('story')
    expect(swapLayer()).not.toBeNull()
    await step(6)
    await act(async () => { await settle() })
    expect(page()).toBe('game')
    expect(mounted).not.toContain('player')
    // story → game is a page of the same book: a forward turn
    expect(document.querySelector('.book-swap .page-flipper.is-fwd')).not.toBeNull()
    await step()
  })

  it('during a route turn: waits, then the latest', async () => {
    renderAt('/')
    await step()
    await go('/player')
    await go('/')
    await go('/story/s1')
    expect(page()).toBe('player')
    await step()
    await act(async () => { await settle() })
    expect(page()).toBe('story')
    expect(routeBook()).toHaveClass('is-swapping')
    await step(6)
  })

  it('while the Book holds its pages (a play answer): the URL changes, the page waits; on release the change runs', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.hold(true) })
    expect(stage()).toHaveAttribute('inert')
    await go('/story/s1')
    expect(screen.getByTestId('url')).toHaveTextContent('/story/s1')
    expect(page()).toBe('home')
    act(() => { holds.home.hold(false) })
    expect(page()).toBe('home')
    await act(async () => { await settle() })
    expect(page()).toBe('story')
    expect(swapLayer()).not.toBeNull()
    await step(6)
  })

  it('while the Book turns its own page: waits until the sheet lands', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.turn() })
    await go('/player')
    expect(page()).toBe('home')
    await step()
    await act(async () => { await settle() })
    expect(page()).toBe('player')
    await step()
  })

  it('a pending route equal to the shown page (Back) is dropped: nothing runs', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.hold(true) })
    await go('/story/s1')
    await go(-1)
    expect(screen.getByTestId('url')).toHaveTextContent('/')
    act(() => { holds.home.hold(false) })
    await act(async () => { await settle() })
    expect(page()).toBe('home')
    expect(swapLayer()).toBeNull()
    expect(mounted).not.toContain('story')
  })

  it('busy again before the tick: the route keeps waiting; a free navigation before it wins', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.hold(true) })
    await go('/story/s1')
    act(() => { holds.home.hold(false) })
    act(() => { holds.home.hold(true) })
    await act(async () => { await settle() })
    expect(page()).toBe('home')
    act(() => { holds.home.hold(false) })
    await go('/player')
    expect(page()).toBe('player')
    await act(async () => { await settle() })
    expect(page()).toBe('player')
    expect(mounted).not.toContain('story')
    await step()
  })

  it('a book unmounted while busy stops counting as busy', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.hold(true) })
    blank.add('home')
    act(() => { holds.home.turn() })
    expect(document.querySelector('.book-stage')).toBeNull()
    await go('/player')
    expect(page()).toBe('player')
  })
})

describe('RouteBook — a same-path change never waits nor animates', () => {
  const same = n => act(async () => { nav('/', { replace: true, state: { n } }) })
  const seen = () => screen.getByTestId('seen').textContent

  it('during the first-load opening (a direct load finds its match): at once, the opening goes on', async () => {
    renderAt('/play/s1')
    expect(stage()).toHaveAttribute('inert')
    const count = waapi.animations.length
    await act(async () => { nav('/play/s1', { replace: true, state: { n: 1 } }) })
    expect(seen()).toBe('1')
    expect(page()).toBe('game')
    expect(waapi.animations).toHaveLength(count)
    expect(opens()[0].playState).toBe('running')
    expect(stage()).toHaveAttribute('inert')
    await step()
    expect(stage()).not.toHaveAttribute('inert')
    expect(opens()).toHaveLength(1)
  })

  it('during a route turn and a book change: at once, no new copy, the animation goes on', async () => {
    renderAt('/')
    await step()
    await go('/player')
    const flipper = document.querySelector('.book-swap .page-flipper')
    const count = waapi.animations.length
    await act(async () => { nav('/player', { replace: true, state: { n: 2 } }) })
    expect(seen()).toBe('2')
    expect(document.querySelector('.book-swap .page-flipper')).toBe(flipper)
    expect(waapi.animations).toHaveLength(count)
    await step()
    expect(swapLayer()).toBeNull()
    await go('/story/s1')
    const layer = swapLayer()
    await act(async () => { nav('/story/s1', { replace: true, state: { n: 3 } }) })
    expect(seen()).toBe('3')
    expect(document.querySelectorAll('body > .book-swap')).toHaveLength(1)
    expect(swapLayer()).toBe(layer)
    expect(routeBook()).toHaveClass('is-swapping')
    await step(6)
    expect(swapLayer()).toBeNull()
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('during a hold: at once, the hold stays; a pending route is dropped by it (the latest is the shown page)', async () => {
    renderAt('/')
    await step()
    act(() => { holds.home.hold(true) })
    await act(async () => { nav('/', { replace: true, state: { n: 4 } }) })
    expect(seen()).toBe('4')
    expect(stage()).toHaveAttribute('inert')
    await go('/story/s1')
    expect(page()).toBe('home')
    await same(5)
    expect(screen.getByTestId('url')).toHaveTextContent('/')
    expect(seen()).toBe('5')
    act(() => { holds.home.hold(false) })
    await act(async () => { await settle() })
    expect(page()).toBe('home')
    expect(swapLayer()).toBeNull()
    expect(mounted).not.toContain('story')
  })
})

describe('RouteBook — the wait limit (NAV_WAIT_MAX_MS)', () => {
  it('a play that never answers: the latest pending route is shown after the limit, the play dropped', async () => {
    expect(NAV_WAIT_MAX_MS).toBe(15000)
    stuck.add('home')
    renderAt('/')
    await step()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await go('/player')
    act(() => { vi.advanceTimersByTime(NAV_WAIT_MAX_MS - 1000) })
    // a later route does not extend the limit
    await go('/story/s1')
    act(() => { vi.advanceTimersByTime(999) })
    expect(page()).toBe('home')
    act(() => { vi.advanceTimersByTime(1) })
    expect(page()).toBe('story')
    expect(mounted).not.toContain('player')
    expect(swapLayer()).not.toBeNull()
    vi.useRealTimers()
    await step(6)
    expect(swapLayer()).toBeNull()
    expect(stage()).not.toHaveAttribute('inert')
    await go('/')
    expect(swapLayer()).not.toBeNull()
    await step(6)
  })

  it('its own change running past the limit is ended (layers gone), then the route runs by the table', async () => {
    renderAt('/', { ...ANIM, coverMax: 0 })
    await step()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await go('/story/s1')
    const first = swapLayer()
    await go('/')
    act(() => { vi.advanceTimersByTime(NAV_WAIT_MAX_MS) })
    vi.useRealTimers()
    await act(async () => { await settle() })
    expect(page()).toBe('home')
    expect(first.isConnected).toBe(false)
    expect(document.querySelectorAll('body > .book-swap')).toHaveLength(1)
    await step(6)
    expect(swapLayer()).toBeNull()
  })

  it('a free book and the limit in the same tick: the route is shown once', async () => {
    stuck.add('home')
    renderAt('/')
    await step()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await go('/player')
    act(() => { vi.advanceTimersByTime(NAV_WAIT_MAX_MS - 1) })
    act(() => { plays.home(false) })
    expect(page()).toBe('home')
    act(() => { vi.advanceTimersByTime(1) })
    expect(page()).toBe('player')
    expect(mounted.filter(name => name === 'player')).toHaveLength(1)
    vi.useRealTimers()
    await step()
    expect(swapLayer()).toBeNull()
  })

  it('a route shown before the limit stops it: nothing runs at the limit', async () => {
    stuck.add('home')
    renderAt('/')
    await step()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await go('/player')
    expect(vi.getTimerCount()).toBe(1)
    act(() => { plays.home(false) })
    act(() => { vi.advanceTimersByTime(0) })
    expect(page()).toBe('player')
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    await step()
  })
})

describe('RouteBook — status for the navbar', () => {
  it('the shown page and whether nothing runs or waits; null with no routes book', async () => {
    expect(routeBookStatus()).toBeNull()
    const { unmount } = renderAt('/')
    expect(routeBookStatus()).toEqual({ pathname: '/', settled: false })
    await step()
    expect(routeBookStatus()).toEqual({ pathname: '/', settled: true })
    act(() => { holds.home.hold(true) })
    expect(routeBookStatus()).toEqual({ pathname: '/', settled: false })
    await go('/story/s1')
    expect(routeBookStatus()).toEqual({ pathname: '/', settled: false })
    act(() => { holds.home.hold(false) })
    await act(async () => { await settle() })
    expect(routeBookStatus()).toEqual({ pathname: '/story/s1', settled: false })
    await step(6)
    expect(routeBookStatus()).toEqual({ pathname: '/story/s1', settled: true })
    unmount()
    expect(routeBookStatus()).toBeNull()
  })

  it('an older book unmounted after a newer one mounted leaves the newer one as the status', () => {
    const older = renderAt('/')
    renderAt('/player')
    older.unmount()
    expect(routeBookStatus()?.pathname).toBe('/player')
  })
})

describe('RouteBook — clean-up', () => {
  it('an unmount during a change removes its layers and shows nothing more', async () => {
    const { unmount } = renderAt('/')
    await step()
    await go('/story/s1')
    expect(swapLayer()).not.toBeNull()
    unmount()
    expect(swapLayer()).toBeNull()
    await act(async () => { await settle() })
  })

  it('an unmount with a pending route clears its tick', async () => {
    const { unmount } = renderAt('/')
    await step()
    await go('/player')
    await go('/')
    await act(async () => { waapi.finishAll() })
    unmount()
    await act(async () => { await settle() })
    expect(swapLayer()).toBeNull()
  })

  it('a report before the mount or a repeated one changes nothing; outside RouteBook the context is null', () => {
    let seen = 'unset'
    function Probe() { seen = useRouteBook(); return null }
    render(<Probe />)
    expect(seen).toBeNull()
    const book = new RouteBook({ location: { pathname: '/' }, anim: ANIM, children: () => null })
    const token = {}
    book.report(token, true)
    book.report(token, true)
    expect(book.reporters.size).toBe(1)
    book.report(token, false)
    expect(book.reporters.size).toBe(0)
  })
})
