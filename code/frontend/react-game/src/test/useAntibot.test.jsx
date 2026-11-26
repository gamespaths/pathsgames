import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen } from '@testing-library/react'

// Controllable turnstile module: CF_KEY (getter so tests can toggle it),
// isTurnstilePassValid and a recordTurnstilePass spy.
const tu = vi.hoisted(() => ({ key: 'test-key', passValid: false }))
const recordSpy = vi.hoisted(() => vi.fn())
vi.mock('@/utils/turnstile', () => ({
  get CF_KEY() { return tu.key },
  isTurnstilePassValid: () => tu.passValid,
  recordTurnstilePass: recordSpy,
}))

import useAntibot, { useAntibotSuccess, ANTIBOT_SUCCESS_MS } from '../hooks/useAntibot'
import AntibotSuccess from '../components/ui/AntibotSuccess'
import { LanguageProvider } from '../i18n/context'

describe('useAntibot', () => {
  beforeEach(() => {
    tu.key = 'test-key'
    tu.passValid = false
    recordSpy.mockClear()
  })

  it('bypasses (ready) when no site key is configured', () => {
    tu.key = ''
    const { result } = renderHook(() => useAntibot({ cookie: false }))
    expect(result.current.phase).toBe('ready')
  })

  it('starts checking, then onSuccess stores the token and goes ready (no cookie write when cookie:false)', () => {
    const { result } = renderHook(() => useAntibot({ cookie: false }))
    expect(result.current.phase).toBe('checking')
    act(() => result.current.onSuccess('tok-xyz'))
    expect(result.current.phase).toBe('ready')
    expect(result.current.token).toBe('tok-xyz')
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('records the pass cookie on success when cookie:true', () => {
    const { result } = renderHook(() => useAntibot({ cookie: true }))
    expect(result.current.phase).toBe('checking')
    act(() => result.current.onSuccess('tok'))
    expect(recordSpy).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('ready')
  })

  it('skips the widget (ready) when cookie:true and a recent pass exists', () => {
    tu.passValid = true
    const { result } = renderHook(() => useAntibot({ cookie: true }))
    expect(result.current.phase).toBe('ready')
  })

  it('drops the stored token on retry (single-use server-side)', () => {
    const { result } = renderHook(() => useAntibot({ cookie: false }))
    act(() => result.current.onSuccess('burnt-token'))
    expect(result.current.token).toBe('burnt-token')
    act(() => result.current.retry())
    expect(result.current.token).toBeNull()
    expect(result.current.phase).toBe('checking')
  })

  it('stays ready on retry when no site key is configured (no widget to remount)', () => {
    tu.key = ''
    const { result } = renderHook(() => useAntibot({ cookie: false }))
    const prevAttempt = result.current.attempt
    act(() => result.current.retry())
    expect(result.current.phase).toBe('ready')
    expect(result.current.attempt).toBe(prevAttempt)
  })

  it('goes to error on widget failure and retry restarts checking (new attempt)', () => {
    const { result } = renderHook(() => useAntibot({ cookie: false }))
    act(() => result.current.onError())
    expect(result.current.phase).toBe('error')
    const prevAttempt = result.current.attempt
    act(() => result.current.retry())
    expect(result.current.phase).toBe('checking')
    expect(result.current.attempt).toBe(prevAttempt + 1)
  })
})

// Step 15 — the success line shared by the Home and the start-match page.
describe('useAntibotSuccess', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('true only after checking → ready, false again after 4 s', () => {
    expect(ANTIBOT_SUCCESS_MS).toBe(4000)
    const { result, rerender } = renderHook(({ phase }) => useAntibotSuccess(phase), { initialProps: { phase: 'checking' } })
    expect(result.current).toBe(false)
    rerender({ phase: 'ready' })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(ANTIBOT_SUCCESS_MS - 1) })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(false)
  })

  it('never when it starts ready (no site key, a recent pass) nor after an error that turns ready', () => {
    const { result, rerender } = renderHook(({ phase }) => useAntibotSuccess(phase), { initialProps: { phase: 'ready' } })
    expect(result.current).toBe(false)
    rerender({ phase: 'error' })
    rerender({ phase: 'ready' })
    expect(result.current).toBe(false)
  })

  it('a new check (retry, expired token) shows it again; leaving ready hides it at once', () => {
    const { result, rerender } = renderHook(({ phase }) => useAntibotSuccess(phase), { initialProps: { phase: 'checking' } })
    rerender({ phase: 'ready' })
    expect(result.current).toBe(true)
    rerender({ phase: 'checking' })
    expect(result.current).toBe(false)
    rerender({ phase: 'ready' })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(ANTIBOT_SUCCESS_MS) })
    expect(result.current).toBe(false)
  })

  it('its timer is cleared on unmount', () => {
    const { rerender, unmount } = renderHook(({ phase }) => useAntibotSuccess(phase), { initialProps: { phase: 'checking' } })
    rerender({ phase: 'ready' })
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('AntibotSuccess', () => {
  it('renders the translated line with its test id and the check icon', () => {
    render(<LanguageProvider><AntibotSuccess /></LanguageProvider>)
    const line = screen.getByTestId('antibot-success')
    expect(line).toHaveClass('home-antibot-success')
    expect(line).toHaveTextContent('Success! You are human.')
    expect(line.querySelector('.fa-check-circle')).toHaveAttribute('aria-hidden', 'true')
  })
})
