import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import DealtList from '../components/layout/DealtList'
import useDeal, { slotCard, dealOrigin } from '../hooks/useDeal'
import { AnimationProvider } from '../context/AnimationContext'
import BookPages from '../components/book/BookPages'
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
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

  it('the top card of the table pile of the same book', () => {
    dealt(<Shell />)
    place(screen.getByTestId('pile-top'), rect(900, 500, 80, 120)) // centre 940, 560
    place(screen.getByTestId('page-deck'), rect(10, 10, 10, 10))
    place(card(0), rect(100, 100, 100, 150)) // centre 150, 175
    io().fire([card(0)])
    expect(card(0).style.getPropertyValue('--from-x')).toBe('790px')
    expect(card(0).style.getPropertyValue('--from-y')).toBe('385px')
  })

  it('the page deck when the pile is not displayed', () => {
    dealt(<Shell />)
    place(screen.getByTestId('pile-top'), rect(0, 0, 0, 0))
    place(screen.getByTestId('page-deck'), rect(400, 600, 50, 80)) // centre 425, 640
    place(card(0), rect(100, 100, 100, 150))
    io().fire([card(0)])
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

  it('waits for the book to finish opening before measuring the first batch', async () => {
    let finish
    dealt(<Shell />)
    screen.getByTestId('shell').getAnimations = () => [
      { playState: 'running', finished: new Promise(r => { finish = r }) },
      { playState: 'finished', finished: Promise.resolve() },
    ]
    io().fire([card(0)])
    expect(card(0)).toHaveAttribute('data-deal', 'waiting')
    await act(async () => { finish() })
    expect(card(0)).toHaveAttribute('data-deal', 'flying')
  })

  it('a cancelled opening still deals; an unmount during it does not', async () => {
    dealt(<Shell />)
    screen.getByTestId('shell').getAnimations = () => [{ playState: 'running', finished: Promise.reject(new Error('cancel')) }]
    io().fire([card(0)])
    await waitFor(() => expect(card(0)).toHaveAttribute('data-deal', 'flying'))

    FakeIO.instances = []
    let finish
    const { unmount } = dealt(<Shell />)
    const later = screen.getAllByTestId('c0')[1]
    screen.getAllByTestId('shell')[1].getAnimations = () => [{ playState: 'running', finished: new Promise(r => { finish = r }) }]
    io().fire([later])
    unmount()
    await act(async () => { finish() })
    expect(later).toHaveAttribute('data-deal', 'waiting')
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
