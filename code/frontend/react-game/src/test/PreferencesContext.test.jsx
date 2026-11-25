import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PreferencesProvider, usePreferences, applyPreferenceAttributes } from '../preferences/PreferencesContext'
import { useAnimationSettings, REDUCED_MOTION_MQ } from '../context/AnimationContext'
import { PREFERENCES_KEY, LANG_KEY } from '../auth/devicePreferences'

// Step 16 — the preferences context: stored choices, <html> attributes, OS reduced motion, other tabs, reset.

function Probe() {
  const { prefs, effective, layout, setPreference, reset } = usePreferences()
  const anim = useAnimationSettings()
  return (
    <div>
      <span data-testid="theme">{effective.theme}</span>
      <span data-testid="cols">{String(effective.cols)}</span>
      <span data-testid="layout">{layout}</span>
      <span data-testid="reduced">{String(effective.reducedMotion)}</span>
      <span data-testid="deal">{String(anim.deal)}</span>
      <span data-testid="speed">{anim.speed}</span>
      <span data-testid="prefs">{JSON.stringify(prefs)}</span>
      <button onClick={() => setPreference('theme', 'parchment')}>theme</button>
      <button onClick={() => setPreference('size', 'large')}>size</button>
      <button onClick={() => setPreference('columns', 4)}>cols4</button>
      <button onClick={() => setPreference('columns', 'auto')}>colsAuto</button>
      <button onClick={() => setPreference('anim.speed', 1)}>speed</button>
      <button onClick={reset}>reset</button>
    </div>
  )
}

const html = document.documentElement
const ATTRS = ['data-pg-theme', 'data-pg-size', 'data-pg-cols', 'data-pg-reduced']
const renderProbe = () => render(<PreferencesProvider env={{}}><Probe /></PreferencesProvider>)
const text = id => screen.getByTestId(id).textContent

afterEach(() => {
  localStorage.clear()
  ATTRS.forEach(a => html.removeAttribute(a))
  delete window.matchMedia
})

describe('PreferencesProvider', () => {
  it('writes the <html> data attributes from the stored choices, cols only when not auto', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, theme: 'parchment', size: 'small', columns: 2 }))
    renderProbe()
    expect(html).toHaveAttribute('data-pg-theme', 'parchment')
    expect(html).toHaveAttribute('data-pg-size', 'small')
    expect(html).toHaveAttribute('data-pg-cols', '2')
    expect(html).not.toHaveAttribute('data-pg-reduced')
    expect(html.getAttribute('style') ?? '').not.toContain('font-size')
  })

  it('every change is written at once (storage and attributes) and reaches the animation settings', () => {
    renderProbe()
    expect(html).toHaveAttribute('data-pg-theme', 'medieval')
    expect(html).toHaveAttribute('data-pg-size', 'normal')
    expect(html).not.toHaveAttribute('data-pg-cols')
    fireEvent.click(screen.getByText('theme'))
    fireEvent.click(screen.getByText('size'))
    fireEvent.click(screen.getByText('cols4'))
    fireEvent.click(screen.getByText('speed'))
    expect(html).toHaveAttribute('data-pg-theme', 'parchment')
    expect(html).toHaveAttribute('data-pg-size', 'large')
    expect(html).toHaveAttribute('data-pg-cols', '4')
    expect(text('cols')).toBe('4')
    expect(text('speed')).toBe('1')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY))).toEqual({ v: 1, theme: 'parchment', size: 'large',
      columns: 4, anim: { speed: 1 } })
    fireEvent.click(screen.getByText('colsAuto'))
    expect(html).not.toHaveAttribute('data-pg-cols')
  })

  it('reset removes the key and goes back to the defaults; the language stays', () => {
    localStorage.setItem(LANG_KEY, 'it')
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, theme: 'parchment', anim: { speed: 1 } }))
    renderProbe()
    expect(text('speed')).toBe('1')
    fireEvent.click(screen.getByText('reset'))
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull()
    expect(localStorage.getItem(LANG_KEY)).toBe('it')
    expect(text('theme')).toBe('medieval')
    expect(text('speed')).toBe('0.25')
    expect(text('prefs')).toBe('{}')
  })

  it('follows the storage event of another tab (its key, or a full clear), ignores other keys', () => {
    renderProbe()
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, theme: 'parchment' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: LANG_KEY })) })
    expect(text('theme')).toBe('medieval')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PREFERENCES_KEY })) })
    expect(text('theme')).toBe('parchment')
    localStorage.clear()
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })) })
    expect(text('theme')).toBe('medieval')
  })

  it('follows the OS reduced motion (addEventListener): flags off, data-pg-reduced on <html>', () => {
    let listener = null
    const mq = { matches: false, addEventListener: vi.fn((t, fn) => { listener = fn }), removeEventListener: vi.fn() }
    window.matchMedia = vi.fn(q => (q === REDUCED_MOTION_MQ ? mq : { matches: false }))
    const { unmount } = renderProbe()
    expect(text('deal')).toBe('true')
    act(() => listener({ matches: true }))
    expect(text('reduced')).toBe('true')
    expect(text('deal')).toBe('false')
    expect(html).toHaveAttribute('data-pg-reduced', 'true')
    act(() => listener({ matches: false }))
    expect(html).not.toHaveAttribute('data-pg-reduced')
    unmount()
    expect(mq.removeEventListener).toHaveBeenCalledWith('change', listener)
    // one listener only: the AnimationProvider inside follows the preferences, not the OS a second time
    expect(mq.addEventListener).toHaveBeenCalledTimes(1)
  })

  it('follows the OS reduced motion with the old addListener API too', () => {
    let listener = null
    const mq = { matches: true, addListener: vi.fn(fn => { listener = fn }), removeListener: vi.fn() }
    window.matchMedia = vi.fn(q => (q === REDUCED_MOTION_MQ ? mq : { matches: false }))
    const { unmount } = renderProbe()
    expect(text('reduced')).toBe('true')
    act(() => listener({ matches: false }))
    expect(text('reduced')).toBe('false')
    unmount()
    expect(mq.removeListener).toHaveBeenCalledWith(listener)
  })

  it('without matchMedia: not reduced, desktop columns', () => {
    renderProbe()
    expect(text('reduced')).toBe('false')
    expect(text('layout')).toBe('desktop')
  })

  it('follows the layout on resize and rotation', () => {
    renderProbe()
    window.matchMedia = vi.fn(q => ({ matches: q === '(max-width: 767px)' || q === '(max-width: 1120px)' }))
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(text('layout')).toBe('phone')
    window.matchMedia = vi.fn(() => ({ matches: false }))
    act(() => { window.dispatchEvent(new Event('orientationchange')) })
    expect(text('layout')).toBe('desktop')
  })
})

describe('usePreferences without a provider', () => {
  it('the defaults, read-only', () => {
    render(<Probe />)
    expect(text('theme')).toBe('medieval')
    expect(text('prefs')).toBe('{}')
    fireEvent.click(screen.getByText('theme'))
    fireEvent.click(screen.getByText('reset'))
    expect(text('theme')).toBe('medieval')
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull()
  })

  it('applyPreferenceAttributes ignores a missing root or settings', () => {
    expect(() => applyPreferenceAttributes(null)).not.toThrow()
    expect(() => applyPreferenceAttributes({ theme: 'medieval' }, null)).not.toThrow()
  })
})
