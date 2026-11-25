import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import FadeIn, { previewKey } from '../components/layout/FadeIn'
import useBookTurn from '../hooks/useBookTurn'
import { AnimationProvider } from '../context/AnimationContext'
import { installWaapi } from './fixtures/waapi'

// Step 15 — the (i) preview fades in where it opens on the phone layout; the desktop Book fades the page.

const SPEED_1 = { VITE_ANIM_SPEED: '1' }
const mobile = on => { window.matchMedia = vi.fn(q => ({ matches: on && !q.includes('reduce') })) }

function Preview({ id, env = SPEED_1 }) {
  return <AnimationProvider env={env}><FadeIn key={id} className="extra"><p>{id}</p></FadeIn></AnimationProvider>
}

let waapi
beforeEach(() => { waapi = installWaapi() })
afterEach(() => {
  waapi.restore()
  delete window.matchMedia
})

describe('FadeIn', () => {
  it('wraps its card in .pg-fade-in (display: contents on desktop)', () => {
    render(<Preview id="a" />)
    expect(screen.getByText('a').parentElement).toHaveClass('pg-fade-in', 'extra')
    render(<FadeIn><p>plain</p></FadeIn>)
    expect(screen.getByText('plain').parentElement.className).toBe('pg-fade-in')
  })

  it('on phones it fades in on mount, and again for each new preview (key)', () => {
    mobile(true)
    const { rerender } = render(<Preview id="a" />)
    expect(waapi.animations).toHaveLength(1)
    expect(waapi.animations[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(waapi.animations[0].options.duration).toBe(200)
    rerender(<Preview id="a" />)
    expect(waapi.animations).toHaveLength(1)
    rerender(<Preview id="b" />)
    expect(waapi.animations).toHaveLength(2)
    expect(waapi.animations[0].cancel).toHaveBeenCalled()
  })

  it('never on desktop, with the turn flag off, under reduced motion, or without WAAPI', () => {
    mobile(false)
    render(<Preview id="desk" />)
    mobile(true)
    render(<Preview id="off" env={{ VITE_ANIM_TURN: 'false' }} />)
    window.matchMedia = vi.fn(() => ({ matches: true }))
    render(<Preview id="reduced" />)
    expect(waapi.animations).toHaveLength(0)
    waapi.restore()
    mobile(true)
    render(<Preview id="jsdom" />)
    expect(screen.getByText('jsdom')).toBeInTheDocument()
  })
})

describe('previewKey', () => {
  it('tells two previews apart by type and card', () => {
    expect(previewKey({ type: 'trait', card: { uuid: 'u1', title: 'T' } })).toBe('trait|u1')
    expect(previewKey({ type: 'trait', card: { title: 'T' } })).toBe('trait|T')
    expect(previewKey({ type: 'class', entity: { uuid: 'e1' } })).toBe('class|e1')
    expect(previewKey(null)).toBe('|')
  })
})

describe('useBookTurn', () => {
  it('starts on page 0 with no direction; turnTo bumps the key with the direction (none = null)', () => {
    const { result } = renderHook(() => useBookTurn())
    expect(result.current).toMatchObject({ pageKey: 0, direction: null })
    act(() => result.current.turnTo('forward'))
    expect(result.current).toMatchObject({ pageKey: 1, direction: 'forward' })
    act(() => result.current.turnTo())
    expect(result.current).toMatchObject({ pageKey: 2, direction: null })
    const turnTo = result.current.turnTo
    act(() => result.current.turnTo('fade'))
    expect(result.current.turnTo).toBe(turnTo)
  })
})
