import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AnimationProvider, useAnimationSettings, REDUCED_MOTION_MQ } from '../context/AnimationContext'
import { resolveAnimations } from '../constants/animations'

// Step 14 — the provider follows the OS reduced motion, applies the timings and takes overrides.
function Probe() {
  const s = useAnimationSettings()
  return (
    <div>
      <span data-testid="deal">{String(s.deal)}</span>
      <span data-testid="reduced">{String(s.reduced)}</span>
      <span data-testid="speed">{s.speed}</span>
      <span data-testid="deck">{s.deck}</span>
      <button onClick={() => s.setAnimationOverrides({ speed: 1, deal: false, deck: 'over' })}>override</button>
    </div>
  )
}

const html = document.documentElement
const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
  html.removeAttribute('data-pg-reduced')
  html.style.removeProperty('--t-deal')
})

describe('AnimationProvider', () => {
  it('without matchMedia: not reduced, env settings, timings written on <html>', () => {
    delete window.matchMedia
    render(<AnimationProvider env={{}}><Probe /></AnimationProvider>)
    expect(screen.getByTestId('deal')).toHaveTextContent('true')
    expect(screen.getByTestId('reduced')).toHaveTextContent('false')
    expect(screen.getByTestId('speed')).toHaveTextContent('0.25')
    expect(html.style.getPropertyValue('--t-deal')).toBe('2480ms')
    // step 15 — the book change phases
    expect(html.style.getPropertyValue('--t-slide')).toBe('2400ms')
    expect(html.style.getPropertyValue('--t-close')).toBe('1040ms')
    expect(html).not.toHaveAttribute('data-pg-reduced')
  })

  it('a mocked matchMedia without addEventListener: reduced motion read once, every flag off', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    const { unmount } = render(<AnimationProvider env={{ VITE_ANIM_DECK: 'over' }}><Probe /></AnimationProvider>)
    expect(window.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_MQ)
    expect(screen.getByTestId('deal')).toHaveTextContent('false')
    expect(screen.getByTestId('reduced')).toHaveTextContent('true')
    expect(screen.getByTestId('deck')).toHaveTextContent('over')
    expect(html).toHaveAttribute('data-pg-reduced', 'true')
    expect(() => unmount()).not.toThrow()
  })

  it('a matchMedia that answers nothing counts as not reduced', () => {
    window.matchMedia = vi.fn(() => undefined)
    render(<AnimationProvider env={{}}><Probe /></AnimationProvider>)
    expect(screen.getByTestId('reduced')).toHaveTextContent('false')
  })

  it('follows the OS change event, and stops listening on unmount', () => {
    let listener = null
    const mq = {
      matches: false,
      addEventListener: vi.fn((type, fn) => { listener = fn }),
      removeEventListener: vi.fn(),
    }
    window.matchMedia = vi.fn(() => mq)
    const { unmount } = render(<AnimationProvider env={{}}><Probe /></AnimationProvider>)
    expect(mq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(screen.getByTestId('deal')).toHaveTextContent('true')
    act(() => listener({ matches: true }))
    expect(screen.getByTestId('deal')).toHaveTextContent('false')
    expect(html).toHaveAttribute('data-pg-reduced', 'true')
    act(() => listener({ matches: false }))
    expect(screen.getByTestId('deal')).toHaveTextContent('true')
    expect(html).not.toHaveAttribute('data-pg-reduced')
    unmount()
    expect(mq.removeEventListener).toHaveBeenCalledWith('change', listener)
  })

  it('setAnimationOverrides wins key by key and rewrites the timings', () => {
    delete window.matchMedia
    render(<AnimationProvider env={{}}><Probe /></AnimationProvider>)
    fireEvent.click(screen.getByText('override'))
    expect(screen.getByTestId('deal')).toHaveTextContent('false')
    expect(screen.getByTestId('speed')).toHaveTextContent('1')
    expect(screen.getByTestId('deck')).toHaveTextContent('over')
    expect(html.style.getPropertyValue('--t-deal')).toBe('620ms')
  })
})

describe('AnimationProvider — step 16: driven by the preferences', () => {
  it('takes the preference overrides and the reduced motion as props, then follows no OS listener of its own', () => {
    const mq = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    window.matchMedia = vi.fn(() => mq)
    const { rerender } = render(<AnimationProvider env={{}} overrides={{ speed: 1, deck: 'over' }} reducedMotion={false}>
      <Probe /></AnimationProvider>)
    expect(mq.addEventListener).not.toHaveBeenCalled()
    expect(screen.getByTestId('speed')).toHaveTextContent('1')
    expect(screen.getByTestId('deck')).toHaveTextContent('over')
    fireEvent.click(screen.getByText('override'))
    expect(screen.getByTestId('deal')).toHaveTextContent('false')
    rerender(<AnimationProvider env={{}} overrides={null} reducedMotion><Probe /></AnimationProvider>)
    expect(screen.getByTestId('reduced')).toHaveTextContent('true')
    expect(html).toHaveAttribute('data-pg-reduced', 'true')
  })

  it('useReducedMotion falls back to the old addListener API', () => {
    let listener = null
    const mq = { matches: false, addListener: vi.fn(fn => { listener = fn }), removeListener: vi.fn() }
    window.matchMedia = vi.fn(() => mq)
    const { unmount } = render(<AnimationProvider env={{}}><Probe /></AnimationProvider>)
    act(() => listener({ matches: true }))
    expect(screen.getByTestId('reduced')).toHaveTextContent('true')
    unmount()
    expect(mq.removeListener).toHaveBeenCalledWith(listener)
  })
})

describe('useAnimationSettings without a provider', () => {
  it('returns the env defaults and a harmless setter', () => {
    let seen = null
    function Read() { seen = useAnimationSettings(); return null }
    render(<Read />)
    const { setAnimationOverrides, ...settings } = seen
    expect(settings).toEqual(resolveAnimations())
    expect(() => setAnimationOverrides({ deal: false })).not.toThrow()
  })
})
