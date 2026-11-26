import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import TooltipLayer, { LONG_PRESS_MS, TOUCH_HIDE_MS, placeTooltip, tipTarget } from '../components/ui/TooltipLayer'
import BonusBadgeList from '../components/ui/BonusBadgeList'

// v1.13.0 — the drawn tooltip of every [data-tip] target (6.3.14).

function Nav() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/elsewhere')}>go</button>
}

function setup({ withTarget = true } = {}) {
  const onTab = vi.fn()
  const utils = render(
    <MemoryRouter>
      <TooltipLayer />
      {withTarget && (
        <button data-tip="Back to the home page" aria-label="Back to the home page" onClick={onTab} data-testid="tab">
          <i className="fas fa-home" data-testid="icon" />
        </button>
      )}
      <span data-testid="plain">plain</span>
      <span data-tip="" data-testid="empty-tip">empty</span>
      <Nav />
    </MemoryRouter>,
  )
  return { ...utils, onTab, tab: () => screen.getByTestId('tab') }
}

const tooltip = () => screen.getByTestId('pg-tooltip')
const shown = () => !tooltip().hasAttribute('hidden')

describe('TooltipLayer — mouse and keyboard', () => {
  afterEach(() => { delete window.matchMedia })

  it('is one hidden, inert element on <body> (hidden attribute: no layout space)', () => {
    setup()
    const tip = tooltip()
    expect(tip.parentElement).toBe(document.body)
    expect(tip).toHaveClass('pg-tooltip')
    expect(tip).toHaveAttribute('aria-hidden', 'true')
    expect(tip).toHaveAttribute('hidden')
    expect(tip.style.visibility).toBe('')
  })

  it('mouse hover shows the tip text; leaving the target hides it, moving onto its icon does not', () => {
    const { tab } = setup()
    fireEvent.pointerOver(screen.getByTestId('icon'), { pointerType: 'mouse' })
    expect(shown()).toBe(true)
    expect(tooltip()).toHaveTextContent('Back to the home page')
    fireEvent.pointerOut(tab(), { pointerType: 'mouse', relatedTarget: screen.getByTestId('icon') })
    expect(shown()).toBe(true)
    fireEvent.pointerOut(tab(), { pointerType: 'mouse', relatedTarget: screen.getByTestId('plain') })
    expect(shown()).toBe(false)
  })

  it('a pointer over an element without a tip (or an empty one) shows nothing', () => {
    setup()
    fireEvent.pointerOver(screen.getByTestId('plain'), { pointerType: 'mouse' })
    fireEvent.pointerOver(screen.getByTestId('empty-tip'), { pointerType: 'mouse' })
    expect(shown()).toBe(false)
  })

  it('no hover on a device that cannot hover, and none for a touch pointer', () => {
    const { tab } = setup()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(shown()).toBe(false)
    expect(window.matchMedia).toHaveBeenCalledWith('(hover: hover)')
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    fireEvent.pointerOver(tab(), { pointerType: 'touch' })
    expect(shown()).toBe(false)
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(shown()).toBe(true)
  })

  it('works without matchMedia (jsdom): hover still shows', () => {
    delete window.matchMedia
    const { tab } = setup()
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(shown()).toBe(true)
  })

  it('keyboard focus shows it, Escape and the blur hide it', () => {
    const { tab } = setup()
    fireEvent.keyDown(document, { key: 'Tab' })
    act(() => tab().focus())
    expect(shown()).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(shown()).toBe(false)
    act(() => { tab().blur(); tab().focus() })
    expect(shown()).toBe(true)
    act(() => tab().blur())
    expect(shown()).toBe(false)
  })

  it('a focus that follows a click (not :focus-visible) shows nothing', () => {
    const { tab } = setup()
    fireEvent.pointerDown(tab(), { pointerType: 'mouse' })
    act(() => tab().focus())
    expect(shown()).toBe(false)
  })

  it('a focus that matches :focus-visible shows it even before any key', () => {
    const { tab } = setup()
    const matches = vi.spyOn(Element.prototype, 'matches').mockImplementation(() => true)
    act(() => tab().focus())
    expect(shown()).toBe(true)
    matches.mockRestore()
  })

  it('a browser where :focus-visible throws falls back to the input modality', () => {
    const { tab } = setup()
    const matches = vi.spyOn(Element.prototype, 'matches').mockImplementation(() => { throw new Error('bad selector') })
    act(() => tab().focus())
    expect(shown()).toBe(false)
    matches.mockRestore()
  })

  it('hides on pointerdown, scroll, resize and a route change', () => {
    const { tab } = setup()
    const show = () => fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    show(); fireEvent.pointerDown(screen.getByTestId('plain'), { pointerType: 'mouse' })
    expect(shown()).toBe(false)
    show(); fireEvent.scroll(screen.getByTestId('plain'))
    expect(shown()).toBe(false)
    show(); fireEvent(window, new Event('resize'))
    expect(shown()).toBe(false)
    show(); fireEvent.click(screen.getByText('go'))
    expect(shown()).toBe(false)
  })

  it('hides when its target leaves the DOM', async () => {
    const { rerender } = setup()
    fireEvent.pointerOver(screen.getByTestId('tab'), { pointerType: 'mouse' })
    expect(shown()).toBe(true)
    rerender(<MemoryRouter><TooltipLayer /></MemoryRouter>)
    await act(async () => {})
    expect(shown()).toBe(false)
  })
})

