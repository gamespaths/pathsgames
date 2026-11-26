import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import BookPages, { turnRequest, useBookTurning, HOLD_SAFETY_MS } from '../components/book/BookPages'
import { installWaapi } from './fixtures/waapi'
import RouteBook from '../components/book/RouteBook'

// Step 15 — the turn engine of the Book: snapshot before the commit, strategy after it (WAAPI stubbed).

const ANIM = { turn: true, reduced: false, turnMode: 'full', timings: { flip: 900, simple: 520, fade: 200 } }

function Turning() {
  return <span data-testid="turning">{String(useBookTurning())}</span>
}

function Book({ text = 'page 1', anim = ANIM, ...props }) {
  return (
    <div className="book-wrapper">
      <BookPages anim={anim} left={<><p data-testid="left">{text}</p><Turning /></>} right={<p>{`right of ${text}`}</p>} {...props} />
    </div>
  )
}

const layer = () => document.querySelector('.book-turn-layer')
const turning = () => screen.getByTestId('turning').textContent
const sheets = () => [...document.querySelectorAll('body > .m-sheet')]
/** Step 16 — a phone-sized book on the screen (jsdom has no layout). */
function onPhone() {
  const book = document.querySelector('.book-wrapper')
  book.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 900, right: 360, bottom: 900 })
  return book
}

let waapi
beforeEach(() => { waapi = installWaapi() })
afterEach(() => {
  waapi.restore()
  delete window.matchMedia
  vi.useRealTimers()
  document.documentElement.classList.remove('is-turning')
})

describe('turnRequest', () => {
  it('reads hold, release, the page key (which wins over the chapter) and the chapter', () => {
    const base = { pageKey: 1, direction: 'forward', holdTurn: false, chapterKind: null }
    expect(turnRequest(base, { ...base, holdTurn: true })).toBe('hold')
    expect(turnRequest({ ...base, holdTurn: true }, base)).toBe('release')
    expect(turnRequest({ ...base, holdTurn: true }, { ...base, holdTurn: true, pageKey: 2 })).toBeNull()
    expect(turnRequest(base, { ...base, pageKey: 2, direction: 'back' })).toBe('back')
    expect(turnRequest(base, { ...base, pageKey: 2, direction: null })).toBeNull()
    expect(turnRequest(base, { ...base, pageKey: 2, direction: 'fade', chapterKind: null })).toBe('fade')
    expect(turnRequest(base, { ...base, chapterKind: 'privacy' })).toBe('forward')
    expect(turnRequest({ ...base, chapterKind: 'privacy' }, base)).toBe('back')
    expect(turnRequest({ ...base, chapterKind: 'roadmap' }, { ...base, chapterKind: 'credits' })).toBe('forward')
    // ONE commit with the chapter closing and the close card fading: the page's fade wins
    expect(turnRequest({ ...base, chapterKind: 'privacy' }, { ...base, pageKey: 2, direction: 'fade' })).toBe('fade')
    expect(turnRequest(base, base)).toBeNull()
  })
})

describe('useBookTurning — step 15', () => {
  it('also true while the routes\' book is busy (its opening, a book change, a route turn)', async () => {
    const anim = { cover: true, turn: true, turnMode: 'full', reduced: false, timings: { open: 650 } }
    render(
      <RouteBook location={{ pathname: '/', key: 'k' }} anim={anim}>
        {() => <Book />}
      </RouteBook>,
    )
    expect(turning()).toBe('true')
    await act(async () => { waapi.finishAll() })
    expect(turning()).toBe('false')
  })
})

