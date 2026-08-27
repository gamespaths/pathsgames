import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'

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
import { getMatchLocations } from '@/api/matches'

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
