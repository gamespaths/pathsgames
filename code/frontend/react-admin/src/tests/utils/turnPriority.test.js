import { describe, it, expect } from 'vitest'
import { computeTurnPriority, buildTurnOrder } from '../../utils/turnPriority'

describe('turnPriority', () => {
  describe('computeTurnPriority', () => {
    it('applies the (DEX*3 + INT*2 + COS) * 1000 + LIFE*10 formula', () => {
      // (3*3 + 3*2 + 3) * 1000 + 10*10 = 18000 + 100
      expect(computeTurnPriority({ dexterity: 3, intelligence: 3, constitution: 3, life: 10 }))
        .toBe(18100)
    })

    it('dexterity dominates', () => {
      const high = computeTurnPriority({ dexterity: 5, intelligence: 1, constitution: 1, life: 1 })
      const low = computeTurnPriority({ dexterity: 1, intelligence: 1, constitution: 1, life: 1 })
      expect(high).toBeGreaterThan(low)
    })

    it('treats missing / non-numeric stats as zero', () => {
      expect(computeTurnPriority({})).toBe(0)
      expect(computeTurnPriority({ dexterity: 'x', life: null })).toBe(0)
      expect(computeTurnPriority(undefined)).toBe(0)
    })
  })

  describe('buildTurnOrder', () => {
    it('sorts by priority descending', () => {
      const players = [
        { uuid: 'a', dexterity: 1, intelligence: 1, constitution: 1, life: 1 },
        { uuid: 'b', dexterity: 9, intelligence: 1, constitution: 1, life: 1 },
        { uuid: 'c', dexterity: 5, intelligence: 1, constitution: 1, life: 1 },
      ]
      const order = buildTurnOrder(players)
      expect(order.map(p => p.uuid)).toEqual(['b', 'c', 'a'])
      expect(order[0].priority).toBeGreaterThan(order[1].priority)
    })

    it('tie-breaks deterministically by uuid', () => {
      const stats = { dexterity: 2, intelligence: 2, constitution: 2, life: 5 }
      const players = [{ uuid: 'zeta', ...stats }, { uuid: 'alpha', ...stats }]
      const order = buildTurnOrder(players)
      expect(order.map(p => p.uuid)).toEqual(['alpha', 'zeta'])
    })

    it('returns an empty array for non-array input', () => {
      expect(buildTurnOrder(undefined)).toEqual([])
      expect(buildTurnOrder(null)).toEqual([])
    })

    it('does not mutate the input rows', () => {
      const players = [{ uuid: 'a', dexterity: 1 }]
      buildTurnOrder(players)
      expect(players[0].priority).toBeUndefined()
    })
  })
})