describe('BookPages', () => {
  it('renders the spine, the two pages and an empty, hidden turn layer', () => {
    render(<Book />)
    const wrapper = document.querySelector('.book-wrapper')
    expect(wrapper.querySelector(':scope > .book-spine')).not.toBeNull()
    expect(wrapper.querySelector(':scope > .book-page-left .page-inner')).toHaveTextContent('page 1')
    expect(wrapper.querySelector(':scope > .book-page-right')).toHaveTextContent('right of page 1')
    expect(layer()).toBeEmptyDOMElement()
    expect(layer()).toHaveAttribute('aria-hidden', 'true')
    expect(turning()).toBe('false')
  })

  it('a new key turns the page in its direction: the old pages copied over the new ones, then removed', async () => {
    const { rerender } = render(<Book pageKey={0} direction={null} />)
    rerender(<Book text="page 2" pageKey={1} direction="forward" />)
    expect(screen.getByTestId('left')).toHaveTextContent('page 2')
    const flipper = layer().querySelector('.page-flipper.is-fwd')
    expect(flipper.querySelector('.flip-front')).toHaveTextContent('right of page 1')
    expect(flipper.querySelector('.flip-back')).toHaveTextContent('page 2')
    expect(layer().querySelector(':scope > .book-page-left')).toHaveTextContent('page 1')
    expect(turning()).toBe('true')
    await act(async () => { waapi.finishAll() })
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('false')
  })

  it('simple mode swings the live pages, a fade fades the copies', async () => {
    const { rerender } = render(<Book pageKey={0} anim={{ ...ANIM, turnMode: 'simple' }} />)
    rerender(<Book pageKey={1} direction="back" anim={{ ...ANIM, turnMode: 'simple' }} />)
    expect(layer()).toBeEmptyDOMElement()
    expect(waapi.animations.at(-1).keyframes[0].transform).toContain('rotateY(35deg)')
    await act(async () => { waapi.finishAll() })
    rerender(<Book pageKey={2} direction="fade" anim={{ ...ANIM, turnMode: 'simple' }} />)
    expect(layer().children).toHaveLength(2)
    expect(waapi.animations.at(-1).keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
  })

  it('a new key with no direction (none) changes the pages with no turn', () => {
    const { rerender } = render(<Book pageKey={0} />)
    rerender(<Book text="page 2" pageKey={1} direction={null} />)
    expect(layer()).toBeEmptyDOMElement()
    expect(waapi.animations).toHaveLength(0)
    expect(turning()).toBe('false')
  })

  it('does nothing with the turn flag off, under reduced motion or without WAAPI', () => {
    const { rerender } = render(<Book pageKey={0} anim={{ ...ANIM, turn: false }} />)
    rerender(<Book pageKey={1} direction="forward" anim={{ ...ANIM, turn: false }} />)
    rerender(<Book pageKey={2} direction="forward" anim={{ ...ANIM, reduced: true }} />)
    expect(waapi.animations).toHaveLength(0)
    waapi.restore()
    rerender(<Book pageKey={3} direction="forward" />)
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('false')
  })

  it('mobile (step 16): the visible slice turns on a sheet on <body>; a fade never turns the Book (FadeIn does)', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const { rerender } = render(<Book pageKey={0} />)
    onPhone()
    rerender(<Book text="page 2" pageKey={1} direction="forward" />)
    expect(screen.getByTestId('left')).toHaveTextContent('page 2')
    expect(layer()).toBeEmptyDOMElement()
    expect(sheets()).toHaveLength(1)
    expect(sheets()[0].textContent).toContain('page 1')
    expect(document.documentElement).toHaveClass('is-turning')
    expect(turning()).toBe('true')
    await act(async () => { waapi.finishAll() })
    expect(sheets()).toHaveLength(0)
    expect(document.documentElement).not.toHaveClass('is-turning')
    expect(turning()).toBe('false')
    rerender(<Book text="page 3" pageKey={2} direction="fade" />)
    expect(sheets()).toHaveLength(0)
    expect(waapi.running()).toHaveLength(0)
    expect(turning()).toBe('false')
  })

  it('mobile: the hold is the still sheet; the release turns it; the 10 s safety and unmount take it away', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    vi.useFakeTimers()
    const { rerender, unmount } = render(<Book pageKey={0} />)
    onPhone()
    rerender(<Book text="loading" pageKey={1} holdTurn />)
    expect(sheets()).toHaveLength(1)
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('true')
    rerender(<Book text="page 2" pageKey={2} direction="back" holdTurn={false} />)
    expect(sheets()).toHaveLength(2)
    expect(waapi.running()[0].keyframes[0].transform).toContain('rotateY(-90deg)')
    rerender(<Book text="page 3" pageKey={3} holdTurn />)
    expect(sheets()).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(HOLD_SAFETY_MS) })
    expect(sheets()).toHaveLength(0)
    expect(turning()).toBe('false')
    rerender(<Book text="page 4" pageKey={4} holdTurn={false} direction={null} />)
    rerender(<Book text="page 5" pageKey={5} holdTurn />)
    expect(sheets()).toHaveLength(1)
    unmount()
    expect(sheets()).toHaveLength(0)
    expect(document.querySelector('.m-blocker')).toBeNull()
  })

  // Step 15 §9 — every page change goes back to the very top on phones, also when no strategy runs.
  it('phones with the engine off: a forward or back page change jumps to the top once; a fade, a chapter and desktop never', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0 })
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const off = { ...ANIM, turn: false }
    const { rerender } = render(<Book pageKey={0} anim={off} />)
    rerender(<Book pageKey={1} direction="forward" anim={off} />)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    rerender(<Book pageKey={2} direction="back" anim={{ ...ANIM, reduced: true }} />)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    rerender(<Book pageKey={3} direction="fade" anim={off} />)
    rerender(<Book pageKey={3} direction="fade" anim={off} chapterKind="privacy" />)
    rerender(<Book pageKey={3} direction="fade" anim={off} />)
    rerender(<Book pageKey={3} direction="fade" anim={off} text="same key" />)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    window.matchMedia = vi.fn(() => ({ matches: false }))
    rerender(<Book pageKey={4} direction="forward" anim={off} />)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('a phone copy cannot turn on the desktop layout (rotated past the breakpoint during a hold): it is dropped', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const { rerender } = render(<Book pageKey={0} />)
    onPhone()
    rerender(<Book pageKey={1} holdTurn />)
    expect(sheets()).toHaveLength(1)
    window.matchMedia = vi.fn(() => ({ matches: false }))
    rerender(<Book pageKey={2} direction="forward" holdTurn={false} />)
    expect(sheets()).toHaveLength(0)
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('false')
  })

  it('hold on keeps the old pages; key changes meanwhile are ignored; release turns ONE page', async () => {
    const { rerender } = render(<Book pageKey={0} direction={null} />)
    rerender(<Book text="loading" pageKey={1} direction={null} holdTurn />)
    expect(layer().children).toHaveLength(2)
    expect(layer().textContent).toContain('page 1')
    expect(waapi.animations).toHaveLength(0)
    expect(turning()).toBe('true')
    rerender(<Book text="page 2" pageKey={2} direction="fade" holdTurn />)
    expect(waapi.animations).toHaveLength(0)
    rerender(<Book text="page 2" pageKey={3} direction="forward" holdTurn={false} />)
    expect(layer().querySelector('.page-flipper.is-fwd')).not.toBeNull()
    expect(layer().querySelector('.flip-back')).toHaveTextContent('page 2')
    expect(turning()).toBe('true')
    await act(async () => { waapi.finishAll() })
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('false')
  })

  it('release with no direction (a refetch) drops the copy without a turn', () => {
    const { rerender } = render(<Book pageKey={0} />)
    rerender(<Book pageKey={1} direction={null} holdTurn />)
    rerender(<Book pageKey={2} direction={null} holdTurn={false} />)
    expect(layer()).toBeEmptyDOMElement()
    expect(waapi.animations).toHaveLength(0)
    expect(turning()).toBe('false')
  })

  it('a hold never outlives 10 s; a later release then has nothing to turn', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Book pageKey={0} />)
    rerender(<Book pageKey={1} holdTurn />)
    expect(layer().children).toHaveLength(2)
    act(() => { vi.advanceTimersByTime(HOLD_SAFETY_MS - 1) })
    expect(layer().children).toHaveLength(2)
    act(() => { vi.advanceTimersByTime(1) })
    expect(layer()).toBeEmptyDOMElement()
    expect(turning()).toBe('false')
    rerender(<Book pageKey={2} direction="forward" holdTurn={false} />)
    expect(waapi.animations).toHaveLength(0)
  })

  it('a new change during a running turn finishes it at once, then starts', () => {
    const { rerender } = render(<Book pageKey={0} />)
    rerender(<Book pageKey={1} direction="fade" />)
    const first = waapi.running()
    expect(first).toHaveLength(2)
    rerender(<Book pageKey={2} direction="fade" />)
    first.forEach(a => expect(a.finish).toHaveBeenCalled())
    expect(waapi.running()).toHaveLength(2)
    expect(layer().children).toHaveLength(2)
  })

  it('the policy chapter turns forward when it opens and back when it closes', () => {
    const { rerender } = render(<Book pageKey={0} chapterKind={null} />)
    rerender(<Book pageKey={0} chapterKind="privacy" />)
    expect(layer().querySelector('.page-flipper.is-fwd')).not.toBeNull()
    rerender(<Book pageKey={0} chapterKind={null} />)
    expect(layer().querySelector('.page-flipper.is-back')).not.toBeNull()
  })

  it('unmounting during a turn leaves no copy behind', () => {
    const { rerender, unmount } = render(<Book pageKey={0} />)
    rerender(<Book pageKey={1} direction="forward" />)
    const l = layer()
    expect(l.children.length).toBeGreaterThan(0)
    unmount()
    expect(l.children).toHaveLength(0)
  })

  it('tells its Book when the pages start and stop turning or holding (the Book goes inert meanwhile)', async () => {
    const onTurningChange = vi.fn()
    const { rerender, unmount } = render(<Book pageKey={0} onTurningChange={onTurningChange} />)
    rerender(<Book pageKey={1} direction="fade" onTurningChange={onTurningChange} />)
    expect(onTurningChange).toHaveBeenLastCalledWith(true)
    await act(async () => { waapi.finishAll() })
    expect(onTurningChange).toHaveBeenLastCalledWith(false)
    rerender(<Book pageKey={2} holdTurn onTurningChange={onTurningChange} />)
    expect(onTurningChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onTurningChange).toHaveBeenLastCalledWith(false)
    expect(onTurningChange).toHaveBeenCalledTimes(4)
  })

  it('unmounting during a hold clears its safety timer', () => {
    vi.useFakeTimers()
    const { rerender, unmount } = render(<Book pageKey={0} />)
    rerender(<Book pageKey={1} holdTurn />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