describe('TooltipLayer — touch long press', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const press = (el, x = 10, y = 10) => fireEvent.pointerDown(el, { pointerType: 'touch', clientX: x, clientY: y })

  it('a plain tap never shows it, and runs the tab', () => {
    const { tab, onTab } = setup()
    press(tab())
    act(() => vi.advanceTimersByTime(100))
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    fireEvent.click(tab())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2))
    expect(shown()).toBe(false)
    expect(onTab).toHaveBeenCalledOnce()
  })

  it('shows at 500 ms and not before; hides 1.5 s after the lift; the next click is swallowed once', () => {
    const { tab, onTab } = setup()
    press(tab())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1))
    expect(shown()).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(shown()).toBe(true)
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    // the click of the long press: never opens the tab
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    tab().dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(onTab).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(TOUCH_HIDE_MS - 1))
    expect(shown()).toBe(true)
    act(() => vi.advanceTimersByTime(1))
    expect(shown()).toBe(false)
    // the following tap works
    press(tab())
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    fireEvent.click(tab())
    expect(onTab).toHaveBeenCalledOnce()
  })

  it('the swallow flag is cleared by the next pointerdown when no click followed', () => {
    const { tab, onTab } = setup()
    press(tab())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    press(screen.getByTestId('plain'))
    fireEvent.pointerUp(screen.getByTestId('plain'), { pointerType: 'touch' })
    fireEvent.click(tab())
    expect(onTab).toHaveBeenCalledOnce()
  })

  it('a finger move of more than 10 px cancels it; a smaller one does not', () => {
    const { tab } = setup()
    press(tab(), 10, 10)
    fireEvent.pointerMove(tab(), { pointerType: 'touch', clientX: 15, clientY: 14 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(true)
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    press(tab(), 10, 10)
    fireEvent.pointerMove(tab(), { pointerType: 'touch', clientX: 30, clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(false)
  })

  it('an early lift, a pointercancel or a scroll cancel it', () => {
    const { tab, onTab } = setup()
    press(tab())
    act(() => vi.advanceTimersByTime(300))
    fireEvent.pointerUp(tab(), { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(false)
    fireEvent.click(tab())
    expect(onTab).toHaveBeenCalledOnce()

    press(tab())
    fireEvent.pointerCancel(tab(), { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(false)

    press(tab())
    fireEvent.scroll(document)
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(false)
  })

  it('once shown, a scroll or a pointercancel hides it at once', () => {
    const { tab } = setup()
    press(tab())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(true)
    fireEvent.scroll(document)
    expect(shown()).toBe(false)
    press(tab())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    fireEvent.pointerCancel(tab(), { pointerType: 'touch' })
    expect(shown()).toBe(false)
  })

  it('a touch on an element without a tip starts nothing', () => {
    setup()
    press(screen.getByTestId('plain'))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(shown()).toBe(false)
  })

  it('prevents the system menu of a long press on a [data-tip] target only', () => {
    const { tab } = setup()
    press(tab())
    expect(fireEvent.contextMenu(tab())).toBe(false)
    expect(fireEvent.contextMenu(screen.getByTestId('plain'))).toBe(true)
  })

  it('a right click with the mouse keeps its menu', () => {
    const { tab } = setup()
    fireEvent.pointerDown(tab(), { pointerType: 'mouse' })
    expect(fireEvent.contextMenu(tab())).toBe(true)
  })

  it('cleans its timers up on unmount', () => {
    const { tab, unmount } = setup()
    press(tab())
    unmount()
    expect(() => act(() => vi.advanceTimersByTime(LONG_PRESS_MS))).not.toThrow()
  })
})

describe('TooltipLayer — placement', () => {
  const VIEW = { width: 400 }
  const TIP = { width: 80, height: 30 }
  const rect = (top, left, width = 40, height = 30) => ({ top, left, width, height, bottom: top + height, right: left + width })

  it('above the target, centred, the arrow on its centre', () => {
    expect(placeTooltip(rect(300, 100), TIP, VIEW, 72)).toEqual({ placement: 'above', top: 262, left: 80, arrow: 40 })
  })

  it('below when the navbar is in the way', () => {
    expect(placeTooltip(rect(90, 100), TIP, VIEW, 72)).toMatchObject({ placement: 'below', top: 128 })
  })

  it('below when the room above is too small (a target inside the navbar)', () => {
    expect(placeTooltip(rect(10, 100), TIP, VIEW, 72)).toMatchObject({ placement: 'below', top: 48 })
  })

  it('clamped inside the screen at both edges, the arrow still on the target', () => {
    expect(placeTooltip(rect(300, 2, 20), TIP, VIEW, 0)).toMatchObject({ left: 8, arrow: 10 })
    expect(placeTooltip(rect(300, 380, 20), TIP, VIEW, 0)).toMatchObject({ left: 312, arrow: 70 })
  })

  it('writes the coordinates through the CSSOM and names the placement', () => {
    document.documentElement.style.setProperty('--navbar-h', '72px')
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.dataset.testid === 'pg-tooltip' ? { ...TIP, top: 0, left: 0, bottom: 30, right: 80 } : rect(90, 100)
    })
    const { tab } = setup()
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(tooltip().dataset.placement).toBe('below')
    expect(tooltip().style.getPropertyValue('top')).toBe('128px')
    expect(tooltip().style.getPropertyValue('left')).toBe('80px')
    expect(tooltip().style.getPropertyValue('--pg-tip-arrow')).toBe('40px')
    spy.mockRestore()
    document.documentElement.style.removeProperty('--navbar-h')
  })

  // Step 15 — the desktop side tabs: the tip opens on their left, over the cover.
  it('left of a side tab: 8px away, centred on it, the arrow on its centre', () => {
    const SIDE_VIEW = { width: 1920, height: 1000 }
    expect(placeTooltip(rect(300, 380, 74, 60), TIP, SIDE_VIEW, 72, 'left'))
      .toEqual({ placement: 'left', top: 315, left: 292, arrow: 15 })
  })

  it('left placement clamped between the navbar and the screen bottom, the arrow still on the tab', () => {
    const SIDE_VIEW = { width: 1920, height: 1000 }
    expect(placeTooltip(rect(60, 380, 74, 20), TIP, SIDE_VIEW, 72, 'left')).toEqual({ placement: 'left', top: 72, left: 292, arrow: 10 })
    expect(placeTooltip(rect(985, 380, 74, 10), TIP, SIDE_VIEW, 72, 'left')).toEqual({ placement: 'left', top: 962, left: 292, arrow: 20 })
    // no height known: only the navbar bounds it
    expect(placeTooltip(rect(985, 380, 74, 10), TIP, { width: 1920 }, 72, 'left')).toMatchObject({ top: 975 })
  })

  it('no room on the left: above / below as before', () => {
    expect(placeTooltip(rect(300, 50), TIP, VIEW, 72, 'left')).toMatchObject({ placement: 'above', top: 262 })
    expect(placeTooltip(rect(90, 50), TIP, VIEW, 72, 'left')).toMatchObject({ placement: 'below' })
  })

  it('a data-tip-side tab opens on its left only where SIDE_TABS_MQ matches (desktop side column)', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.dataset.testid === 'pg-tooltip' ? { ...TIP, top: 0, left: 0, bottom: 30, right: 80 } : rect(300, 380, 74, 60)
    })
    const queries = []
    window.matchMedia = vi.fn(q => { queries.push(q); return { matches: true } })
    const { tab } = setup()
    tab().setAttribute('data-tip-side', 'left')
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(tooltip().dataset.placement).toBe('left')
    expect(tooltip().style.getPropertyValue('left')).toBe('292px')
    expect(tooltip().style.getPropertyValue('--pg-tip-arrow')).toBe('15px')
    expect(queries).toContain('(min-width: 1121px)')
    fireEvent.pointerOut(tab(), { pointerType: 'mouse', relatedTarget: document.body })
    // a tablet: the same tab keeps the tip above it
    window.matchMedia = vi.fn(q => ({ matches: q === '(hover: hover)' }))
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(tooltip().dataset.placement).toBe('above')
    spy.mockRestore()
    delete window.matchMedia
  })

  it('a window that reports no inner size: the document client size bounds the tip', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.dataset.testid === 'pg-tooltip' ? { ...TIP, top: 0, left: 0, bottom: 30, right: 80 } : rect(985, 380, 74, 10)
    })
    const inner = { w: window.innerWidth, h: window.innerHeight }
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 0 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1920 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 1000 })
    window.matchMedia = vi.fn(() => ({ matches: true }))
    try {
      const { tab } = setup()
      tab().setAttribute('data-tip-side', 'left')
      fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
      expect(tooltip().dataset.placement).toBe('left')
      expect(tooltip().style.getPropertyValue('top')).toBe('962px')
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: inner.w })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: inner.h })
      delete document.documentElement.clientWidth
      delete document.documentElement.clientHeight
      spy.mockRestore()
      delete window.matchMedia
    }
  })

  it('without a --navbar-h value it reads 0', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.dataset.testid === 'pg-tooltip' ? { ...TIP } : rect(60, 100)
    })
    const { tab } = setup()
    fireEvent.pointerOver(tab(), { pointerType: 'mouse' })
    expect(tooltip().dataset.placement).toBe('above')
    spy.mockRestore()
  })
})

