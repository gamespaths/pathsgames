import { describe, it, expect } from 'vitest'
import {
  EXP_STATS, EXP_STAT_KEY, canUseExp, cheapestExpCost, expStatRows, isLocationSafe,
} from '@/utils/experience'

const STATS = { experience: 20, dexterity: 10, intelligence: 12, constitution: 4,
                expCosts: { dex: 23, int: null, cos: 11 } }
const SAFE = { info: { locationsActive: [{ secureParam: 1 }] } }
const UNSAFE = { info: { locationsActive: [{ secureParam: 0 }] } }

describe('experience readers (Step 38)', () => {
  it('reads the safe location the way the sleep card does', () => {
    expect(isLocationSafe(SAFE)).toBe(true)
    expect(isLocationSafe(UNSAFE)).toBe(false)
    expect(isLocationSafe({ info: { locationsActive: [{}] } })).toBe(false)
    expect(isLocationSafe(null)).toBe(false)
  })

  it('renders one row per stat with the value, the cost and whether it is affordable', () => {
    const rows = expStatRows(STATS)
    expect(rows.map(r => r.stat)).toEqual(EXP_STATS)
    expect(rows[0]).toEqual({ stat: 'dex', key: 'dexterity', value: 10, cost: 23, atCap: false, affordable: false })
    expect(rows[1]).toEqual({ stat: 'int', key: 'intelligence', value: 12, cost: null, atCap: true, affordable: false })
    expect(rows[2]).toEqual({ stat: 'cos', key: 'constitution', value: 4, cost: 11, atCap: false, affordable: true })
    expect(EXP_STAT_KEY.cos).toBe('constitution')
  })

  it('treats a missing price list as every stat capped', () => {
    const rows = expStatRows({ experience: 99 })
    expect(rows.every(r => r.atCap && !r.affordable)).toBe(true)
    expect(rows[0].value).toBe(0)
    expect(cheapestExpCost({ experience: 99 })).toBeNull()
    expect(cheapestExpCost(null)).toBeNull()
  })

  it('names the cheapest next point', () => {
    expect(cheapestExpCost(STATS)).toBe(11)
  })

  it('offers training only in a safe place, awake, with a point one can pay for', () => {
    expect(canUseExp(SAFE, STATS)).toBe(true)
    expect(canUseExp(UNSAFE, STATS)).toBe(false)
    expect(canUseExp(SAFE, { ...STATS, isComa: true })).toBe(false)
    expect(canUseExp(SAFE, { ...STATS, isSleeping: true })).toBe(false)
    expect(canUseExp(SAFE, { ...STATS, experience: 10 })).toBe(false)
    expect(canUseExp(SAFE, { ...STATS, expCosts: { dex: null, int: null, cos: null } })).toBe(false)
    expect(canUseExp(SAFE, null)).toBe(false)
  })
})
