import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import DealtList from '../components/layout/DealtList'
import useDeal, { slotCard, dealOrigin } from '../hooks/useDeal'
import { AnimationProvider } from '../context/AnimationContext'
import BookPages from '../components/book/BookPages'
import RouteBook from '../components/book/RouteBook'
import { installWaapi } from './fixtures/waapi'

// Step 14 — the deal: jsdom has no IntersectionObserver and no layout, so both are faked here.
class FakeIO {
  static instances = []
  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.targets = new Set()
    this.disconnected = false
    FakeIO.instances.push(this)
  }
  observe(el) { this.targets.add(el) }
  unobserve(el) { this.targets.delete(el) }
  disconnect() { this.targets.clear(); this.disconnected = true }
  /** Delivers one entry per element, in the given order. */
  fire(els, isIntersecting = true) {
    act(() => { this.callback(els.map(target => ({ target, isIntersecting })), this) })
  }
}
const io = () => FakeIO.instances[FakeIO.instances.length - 1]

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top })
const place = (el, r) => { el.getBoundingClientRect = () => r }

const SPEED_1 = { VITE_ANIM_SPEED: '1' } // deal 620 ms, step 110 ms
function dealt(ui, env = SPEED_1) {
  return render(<AnimationProvider env={env}>{ui}</AnimationProvider>)
}
const cards = n => Array.from({ length: n }, (_, i) => <div key={i} className="pg-card" data-testid={`c${i}`} />)
const card = i => screen.getByTestId(`c${i}`)

beforeEach(() => {
  FakeIO.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  window.matchMedia = undefined
})
const copies = () => [...document.querySelectorAll('body > .pg-card.deal-copy')]
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
  copies().forEach(n => n.remove())
})