describe('tipTarget', () => {
  it('finds the [data-tip] ancestor of an element or a text node, null otherwise', () => {
    document.body.innerHTML = '<button data-tip="T"><i>x</i></button><span data-tip="">e</span>'
    const btn = document.querySelector('button')
    expect(tipTarget(btn.firstChild)).toBe(btn)
    expect(tipTarget(btn.firstChild.firstChild)).toBe(btn)
    expect(tipTarget(document.querySelector('span'))).toBeNull()
    expect(tipTarget(null)).toBeNull()
    document.body.innerHTML = ''
  })
})

describe('BonusBadgeList withTitle (v1.13.0)', () => {
  const ITEMS = [{ key: 'life', label: 'Life', value: 3 }]

  it('keeps the native title on its badges by default', () => {
    const { container } = render(<BonusBadgeList items={ITEMS} lockedReason="locked" />)
    expect(container.querySelector('.bonus-badge:not(.locked)')).toHaveAttribute('title', 'Life')
    expect(container.querySelector('.bonus-badge.locked')).toHaveAttribute('title', 'locked')
  })

  it('withTitle={false} (inside a bookmark): no title, the aria-label stays', () => {
    const { container } = render(<BonusBadgeList items={ITEMS} lockedReason="locked" withTitle={false} />)
    for (const badge of container.querySelectorAll('.bonus-badge')) {
      expect(badge).not.toHaveAttribute('title')
      expect(badge).toHaveAttribute('aria-label')
    }
  })
})
