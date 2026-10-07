import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/api/matches', () => ({ getMatchMissions: vi.fn() }))
import { getMatchMissions } from '@/api/matches'
import useMatchMissions from '../features/matches/useMatchMissions'

describe('useMatchMissions (v0.37.4)', () => {
  // Braces on purpose: a returned mock would be run by vitest as the test's cleanup.
  beforeEach(() => { getMatchMissions.mockReset() })

  it('reads the missions of the match, with the language, and is loading meanwhile', async () => {
    let resolve
    getMatchMissions.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useMatchMissions('m1', 'tok', 'it'))
    expect(result.current.loading).toBe(true)
    expect(getMatchMissions).toHaveBeenCalledWith('m1', 'tok', { lang: 'it' })

    resolve({ missions: [{ uuid: 'q1', name: 'Quest' }] })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missions).toEqual([{ uuid: 'q1', name: 'Quest' }])
  })

  it('reads a malformed answer as no missions', async () => {
    getMatchMissions.mockResolvedValue({ missions: 'nope' })
    const { result } = renderHook(() => useMatchMissions('m1', 'tok', 'en'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missions).toEqual([])
  })

  it('reads a failed call as no missions rather than an error page', async () => {
    getMatchMissions.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMatchMissions('m1', 'tok', 'en'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missions).toEqual([])
  })

  it('loads nothing without a match, and forgets the previous match', async () => {
    getMatchMissions.mockResolvedValue({ missions: [{ uuid: 'q1' }] })
    const { result, rerender } = renderHook(({ uuid }) => useMatchMissions(uuid, 'tok', 'en'),
      { initialProps: { uuid: 'm1' } })
    await waitFor(() => expect(result.current.missions).toHaveLength(1))

    rerender({ uuid: null })
    expect(result.current.missions).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(getMatchMissions).toHaveBeenCalledTimes(1)
  })

  it('drops an answer that lands after the match changed', async () => {
    let resolveFirst
    getMatchMissions
      .mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
      .mockResolvedValueOnce({ missions: [{ uuid: 'q2' }] })
    const { result, rerender } = renderHook(({ uuid }) => useMatchMissions(uuid, 'tok', 'en'),
      { initialProps: { uuid: 'm1' } })
    rerender({ uuid: 'm2' })
    await waitFor(() => expect(result.current.missions).toEqual([{ uuid: 'q2' }]))
    resolveFirst({ missions: [{ uuid: 'q1' }] })
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.missions).toEqual([{ uuid: 'q2' }])
  })
})