describe('DealtList', () => {
  it('renders the caller classes plus pg-dealt, passes the rest through, flags the deal on the list', () => {
    dealt(<DealtList className=" selection-list " data-testid="list" role="list">{cards(1)}</DealtList>)
    const list = screen.getByTestId('list')
    expect(list.className).toBe('selection-list pg-dealt')
    expect(list).toHaveAttribute('role', 'list')
    expect(list).toHaveAttribute('data-deal-list', 'on')
    const bare = render(<DealtList data-testid="bare" />)
    expect(bare.getByTestId('bare').className).toBe('pg-dealt')
  })

  it('marks every card waiting before the first paint and observes it (threshold 0.2)', () => {
    dealt(<DealtList>{cards(3)}</DealtList>)
    ;[0, 1, 2].forEach(i => {
      expect(card(i)).toHaveAttribute('data-deal', 'waiting')
      expect(io().targets.has(card(i))).toBe(true)
    })
    expect(io().options).toEqual({ threshold: 0.2 })
  })

  it('deals a batch in DOM order, the stagger capped at 8, face down', () => {
    dealt(<DealtList>{cards(10)}</DealtList>)
    const all = [...Array(10).keys()].map(card)
    io().fire([...all].reverse())
    expect(all.map(c => c.style.getPropertyValue('--deal-i'))).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '7', '7'])
    all.forEach(c => {
      expect(c).toHaveAttribute('data-deal', 'flying')
      expect(c).toHaveAttribute('data-deal-face', 'down')
      expect(io().targets.has(c)).toBe(false)
      const rot = parseFloat(c.style.getPropertyValue('--from-rot'))
      expect(rot).toBeGreaterThanOrEqual(-15)
      expect(rot).toBeLessThanOrEqual(15)
    })
  })

  it('a flat deal when VITE_ANIM_DEAL_FACEDOWN=false', () => {
    dealt(<DealtList>{cards(1)}</DealtList>, { ...SPEED_1, VITE_ANIM_DEAL_FACEDOWN: 'false' })
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal-face', 'up')
  })

  it('a card off screen (or hidden by hide-in-book / hide-in-mobile) stays waiting', () => {
    dealt(<DealtList>{cards(2)}</DealtList>)
    io().fire([card(0), card(1)], false)
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    expect(io().targets.has(card(0))).toBe(true)
  })

  it('lands on its own animationend, not on one bubbling from inside', () => {
    dealt(<DealtList><div className="pg-card" data-testid="c0"><span data-testid="inner" /></div></DealtList>)
    io().fire([card(0)])
    fireEvent.animationEnd(screen.getByTestId('inner'))
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
    fireEvent.animationEnd(card(0))
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    // a late entry for a landed card is ignored
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
  })

  it('lands on the timeout fallback: deal + dealStep × i + 200 ms', () => {
    vi.useFakeTimers()
    dealt(<DealtList>{cards(2)}</DealtList>)
    io().fire([card(0), card(1)])
    act(() => { vi.advanceTimersByTime(819) })
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
    act(() => { vi.advanceTimersByTime(1) })
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(card(1)).toHaveAttribute('data-deal', 'flying')
    act(() => { vi.advanceTimersByTime(110) })
    expect(card(1)).toHaveAttribute('data-deal', 'landed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unmount mid-flight lands the card, disconnects the observer and clears the timers', () => {
    vi.useFakeTimers()
    const { unmount } = dealt(<DealtList>{cards(2)}</DealtList>)
    const [a, b] = [card(0), card(1)]
    const observer = io()
    observer.fire([a])
    unmount()
    expect(a).toHaveAttribute('data-deal', 'landed')
    expect(b).toHaveAttribute('data-deal', 'waiting')
    expect(observer.disconnected).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a re-render never deals a card again; a card added later is dealt', async () => {
    const { rerender } = dealt(<DealtList>{cards(1)}</DealtList>)
    io().fire([card(0)])
    fireEvent.animationEnd(card(0))
    rerender(<AnimationProvider env={SPEED_1}><DealtList>{cards(2)}</DealtList></AnimationProvider>)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    await waitFor(() => expect(card(1)).toHaveAttribute('data-deal', 'waiting'))
    expect(io().targets.has(card(1))).toBe(true)
    expect(io().targets.has(card(0))).toBe(false)
    io().fire([card(1)])
    expect(card(1)).toHaveAttribute('data-deal', 'flying')
  })

  it('deals the first card of a wrapper slot; a slot without a card shows at once', () => {
    dealt(
      <DealtList>
        <div className="match-card-wrap" data-testid="wrap"><div className="pg-card" data-testid="c0" /></div>
        <p data-testid="empty">nothing</p>
      </DealtList>,
    )
    expect(screen.getByTestId('wrap')).not.toHaveAttribute('data-deal')
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    expect(screen.getByTestId('empty')).not.toHaveAttribute('data-deal')
  })

  it('a waiting card that gets keyboard focus lands at once', () => {
    dealt(<DealtList><div className="pg-card" data-testid="c0"><button>go</button></div><button data-testid="free">x</button></DealtList>)
    fireEvent.focusIn(screen.getByTestId('free'))
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    fireEvent.focusIn(screen.getByText('go'))
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(io().targets.has(card(0))).toBe(false)
  })

  it('hold keeps the cards waiting, unobserved, until it is released', () => {
    const { rerender } = dealt(<DealtList hold>{cards(2)}</DealtList>)
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    expect(io().targets.size).toBe(0)
    rerender(<AnimationProvider env={SPEED_1}><DealtList>{cards(2)}</DealtList></AnimationProvider>)
    expect(io().targets.has(card(0))).toBe(true)
    io().fire([card(0), card(1)])
    expect(card(1)).toHaveAttribute('data-deal', 'flying')
  })
})

describe('DealtList — every card landed at once', () => {
  it('deal off: no observer, no attribute on the list', () => {
    dealt(<DealtList data-testid="list">{cards(2)}</DealtList>, { VITE_ANIM_DEAL: 'false' })
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(card(1)).toHaveAttribute('data-deal', 'landed')
    expect(FakeIO.instances).toHaveLength(0)
    expect(screen.getByTestId('list')).not.toHaveAttribute('data-deal-list')
  })

  it('reduced motion', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    dealt(<DealtList>{cards(1)}</DealtList>)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(FakeIO.instances).toHaveLength(0)
  })

  it('no IntersectionObserver (jsdom), also for cards added later', async () => {
    vi.unstubAllGlobals()
    const { rerender } = render(<DealtList>{cards(1)}</DealtList>)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    rerender(<DealtList>{cards(2)}</DealtList>)
    await waitFor(() => expect(card(1)).toHaveAttribute('data-deal', 'landed'))
  })

  it('turning the deal off mid-way lands the waiting and the flying cards', () => {
    let listener = null
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: (t, fn) => { listener = fn }, removeEventListener: () => {} }))
    dealt(<DealtList>{cards(2)}</DealtList>)
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
    act(() => listener({ matches: true }))
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(card(1)).toHaveAttribute('data-deal', 'landed')
  })
})

