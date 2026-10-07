import { describe, it, expect } from 'vitest'
import {
  traitCostTotals,
  remainingTraitBudget,
  canAddTrait,
  isTraitSelected,
  toggleTrait,
  selectableTraits,
  isTraitHiddenOnStartMatch,
  fitTraitsToBudget,
  budgetSides,
  traitCostItems,
  traitBudgetItems,
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

describe('fitTraitsToBudget', () => {
  it('keeps, in order, only the traits the budgets can still pay for', () => {
    const difficulty = { traitCostPositiveBudget: 2, traitCostNegativeBudget: 1 }
    expect(fitTraitsToBudget([TR_POS, TR_POS2, TR_NEG, TR_POS], difficulty)).toEqual([TR_POS, TR_POS])
  })

  it('keeps everything under a difficulty with no limits, and reads a non-array as empty', () => {
    expect(fitTraitsToBudget([TR_POS, TR_POS2, TR_NEG], null)).toEqual([TR_POS, TR_POS2, TR_NEG])
    expect(fitTraitsToBudget(undefined, {})).toEqual([])
  })
})

describe('budgetSides', () => {
  it('a side is budgeted only by a positive budget: null and zero mean "not played"', () => {
    expect(budgetSides({ traitCostPositiveBudget: 2, traitCostNegativeBudget: 0 })).toEqual({ positive: true, negative: false })
    expect(budgetSides({ traitCostNegativeBudget: 3 })).toEqual({ positive: false, negative: true })
    expect(budgetSides(null)).toEqual({ positive: false, negative: false })
  })
})

describe('traitCostItems', () => {
  const BOTH = { traitCostPositiveBudget: 2, traitCostNegativeBudget: 3 }

  it('badges the + and − cost of one trait, zero included, on the budgeted sides', () => {
    const items = traitCostItems({ costPositive: 2 }, k => `L:${k}`, BOTH)
    expect(items).toEqual([
      { key: 'costPositive', label: 'L:book.stats.costPositive', value: 2, keepZero: true },
      { key: 'costNegative', label: 'L:book.stats.costNegative', value: 0, keepZero: true },
    ])
  })

  it('drops the side the difficulty does not budget (null or zero)', () => {
    expect(traitCostItems({ costPositive: 2, costNegative: 1 }, k => k, { traitCostPositiveBudget: 2 }).map(i => i.key))
      .toEqual(['costPositive'])
    expect(traitCostItems({ costPositive: 2, costNegative: 1 }, k => k, { traitCostPositiveBudget: 0, traitCostNegativeBudget: 3 }).map(i => i.key))
      .toEqual(['costNegative'])
  })

  it('reads a missing trait as free, and no difficulty as no badge at all', () => {
    expect(traitCostItems(null, undefined, BOTH).map(i => i.label)).toEqual(['book.stats.costPositive', 'book.stats.costNegative'])
    expect(traitCostItems({ costPositive: 5 })).toEqual([])
  })
})

describe('traitBudgetItems', () => {
  it('formats used/max on each budgeted side only', () => {
    const items = traitBudgetItems({ traitCostPositiveBudget: 4 }, [TR_POS, TR_NEG], k => k)
    expect(items).toEqual([
      { key: 'costPositive', label: 'book.traitBudgetPositive', value: '1/4', keepZero: true },
    ])
  })

  it('shows 0/max for an empty selection under a limited difficulty', () => {
    const items = traitBudgetItems({ traitCostPositiveBudget: 2, traitCostNegativeBudget: 3 }, [])
    expect(items.map(i => i.value)).toEqual(['0/2', '0/3'])
  })

  it('shows nothing when the difficulty budgets neither side (null, zero or no difficulty)', () => {
    expect(traitBudgetItems(null, [TR_POS2])).toEqual([])
    expect(traitBudgetItems({ traitCostPositiveBudget: 0, traitCostNegativeBudget: null }, [TR_POS2])).toEqual([])
  })
})
