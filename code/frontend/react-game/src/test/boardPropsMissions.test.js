import { describe, it, expect } from 'vitest'
import { missionsSummaryProps } from '../features/gameplay/js/boardProps'

describe('missionsSummaryProps (Step 37)', () => {
  it('counts the OPEN missions and carries the total beside them', () => {
    const gameData = { info: { missions: [
      { status: 'ACTIVE' }, { status: 'AVAILABLE' }, { status: 'COMPLETED' },
    ] } }

    expect(missionsSummaryProps(gameData)).toEqual({ count: 2, total: 3 })
  })

  it('reads a board with no missions, and one with no info at all, as zero', () => {
    expect(missionsSummaryProps({ info: { missions: [] } })).toEqual({ count: 0, total: 0 })
    expect(missionsSummaryProps({})).toEqual({ count: 0, total: 0 })
    expect(missionsSummaryProps(null)).toEqual({ count: 0, total: 0 })
  })

  it('a match whose missions are all closed reports none open, not none at all', () => {
    const gameData = { info: { missions: [{ status: 'COMPLETED' }, { status: 'FAILED' }] } }

    expect(missionsSummaryProps(gameData)).toEqual({ count: 0, total: 2 })
  })
})