describe('DealtList — the origin of a batch', () => {
  function Shell({ pile = true, pageDeck = true }) {
    return (
      <div className="book-shell" data-testid="shell">
        <div className="book-page-right">
          <DealtList>{cards(1)}</DealtList>
          {pageDeck && <div className="deck" data-testid="page-deck" />}
        </div>
        {pile && <div className="deck-pile"><div className="deck-pile__top" data-testid="pile-top" /></div>}
      </div>
    )
  }

  it('the top card of the table pile of the same book (v1.15.0: on the copy, flagged `table`)', () => {
    dealt(<Shell />)
    place(screen.getByTestId('pile-top'), rect(900, 500, 80, 120)) // centre 940, 560
    place(screen.getByTestId('page-deck'), rect(10, 10, 10, 10))
    place(card(0), rect(100, 100, 100, 150)) // centre 150, 175
    expect(dealOrigin(card(0))).toEqual({ x: 940, y: 560, table: true })
    io().fire([card(0)])
    const [copy] = copies()
    expect(copy.style.getPropertyValue('--from-x')).toBe('790px')
    expect(copy.style.getPropertyValue('--from-y')).toBe('385px')
    expect(card(0).style.getPropertyValue('--from-x')).toBe('')
  })

  it('the page deck when the pile is not displayed (phones: the card itself flies, no copy)', () => {
    dealt(<Shell />)
    place(screen.getByTestId('pile-top'), rect(0, 0, 0, 0))
    place(screen.getByTestId('page-deck'), rect(400, 600, 50, 80)) // centre 425, 640
    place(card(0), rect(100, 100, 100, 150))
    io().fire([card(0)])
    expect(copies()).toHaveLength(0)
    expect(card(0)).not.toHaveAttribute('data-deal-copy')
    expect(card(0)).toHaveAttribute('data-deal-face', 'down')
    expect(card(0).style.getPropertyValue('--from-x')).toBe('275px')
    expect(card(0).style.getPropertyValue('--from-y')).toBe('465px')
  })

  it('the bottom-right corner of the screen when neither is there', () => {
    dealt(<Shell pile={false} pageDeck={false} />)
    place(card(0), rect(100, 100, 100, 150))
    io().fire([card(0)])
    expect(card(0).style.getPropertyValue('--from-x')).toBe(`${window.innerWidth - 150}px`)
    expect(card(0).style.getPropertyValue('--from-y')).toBe(`${window.innerHeight - 175}px`)
    const loose = document.createElement('div')
    expect(dealOrigin(loose)).toEqual({ x: window.innerWidth, y: window.innerHeight })
  })

  it('step 15 — the cards wait while the routes\' book is busy (its first-load opening), then are dealt', async () => {
    const waapi = installWaapi()
    try {
      const anim = { cover: true, reduced: false, turn: true, turnMode: 'full', timings: { open: 650 } }
      dealt(
        <RouteBook location={{ pathname: '/', key: 'k0' }} anim={anim}>
          {() => <div className="book-wrapper"><Shell /></div>}
        </RouteBook>,
      )
      expect(card(0)).toHaveAttribute('data-deal', 'waiting')
      expect(io().targets.size).toBe(0)
      await act(async () => { waapi.finishAll() })
      expect(io().targets.size).toBe(1)
      io().fire([card(0)])
      expect(card(0)).toHaveAttribute('data-deal', 'flying')
    } finally {
      waapi.restore()
    }
  })
})

