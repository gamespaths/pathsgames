import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import useMissionsAlert, { missionsSignature } from '../features/gameplay/js/useMissionsAlert'

const mission = (over = {}) => ({ uuid: 'm-1', status: 'ACTIVE',
  steps: [{ uuid: 's-1', done: true }, { uuid: 's-2', done: false }], ...over })

describe('useMissionsAlert (v0.37.1)', () => {
  it('reads a status, a step total and how many are closed — and nothing else', () => {
    expect(missionsSignature([mission()])).toBe('m-1:ACTIVE:1/2')
    // Re-sorted rows are the same news; a rewritten description is not news at all.
    const a = missionsSignature([mission(), mission({ uuid: 'm-2' })])
    const b = missionsSignature([mission({ uuid: 'm-2' }), mission({ description: 'new' })])
    expect(a).toBe(b)
    expect(missionsSignature(undefined)).toBe('')
    // A sparse row still gets a stable line of its own: falling back to nothing would make
    // two different missions read as one and swallow the news.
    expect(missionsSignature([{ name: 'unnamed' }, {}])).toBe('?:?:0/0|unnamed:?:0/0')
  })

  it('takes the first payload as the baseline, never as news', () => {
    const { result } = renderHook(({ m }) => useMissionsAlert(m), {
      initialProps: { m: [mission()] },
    })
    expect(result.current.changed).toBe(false)
  })

  it('lights up on a new mission, a closed step, a new step and a closed mission', () => {
    const cases = [
      [mission(), mission({ uuid: 'm-9' })],                                  // a new mission
      [mission({ steps: [{ done: true }, { done: true }] })],                 // a step closed
      [mission({ steps: [{ done: true }, { done: false }, { done: false }] })], // a new step
      [mission({ status: 'COMPLETED' })],                                     // mission closed
    ]
    for (const next of cases) {
      const { result, rerender } = renderHook(({ m }) => useMissionsAlert(m), {
        initialProps: { m: [mission()] },
      })
      rerender({ m: next })
      expect(result.current.changed).toBe(true)
    }
  })

  it('stays quiet when the payload says the same thing again', () => {
    const { result, rerender } = renderHook(({ m }) => useMissionsAlert(m), {
      initialProps: { m: [mission()] },
    })
    rerender({ m: [mission()] })
    expect(result.current.changed).toBe(false)
  })

  it('goes out when the player looks, and stays out until the next change', () => {
    const { result, rerender } = renderHook(({ m }) => useMissionsAlert(m), {
      initialProps: { m: [mission()] },
    })
    rerender({ m: [mission({ status: 'COMPLETED' })] })
    expect(result.current.changed).toBe(true)

    act(() => result.current.markSeen())
    expect(result.current.changed).toBe(false)

    rerender({ m: [mission({ status: 'COMPLETED' })] })
    expect(result.current.changed).toBe(false)
  })

  it('never lights while the player is watching the missions pages', () => {
    const { result, rerender } = renderHook(({ m, w }) => useMissionsAlert(m, w), {
      initialProps: { m: [mission()], w: true },
    })
    rerender({ m: [mission({ status: 'COMPLETED' })], w: true })
    expect(result.current.changed).toBe(false)

    // And what happens after they leave is news again.
    rerender({ m: [mission({ status: 'COMPLETED' })], w: false })
    rerender({ m: [mission({ status: 'FAILED' })], w: false })
    expect(result.current.changed).toBe(true)
  })
})
