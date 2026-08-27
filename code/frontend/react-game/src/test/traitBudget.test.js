import { describe, it, expect } from 'vitest'
import {
  traitCostTotals,
  remainingTraitBudget,
  canAddTrait,
  isTraitSelected,
  toggleTrait,
  selectableTraits,
  isTraitHiddenOnStartMatch,
} from '../utils/traitBudget'

const TR_POS = { uuid: 'tr-pos', costPositive: 1, costNegative: 0 }
const TR_POS2 = { uuid: 'tr-pos2', costPositive: 2, costNegative: 0 }
const TR_NEG = { uuid: 'tr-neg', costPositive: 0, costNegative: 2 }

describe('traitCostTotals', () => {
  it('sums positive and negative costs', () => {
    expect(traitCostTotals([TR_POS, TR_POS2, TR_NEG])).toEqual({ positive: 3, negative: 2 })
  })

  it('handles empty or invalid input', () => {
    expect(traitCostTotals([])).toEqual({ positive: 0, negative: 0 })
    expect(traitCostTotals(null)).toEqual({ positive: 0, negative: 0 })
  })
})

describe('remainingTraitBudget', () => {
  it('returns null sides when the difficulty has no limits', () => {
    expect(remainingTraitBudget({}, [TR_POS])).toEqual({ positive: null, negative: null })
    expect(remainingTraitBudget(null, [TR_POS])).toEqual({ positive: null, negative: null })
  })

  it('subtracts the selection totals from the budgets', () => {
    const difficulty = { traitCostPositiveBudget: 4, traitCostNegativeBudget: 3 }
    expect(remainingTraitBudget(difficulty, [TR_POS, TR_NEG]))
      .toEqual({ positive: 3, negative: 1 })
  })
})

describe('canAddTrait', () => {
  const difficulty = { traitCostPositiveBudget: 2, traitCostNegativeBudget: 2 }

  it('allows a trait within the remaining budget (exact fit included)', () => {
    expect(canAddTrait(TR_POS, [TR_POS], difficulty)).toBe(true) // 1+1 = 2 exact
    expect(canAddTrait(TR_NEG, [], difficulty)).toBe(true)
  })

  it('rejects a trait that would exceed a budget', () => {
    expect(canAddTrait(TR_POS2, [TR_POS], difficulty)).toBe(false) // 1+2 > 2
    expect(canAddTrait(TR_NEG, [TR_NEG], difficulty)).toBe(false)  // 2+2 > 2
  })

  it('always allows when the difficulty has no limits', () => {
    expect(canAddTrait(TR_POS2, [TR_POS, TR_POS2, TR_NEG], {})).toBe(true)
  })
})

describe('isTraitSelected / toggleTrait', () => {
  it('matches by uuid', () => {
    expect(isTraitSelected(TR_POS, [TR_POS, TR_NEG])).toBe(true)
    expect(isTraitSelected(TR_POS2, [TR_POS])).toBe(false)
  })

  it('toggles in and out immutably', () => {
    const selection = [TR_POS]
    const added = toggleTrait(TR_NEG, selection)
    expect(added).toEqual([TR_POS, TR_NEG])
    expect(selection).toEqual([TR_POS])
    expect(toggleTrait(TR_NEG, added)).toEqual([TR_POS])
  })
})

describe('traits hidden from the start-match picker (v0.35.2)', () => {
  const PICKABLE = { uuid: 't1' }
  const EXPLICIT = { uuid: 't2', hideOnStartMatch: false }
  const HIDDEN = { uuid: 't3', hideOnStartMatch: true }

  it('drops only the traits the story flagged', () => {
    expect(selectableTraits([PICKABLE, HIDDEN, EXPLICIT]).map(t => t.uuid))
      .toEqual(['t1', 't2'])
  })

  it('reads a missing flag as pickable — every pre-v0.35.2 trait was', () => {
    expect(isTraitHiddenOnStartMatch(PICKABLE)).toBe(false)
    expect(isTraitHiddenOnStartMatch(EXPLICIT)).toBe(false)
    expect(isTraitHiddenOnStartMatch(HIDDEN)).toBe(true)
    expect(isTraitHiddenOnStartMatch(null)).toBe(false)
  })

  it('survives a story with no traits at all', () => {
    expect(selectableTraits(undefined)).toEqual([])
    expect(selectableTraits(null)).toEqual([])
  })
})
