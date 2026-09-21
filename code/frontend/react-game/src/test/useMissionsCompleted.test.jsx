import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import useMissionsCompleted, { completedMissions } from '../features/gameplay/js/useMissionsCompleted'

const mission = (over = {}) => ({ uuid: 'm-1', name: 'Tutorial', status: 'ACTIVE', ...over })

describe('completedMissions (v0.38.2)', () => {
  it('names the missions that closed between two payloads', () => {
    const before = [mission(), mission({ uuid: 'm-2', status: 'AVAILABLE' })]
    const after = [mission({ status: 'COMPLETED' }), mission({ uuid: 'm-2', status: 'AVAILABLE' })]
    expect(completedMissions(before, after).map(m => m.uuid)).toEqual(['m-1'])
  })

  it('counts a mission the board never saw open — a single step closes in one beat', () => {
    expect(completedMissions([], [mission({ uuid: 'm-9', status: 'COMPLETED' })])
      .map(m => m.uuid)).toEqual(['m-9'])
  })

  it('is quiet about a mission already closed, a failed one, or nothing at all', () => {
    const done = [mission({ status: 'COMPLETED' })]
    expect(completedMissions(done, done)).toEqual([])
    expect(completedMissions([mission()], [mission({ status: 'FAILED' })])).toEqual([])
    expect(completedMissions(undefined, null)).toEqual([])
  })

  it('falls back to the name when a row carries no uuid', () => {
    const before = [{ name: 'Unnamed', status: 'ACTIVE' }]
    expect(completedMissions(before, [{ name: 'Unnamed', status: 'COMPLETED' }]).length).toBe(1)
    expect(completedMissions([{ name: 'Unnamed', status: 'COMPLETED' }],
      [{ name: 'Unnamed', status: 'COMPLETED' }])).toEqual([])
  })
})

describe('useMissionsCompleted (v0.38.2)', () => {
  it('takes the first payload as the baseline, never as news', () => {
    const onCompleted = vi.fn()
    renderHook(({ m }) => useMissionsCompleted(m, onCompleted),
      { initialProps: { m: [mission({ status: 'COMPLETED' })] } })
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('announces a mission the moment it closes, once', () => {
    const onCompleted = vi.fn()
    const { rerender } = renderHook(({ m }) => useMissionsCompleted(m, onCompleted),
      { initialProps: { m: [mission()] } })
    rerender({ m: [mission({ status: 'COMPLETED' })] })
    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect(onCompleted.mock.calls[0][0].map(x => x.uuid)).toEqual(['m-1'])

    // The same payload again is not news.
    rerender({ m: [mission({ status: 'COMPLETED' })] })
    expect(onCompleted).toHaveBeenCalledTimes(1)
  })

  it('ignores a missing list: the baseline waits for a real payload and survives a gap', () => {
    const onCompleted = vi.fn()
    const { rerender } = renderHook(({ m }) => useMissionsCompleted(m, onCompleted),
      { initialProps: { m: undefined } })
    rerender({ m: [mission({ status: 'COMPLETED' })] })   // first REAL payload: baseline
    expect(onCompleted).not.toHaveBeenCalled()

    rerender({ m: [mission({ status: 'COMPLETED' })] })
    rerender({ m: null })
    rerender({ m: [mission({ status: 'COMPLETED' })] })   // still the same story
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('calls the LATEST callback, and copes with none at all', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ m, cb }) => useMissionsCompleted(m, cb),
      { initialProps: { m: [mission()], cb: first } })
    rerender({ m: [mission()], cb: second })
    rerender({ m: [mission({ status: 'COMPLETED' })], cb: second })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    rerender({ m: [mission({ status: 'COMPLETED' }), mission({ uuid: 'm-2', status: 'COMPLETED' })],
      cb: undefined })
    expect(second).toHaveBeenCalledTimes(1)
  })
})