describe('DealtList — v1.15.0: from the table deck the flight runs on a copy on <body>', () => {
  function Table({ n = 2, hold = false, children = cards(n) }) {
    return (
      <div className="book-shell">
        <div className="book-page-right"><DealtList hold={hold}>{children}</DealtList></div>
        <div className="deck-pile"><div className="deck-pile__top" data-testid="pile-top" /></div>
      </div>
    )
  }
  const onTable = () => place(screen.getByTestId('pile-top'), rect(900, 500, 80, 120))

  it('a clean, inert copy on the slot box flies face down; the real card waits hidden in its slot', () => {
    dealt(<Table />)
    onTable()
    place(card(0), rect(100, 120, 90, 135))
    place(card(1), rect(200, 120, 90, 135))
    io().fire([card(0), card(1)])
    const all = copies()
    expect(all).toHaveLength(2)
    const [copy, second] = all
    expect(copy.parentNode).toBe(document.body)
    expect(copy).toHaveClass('pg-card', 'deal-copy')
    expect(copy).toHaveAttribute('aria-hidden', 'true')
    expect(copy).toHaveAttribute('inert')
    expect(copy).not.toHaveAttribute('data-testid')
    expect(copy).not.toHaveAttribute('data-deal-copy')
    expect(copy).toHaveAttribute('data-deal', 'flying')
    expect(copy).toHaveAttribute('data-deal-face', 'down')
    expect([copy.style.left, copy.style.top, copy.style.width, copy.style.height]).toEqual(['100px', '120px', '90px', '135px'])
    expect(copy.style.getPropertyValue('--card-w')).toBe('90px')
    expect(copy.style.getPropertyValue('--deal-i')).toBe('0')
    expect(second.style.getPropertyValue('--deal-i')).toBe('1')
    ;[card(0), card(1)].forEach(c => {
      expect(c).toHaveAttribute('data-deal', 'flying')
      expect(c).toHaveAttribute('data-deal-copy', 'on')
      expect(c).not.toHaveAttribute('data-deal-face')
    })
  })

  it('face up when VITE_ANIM_DEAL_FACEDOWN=false: the attribute is on the copy', () => {
    dealt(<Table n={1} />, { ...SPEED_1, VITE_ANIM_DEAL_FACEDOWN: 'false' })
    onTable()
    io().fire([card(0)])
    expect(copies()[0]).toHaveAttribute('data-deal-face', 'up')
  })

  it('the page\'s inherited text styles go on the copy (it leaves the page for <body>)', () => {
    const real = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, ...rest) => (el?.classList?.contains('pg-card')
      ? { getPropertyValue: name => ({ color: 'rgb(1, 2, 3)', 'text-align': 'center' })[name] ?? '' }
      : real(el, ...rest)))
    dealt(<Table n={1} />)
    onTable()
    io().fire([card(0)])
    const [copy] = copies()
    expect(copy.style.color).toBe('rgb(1, 2, 3)')
    expect(copy.style.textAlign).toBe('center')
    expect(copy.style.fontFamily).toBe('')
  })

  it('lands when its copy ends: the copy removed and the card shown in the same frame; the card\'s own end is ignored', () => {
    dealt(<Table n={1} />)
    onTable()
    io().fire([card(0)])
    const [copy] = copies()
    fireEvent.animationEnd(card(0))
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
    fireEvent.animationEnd(copy.firstChild ?? copy.appendChild(document.createElement('i')))
    expect(copies()).toHaveLength(1)
    fireEvent.animationEnd(copy)
    expect(copies()).toHaveLength(0)
    expect(copy.isConnected).toBe(false)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(card(0)).not.toHaveAttribute('data-deal-copy')
  })

  it('the safety timer removes the copies and lands the cards (deal + dealStep × i + 200 ms)', () => {
    vi.useFakeTimers()
    dealt(<Table />)
    onTable()
    io().fire([card(0), card(1)])
    act(() => { vi.advanceTimersByTime(820) })
    expect(copies()).toHaveLength(1)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    act(() => { vi.advanceTimersByTime(110) })
    expect(copies()).toHaveLength(0)
    expect(card(1)).toHaveAttribute('data-deal', 'landed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('an unmount mid-flight removes the copies and lands the cards', () => {
    vi.useFakeTimers()
    const { unmount } = dealt(<Table />)
    onTable()
    const [a, b] = [card(0), card(1)]
    io().fire([a, b])
    expect(copies()).toHaveLength(2)
    unmount()
    expect(copies()).toHaveLength(0)
    expect(a).toHaveAttribute('data-deal', 'landed')
    expect(b).not.toHaveAttribute('data-deal-copy')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a page turn or a book change (the deal held) mid-flight removes the copies and lands the cards', () => {
    const { rerender } = dealt(<Table />)
    onTable()
    io().fire([card(0)])
    expect(copies()).toHaveLength(1)
    rerender(<AnimationProvider env={SPEED_1}><Table hold /></AnimationProvider>)
    expect(copies()).toHaveLength(0)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
    expect(card(1)).toHaveAttribute('data-deal', 'waiting')
  })

  // v1.15.0 to-do 18 — the copies in flight follow their slots (a frame loop and window scrolls), stopped when none flies.
  function frames() {
    const queue = []
    let id = 0
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { queue.push(cb); id += 1; return id })
    const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const scrolls = spy => spy.mock.calls.filter(([type]) => type === 'scroll')
    return { raf, caf, run: () => act(() => { queue.splice(0).forEach(cb => cb(0)) }), added: () => scrolls(add),
      removed: () => scrolls(remove), last: () => id }
  }
  const boxOf = el => [el.style.left, el.style.top, el.style.width, el.style.height, el.style.getPropertyValue('--card-w')]

  it('a slot moved mid-flight: the copy follows it on the next frame and on a scroll; all stops after the last landing', () => {
    const f = frames()
    dealt(<Table />)
    onTable()
    place(card(0), rect(100, 400, 90, 135))
    place(card(1), rect(200, 400, 90, 135))
    io().fire([card(0), card(1)])
    const [a, b] = copies()
    expect(f.raf).toHaveBeenCalledOnce()
    expect(f.added()).toHaveLength(1)
    expect(f.added()[0][2]).toEqual({ capture: true, passive: true })
    place(card(0), rect(100, 300, 90, 135))
    f.run()
    expect(boxOf(a)).toEqual(['100px', '300px', '90px', '135px', '90px'])
    expect(boxOf(b)).toEqual(['200px', '400px', '90px', '135px', '90px'])
    expect(f.raf).toHaveBeenCalledTimes(2)
    place(card(0), rect(100, 250, 80, 120))
    place(card(1), rect(200, 250, 80, 120))
    fireEvent.scroll(card(0).parentNode)
    expect(boxOf(a)).toEqual(['100px', '250px', '80px', '120px', '80px'])
    expect(boxOf(b)[1]).toBe('250px')
    fireEvent.animationEnd(a)
    expect(f.caf).not.toHaveBeenCalled()
    expect(f.removed()).toHaveLength(0)
    place(card(1), rect(200, 200, 80, 120))
    f.run()
    expect(boxOf(b)[1]).toBe('200px')
    fireEvent.animationEnd(b)
    expect(f.caf).toHaveBeenCalledWith(f.last())
    expect(f.removed()).toHaveLength(1)
    expect(f.removed()[0][1]).toBe(f.added()[0][1])
    expect(card(1)).toHaveAttribute('data-deal', 'landed')
  })

  it('an unmount or a hold mid-flight stops the loop and the scroll listener; a new flight starts them again', () => {
    const f = frames()
    const { rerender, unmount } = dealt(<Table />)
    onTable()
    io().fire([card(0)])
    rerender(<AnimationProvider env={SPEED_1}><Table hold /></AnimationProvider>)
    expect(f.caf).toHaveBeenCalledOnce()
    expect(f.removed()).toHaveLength(1)
    rerender(<AnimationProvider env={SPEED_1}><Table /></AnimationProvider>)
    onTable()
    io().fire([card(1)])
    expect(f.added()).toHaveLength(2)
    unmount()
    expect(f.caf).toHaveBeenCalledTimes(2)
    expect(f.removed()).toHaveLength(2)
    expect(copies()).toHaveLength(0)
  })

  it('phones (the page deck, the card itself flies in the page): no loop, no scroll listener', () => {
    const f = frames()
    dealt(<div className="book-page-right"><DealtList>{cards(1)}</DealtList><div className="deck" data-testid="page-deck" /></div>)
    place(screen.getByTestId('page-deck'), rect(400, 600, 50, 80))
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
    expect(f.raf).not.toHaveBeenCalled()
    expect(f.added()).toHaveLength(0)
    fireEvent.animationEnd(card(0))
    expect(f.caf).not.toHaveBeenCalled()
  })

  it('a hidden card reached with the keyboard while its copy flies lands at once', () => {
    dealt(<Table><div className="pg-card" data-testid="c0"><button>go</button></div></Table>)
    onTable()
    io().fire([card(0)])
    fireEvent.focusIn(card(0).querySelector('button'))
    expect(copies()).toHaveLength(0)
    expect(card(0)).toHaveAttribute('data-deal', 'landed')
  })
})

