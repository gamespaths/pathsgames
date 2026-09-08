import { describe, it, expect } from 'vitest'
import {
  missionProgress, missionProgressLabel, openMissions, orderedMissions,
} from '../utils/missions'

const mission = (name, status, steps = []) => ({ name, status, steps })

describe('missions utils (Step 37)', () => {
  it('puts what is still to do first, then names alphabetically', () => {
    const rows = [
      mission('Zeta', 'COMPLETED'), mission('Beta', 'AVAILABLE'),
      mission('Alpha', 'ACTIVE'), mission('Gamma', 'FAILED'),
    ]

    expect(orderedMissions(rows).map(m => m.name))
      .toEqual(['Alpha', 'Beta', 'Zeta', 'Gamma'])
  })

  it('reads an unknown status as last rather than losing the row', () => {
    const rows = [mission('Odd', 'WHAT'), mission('Open', 'ACTIVE')]
    expect(orderedMissions(rows).map(m => m.name)).toEqual(['Open', 'Odd'])
  })

  it('treats anything that is not a list as no missions at all', () => {
    expect(orderedMissions(null)).toEqual([])
    expect(openMissions(undefined)).toEqual([])
  })

  it('counts only the missions still open: closed ones are not news', () => {
    const rows = [mission('a', 'ACTIVE'), mission('b', 'AVAILABLE'),
      mission('c', 'COMPLETED'), mission('d', 'FAILED')]

    expect(openMissions(rows).map(m => m.name)).toEqual(['a', 'b'])
  })

  it('reports how far down the steps a mission is', () => {
    const m = mission('m', 'ACTIVE', [{ done: true }, { done: true }, { done: false }])

    expect(missionProgress(m)).toEqual({ done: 2, total: 3 })
    expect(missionProgressLabel(m)).toBe('2/3')
  })

  it('has no progress to show for a mission with no steps at all', () => {
    expect(missionProgress(mission('m', 'AVAILABLE'))).toEqual({ done: 0, total: 0 })
    expect(missionProgressLabel(mission('m', 'AVAILABLE'))).toBeNull()
    expect(missionProgressLabel(null)).toBeNull()
  })
})
