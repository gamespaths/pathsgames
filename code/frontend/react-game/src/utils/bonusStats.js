/**
 * Bonus stat field keys per entity type. Read from `entity[key]` as a Number.
 * Labels resolve via i18n key `book.stats.<key>`.
 */
export const STAT_FIELDS = {
  character: ['lifeMax', 'energyMax', 'sadMax', 'dexterityStart', 'intelligenceStart', 'constitutionStart'],
  class:     ['weightMax', 'dexterityBase', 'intelligenceBase', 'constitutionBase'],
  trait:     ['costPositive', 'costNegative'],
  difficulty:['expCost', 'maxWeight', 'minCharacter', 'maxCharacter', 'costHelpComa', 'costMaxCharacteristics', 'numberMaxFreeAction'],
}

/**
 * Return the non-zero numeric stats for an entity of a given type.
 * Result: [{ key, value }] with value being a finite number != 0.
 */
export function getNonZeroStats(entity, entityType) {
  if (!entity || !entityType) return []
  const keys = STAT_FIELDS[entityType] ?? []
  return keys
    .map(key => ({ key, value: Number(entity[key]) }))
    .filter(s => Number.isFinite(s.value) && s.value !== 0)
}

/**
 * Map entity field keys → category bucket. Fields not listed here are ignored
 * by the totals aggregation (e.g. costPositive/costNegative on traits,
 * minCharacter/maxCharacter on difficulty).
 */
export const STAT_CATEGORY = {
  lifeMax:            'life',
  energyMax:          'energy',
  sadMax:             'sad',
  dexterityStart:     'dexterity',
  dexterityBase:      'dexterity',
  intelligenceStart:  'intelligence',
  intelligenceBase:   'intelligence',
  constitutionStart:  'constitution',
  constitutionBase:   'constitution',
  weightMax:          'weight',
  maxWeight:          'weight',
  expCost:            'exp',
}

/**
 * Display order for totals badges.
 */
export const STAT_CATEGORY_ORDER = ['life', 'energy', 'sad', 'dexterity', 'intelligence', 'constitution', 'weight', 'exp']

/**
 * Aggregate non-zero stats across multiple entity/type pairs into category totals.
 * Each pair: { entity, type }. Returns [{ category, value }] in STAT_CATEGORY_ORDER,
 * skipping categories whose summed value is zero.
 */
export function aggregateBonusTotals(pairs) {
  const totals = {}
  for (const { entity, type } of pairs) {
    for (const { key, value } of getNonZeroStats(entity, type)) {
      const cat = STAT_CATEGORY[key]
      if (!cat) continue
      totals[cat] = (totals[cat] ?? 0) + value
    }
  }
  return STAT_CATEGORY_ORDER
    .map(category => ({ category, value: totals[category] ?? 0 }))
    .filter(item => item.value !== 0)
}