describe('useDeal — defensive paths', () => {
  it('a ref never attached to a list does nothing, and still says whether the deal is on', () => {
    let on = null
    function Bare() { const ref = useRef(null); on = useDeal(ref); return null }
    expect(() => dealt(<Bare />)).not.toThrow()
    expect(on).toBe(true)
    expect(FakeIO.instances).toHaveLength(0)
  })

  it('a card removed from the list changes nothing for the others', async () => {
    const { rerender } = dealt(<DealtList>{cards(2)}</DealtList>)
    const first = card(0)
    rerender(<AnimationProvider env={SPEED_1}><DealtList>{cards(1)}</DealtList></AnimationProvider>)
    await act(async () => {})
    expect(first).toHaveAttribute('data-deal', 'waiting')
    expect(screen.queryByTestId('c1')).toBeNull()
  })

  it('without MutationObserver the cards present at mount are still dealt', () => {
    vi.stubGlobal('MutationObserver', undefined)
    dealt(<DealtList>{cards(1)}</DealtList>)
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
  })
})

describe('DealtList — step 15: the page turn of its book holds the deal', () => {
  const ANIM = { turn: true, reduced: false, turnMode: 'full', timings: { flip: 900, simple: 520, fade: 200 } }
  function TurningBook({ pageKey, direction = 'forward', n = 2 }) {
    return (
      <div className="book-wrapper">
        <BookPages anim={ANIM} pageKey={pageKey} direction={direction} left={null}
          right={<DealtList key={pageKey}>{cards(n)}</DealtList>} />
      </div>
    )
  }

  it('the new cards wait while the page turns, never dealt under the sheet, then are dealt', async () => {
    const waapi = installWaapi()
    try {
      const { rerender } = dealt(<TurningBook pageKey={0} />)
      rerender(<AnimationProvider env={SPEED_1}><TurningBook pageKey={1} /></AnimationProvider>)
      expect(card(0)).toHaveAttribute('data-deal', 'waiting')
      expect(io().targets.size).toBe(0)
      await act(async () => { waapi.finishAll() })
      expect(io().targets.size).toBe(2)
      io().fire([card(0), card(1)])
      expect(card(0)).toHaveAttribute('data-deal', 'flying')
    } finally {
      waapi.restore()
    }
  })
})

