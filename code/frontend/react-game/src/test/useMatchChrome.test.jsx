import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'

// The board runs under <React.StrictMode> (src/main.jsx), which mounts every component
// twice in dev: mount → unmount → mount. A hook that guards its async setState with a ref
// must re-arm that ref on the SECOND mount, or every answer is thrown away and the board
// stays empty — which is exactly how the map lost its explored-location links.

vi.mock('@/api/matches', () => ({
  getMatchClock: vi.fn(() => Promise.resolve({ currentClock: 3 })),
  getMatchWeather: vi.fn(() => Promise.resolve({ uuid: 'w1' })),
  getMatchLocations: vi.fn(() => Promise.resolve({
    matchUuid: 'm1',
    locations: [{ idLocation: 1, neighbors: [{ uuid: 'l2', totalEnergyCost: 4 }] }],
  })),
}))

import useMatchChrome from '../features/gameplay/js/useMatchChrome'
import { getMatchLocations, getMatchClock, getMatchWeather } from '@/api/matches'

const strict = ({ children }) => <React.StrictMode>{children}</React.StrictMode>

describe('useMatchChrome', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the payloads that land after a StrictMode double mount', async () => {
    const { result } = renderHook(() => useMatchChrome('m1', 'tok', 'en'), { wrapper: strict })
    await waitFor(() => expect(result.current.matchLocations).not.toBeNull())
    expect(result.current.matchLocations.locations).toHaveLength(1)
    expect(result.current.locationCosts['1->l2']).toBe(4)
    expect(result.current.clock).toEqual({ currentClock: 3 })
    expect(result.current.weather).toEqual({ uuid: 'w1' })
  })

  it('asks each side payload ONCE under StrictMode, and again on an explicit refresh (v0.37.6)', async () => {
    const { result } = renderHook(() => useMatchChrome('m1', 'tok', 'en'), { wrapper: strict })
    await waitFor(() => expect(result.current.clock).not.toBeNull())
    expect(getMatchClock).toHaveBeenCalledTimes(1)
    expect(getMatchWeather).toHaveBeenCalledTimes(1)
    expect(getMatchLocations).toHaveBeenCalledTimes(1)
    await act(async () => { result.current.refresh() })
    expect(getMatchClock).toHaveBeenCalledTimes(2)
    expect(getMatchLocations).toHaveBeenCalledTimes(2)
  })

  it('refresh(scope) asks only for the payloads named (v0.37.6)', async () => {
    const { result } = renderHook(() => useMatchChrome('m1', 'tok', 'en'))
    await waitFor(() => expect(result.current.clock).not.toBeNull())
    vi.clearAllMocks()
    await act(async () => { result.current.refresh({ clock: false, weather: false, locations: true }) })
    expect(getMatchClock).not.toHaveBeenCalled()
    expect(getMatchWeather).not.toHaveBeenCalled()
    expect(getMatchLocations).toHaveBeenCalledTimes(1)
    await act(async () => { result.current.refresh({ clock: true, weather: true, locations: false }) })
    expect(getMatchClock).toHaveBeenCalledTimes(1)
    expect(getMatchWeather).toHaveBeenCalledTimes(1)
    expect(getMatchLocations).toHaveBeenCalledTimes(1)
  })

  it('reloads when the match or the language changes', async () => {
    const { result, rerender } = renderHook(({ m, l }) => useMatchChrome(m, 'tok', l),
      { initialProps: { m: 'm1', l: 'en' } })
    await waitFor(() => expect(result.current.clock).not.toBeNull())
    rerender({ m: 'm1', l: 'it' })
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalledTimes(2))
    rerender({ m: 'm2', l: 'it' })
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalledTimes(3))
    expect(getMatchLocations).toHaveBeenLastCalledWith('m2', 'tok', 'it')
  })

  it('drops an answer that lands after the board is really gone', async () => {
    const { unmount, result } = renderHook(() => useMatchChrome('m1', 'tok', 'en'))
    await waitFor(() => expect(getMatchLocations).toHaveBeenCalled())
    unmount()
    expect(result.current.matchLocations).toBeDefined()
  })

  it('asks for nothing until the match is known', () => {
    renderHook(() => useMatchChrome(null, 'tok', 'en'))
    expect(getMatchLocations).not.toHaveBeenCalled()
  })
})
