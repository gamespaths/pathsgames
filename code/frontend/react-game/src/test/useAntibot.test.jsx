import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Controllable turnstile module: CF_KEY (getter so tests can toggle it),
// isTurnstilePassValid and a recordTurnstilePass spy.
const tu = vi.hoisted(() => ({ key: 'test-key', passValid: false }))
const recordSpy = vi.hoisted(() => vi.fn())
vi.mock('@/utils/turnstile', () => ({
  get CF_KEY() { return tu.key },
  isTurnstilePassValid: () => tu.passValid,
  recordTurnstilePass: recordSpy,
}))

import useAntibot from '../hooks/useAntibot'

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