describe('DealtList — step 16: phones', () => {
  const ANIM = { turn: true, reduced: false, turnMode: 'full', timings: { sheet: 620, simple: 520, fade: 200 } }
  // Only the phone layout matches: the OS reduced motion query stays off.
  const phone = () => { window.matchMedia = vi.fn(q => ({ matches: q.includes('max-width: 767px') })) }

  it('the mobile turn holds the deal too: the new cards wait under the sheet, then are dealt (threshold 0.2)', async () => {
    phone()
    const waapi = installWaapi()
    function PhoneBook({ pageKey }) {
      return (
        <div className="book-wrapper">
          <BookPages anim={ANIM} pageKey={pageKey} direction="forward" left={null}
            right={<DealtList key={pageKey}>{cards(2)}</DealtList>} />
        </div>
      )
    }
    try {
      const { rerender } = dealt(<PhoneBook pageKey={0} />)
      document.querySelector('.book-wrapper').getBoundingClientRect = () => rect(0, 0, 360, 900)
      rerender(<AnimationProvider env={SPEED_1}><PhoneBook pageKey={1} /></AnimationProvider>)
      expect(document.querySelector('body > .m-sheet')).not.toBeNull()
      expect(card(0)).toHaveAttribute('data-deal', 'waiting')
      expect(io().targets.size).toBe(0)
      await act(async () => { waapi.finishAll() })
      expect(document.querySelector('body > .m-sheet')).toBeNull()
      expect(io().options).toEqual({ threshold: 0.2 })
      expect(io().targets.size).toBe(2)
      io().fire([card(0), card(1)])
      expect(card(0)).toHaveAttribute('data-deal', 'flying')
    } finally {
      waapi.restore()
      delete window.matchMedia
    }
  })

  it('the sticky page deck is read again at every batch: it moves while the page scrolls', () => {
    dealt(
      <div className="book-shell">
        <div className="book-page-right">
          <DealtList>{cards(2)}</DealtList>
          <div className="deck" data-testid="page-deck" />
        </div>
      </div>,
    )
    place(card(0), rect(100, 100, 100, 150))
    place(card(1), rect(100, 300, 100, 150))
    place(screen.getByTestId('page-deck'), rect(300, 500, 50, 80)) // centre 325, 540
    io().fire([card(0)])
    expect(card(0).style.getPropertyValue('--from-y')).toBe('365px')
    place(screen.getByTestId('page-deck'), rect(300, 560, 50, 80)) // centre 325, 600
    io().fire([card(1)])
    expect(card(1).style.getPropertyValue('--from-y')).toBe('225px')
  })
})

describe('slotCard', () => {
  it('the slot itself, its first card, or null', () => {
    const slot = document.createElement('div')
    expect(slotCard(slot)).toBeNull()
    slot.innerHTML = '<span></span><div class="pg-card" id="a"></div><div class="pg-card"></div>'
    expect(slotCard(slot).id).toBe('a')
    slot.className = 'pg-card'
    expect(slotCard(slot)).toBe(slot)
    expect(slotCard(document.createTextNode('x'))).toBeNull()
    expect(slotCard(null)).toBeNull()
  })
})
