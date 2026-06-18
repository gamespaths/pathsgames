/**
 * Step 23 — trait cost budget helpers.
 *
 * A difficulty may define `traitCostPositiveBudget` / `traitCostNegativeBudget`:
 * the sums of `costPositive` and `costNegative` over the selected traits must
 * each stay within the budgets. A null/undefined budget means "no limit".
 */

function nz(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Total positive/negative cost of the selected traits. */
export function traitCostTotals(traits) {
  const list = Array.isArray(traits) ? traits : []
  return {
    positive: list.reduce((sum, t) => sum + nz(t?.costPositive), 0),
    negative: list.reduce((sum, t) => sum + nz(t?.costNegative), 0),
  }
}

/**
 * Remaining budget after the current selection.
 * Each side is a number, or null when the difficulty has no limit.
 */
export function remainingTraitBudget(difficulty, selectedTraits) {
  const totals = traitCostTotals(selectedTraits)
  const positiveBudget = difficulty?.traitCostPositiveBudget ?? null
  const negativeBudget = difficulty?.traitCostNegativeBudget ?? null
  return {
    positive: positiveBudget !== null ? nz(positiveBudget) - totals.positive : null,
    negative: negativeBudget !== null ? nz(negativeBudget) - totals.negative : null,
  }
}

/**
 * Whether `trait` can be added to `selectedTraits` without exceeding the
 * difficulty budgets. Already-selected traits can always be toggled off.
 */
export function canAddTrait(trait, selectedTraits, difficulty) {
  const remaining = remainingTraitBudget(difficulty, selectedTraits)
  if (remaining.positive !== null && nz(trait?.costPositive) > remaining.positive) return false
  if (remaining.negative !== null && nz(trait?.costNegative) > remaining.negative) return false
  return true
}

/** True when the trait is in the selection (matched by uuid). */
export function isTraitSelected(trait, selectedTraits) {
  if (!trait?.uuid || !Array.isArray(selectedTraits)) return false
  return selectedTraits.some(t => t?.uuid === trait.uuid)
}

/** Toggle the trait in the selection (immutable; matched by uuid). */
export function toggleTrait(trait, selectedTraits) {
  const list = Array.isArray(selectedTraits) ? selectedTraits : []
  if (isTraitSelected(trait, list)) {
    return list.filter(t => t?.uuid !== trait.uuid)
  }
  return [...list, trait]
}
