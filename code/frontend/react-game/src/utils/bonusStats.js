/**
 * Bonus stat field keys per entity type. Read from `entity[key]` as a Number.
 * Labels resolve via i18n key `book.stats.<key>`.
 */
export const STAT_FIELDS = {
  character: ['lifeMax', 'energyMax', 'sadMax', 'dexterityStart', 'intelligenceStart', 'constitutionStart'],
  class:     ['weightMax', 'dexterityBase', 'intelligenceBase', 'constitutionBase'],
  trait:     ['costPositive', 'costNegative', 'life', 'energy', 'sad', 'dexterity', 'intelligence', 'constitution', 'weight'],
  difficulty:['expCost', 'maxWeight', 'minCharacter', 'maxCharacter', 'costHelpComa', 'costMaxCharacteristics', 'numberMaxFreeAction',
              'life', 'energy', 'sad', 'dexterity', 'intelligence', 'constitution', 'weight'],
}

/**
 * Map a class-bonus `statistic` code (from list_classes_bonus.statistic — values
 * such as 'life', 'energy', 'sad', 'dex', 'int', 'cos', 'exp', 'weight') to the
 * canonical category key used by STAT_CATEGORY_ORDER and the totals i18n keys.
 */
const BONUS_STAT_TO_CATEGORY = {
  life: 'life',
  energy: 'energy',
  sad: 'sad',
  dex: 'dexterity',
  dexterity: 'dexterity',
  int: 'intelligence',
  intelligence: 'intelligence',
  cos: 'constitution',
  constitution: 'constitution',
  weight: 'weight',
  exp: 'exp',
}

/**
 * Convert a class entity's `bonuses` array (rows from list_classes_bonus exposed
 * by the public API) into the same { key, value } shape that `getNonZeroStats`
 * produces. `key` is the canonical category — labels resolve via
 * `book.stats.totals.<key>` so existing badges can render them.
 */
export function getClassBonusStats(classEntity) {
  if (!classEntity || !Array.isArray(classEntity.bonuses)) return []
  return classEntity.bonuses
    .map(b => {
      const stat = String(b?.statistic ?? '').toLowerCase()
      const category = BONUS_STAT_TO_CATEGORY[stat]
      const value = Number(b?.value)
      if (!category || !Number.isFinite(value) || value === 0) return null
      return { key: category, value }
    })
    .filter(Boolean)
}

/**
 * Return the non-zero numeric stats for an entity of a given type.
 * Result: [{ key, value }] with value being a finite number != 0.
 *
 * For `class` entities the returned list also contains the rows from
 * `class.bonuses[]` mapped to their canonical category keys.
 */
export function getNonZeroStats(entity, entityType) {
  if (!entity || !entityType) return []
  const keys = STAT_FIELDS[entityType] ?? []
  const baseStats = keys
    .map(key => ({ key, value: Number(entity[key]) }))
    .filter(s => Number.isFinite(s.value) && s.value !== 0)
  if (entityType === 'class') {
    return baseStats.concat(getClassBonusStats(entity))
  }
  return baseStats
}

/**
 * Map entity field keys → category bucket. Fields not listed here are ignored
 * by the totals aggregation (e.g. costPositive/costNegative on traits,
 * minCharacter/maxCharacter on difficulty).
 *
 * Canonical category names (life, energy, …) map to themselves so that the
 * { key, value } entries produced by `getClassBonusStats` flow through
 * `aggregateBonusTotals` without extra branching.
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
  life:               'life',
  energy:             'energy',
  sad:                'sad',
  dexterity:          'dexterity',
  intelligence:       'intelligence',
  constitution:       'constitution',
  weight:             'weight',
  exp:                'exp',
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

/**
 * Build a lookup map of classes keyed by their numeric `id`. Class objects
 * come from `story.classes` and expose both `uuid` and `id` (see
 * ClassInfoResponse on the public API).
 */
export function buildClassesById(classes) {
  const map = {}
  if (!Array.isArray(classes)) return map
  for (const cls of classes) {
    if (cls?.id != null) map[String(cls.id)] = cls
  }
  //console.log("classesById",map);
  return map
}

/**
 * Evaluate whether `candidate` (any entity with restrictions or a class being
 * evaluated against template restrictions) is permitted given the current
 * selection context.
 *
 * `restrictionSource` is the entity whose `idClassPermitted`/`idClassProhibited`
 * columns define the rule; `candidateClassId` is the id of the class being
 * compared against the rule.
 *
 * Returns `{ locked: bool, reason: 'requires'|'prohibited'|null, requiredClassId?, prohibitedClassId? }`.
 */
function evaluateRestriction(restrictionSource, candidateClassId) {
  if (!restrictionSource || candidateClassId == null) {
    return { locked: false, reason: null }
  }
  const permitted = restrictionSource.idClassPermitted ?? null
  const prohibited = restrictionSource.idClassProhibited ?? null
  if (permitted != null && permitted != '' && String(permitted) !== String(candidateClassId)) {
    return { locked: true, reason: 'requires', requiredClassId: permitted }
  }
  if (prohibited != null && prohibited != '' && String(prohibited) === String(candidateClassId)) {
    return { locked: true, reason: 'prohibited', prohibitedClassId: prohibited }
  }
  return { locked: false, reason: null }
}

/**
 * Check whether a given class is allowed by a character template's class
 * restriction columns (idClassPermitted / idClassProhibited).
 * Returns true if no restriction blocks the class.
 */
export function isClassAllowedByTemplate(classEntity, template) {
  if (!template || !classEntity) return true
  const candidateId = classEntity.id ?? classEntity.uuid
  return !evaluateRestriction(template, candidateId).locked
}

/**
 * Determine the lock reason for an option being selected in a SelectionView.
 *
 * - `type`: 'class' | 'character' | 'trait'
 * - `option`: the entity being rendered as a card
 * - `config`: current selections { character, class, trait, difficulty }
 * - `classesById`: lookup map produced by buildClassesById(story.classes)
 *
 * Returns null when allowed, or `{ kind, classId, className }` describing why
 * the option is locked. `kind` is `'requires'` (template/trait demands a specific
 * class) or `'prohibited'` (the option is incompatible with the current class).
 */
export function getOptionLockInfo({ type, option, config, classesById }) {
  if (!option) return null

  // A class option locked by the currently-selected template's restrictions.
  if (type === 'class') { 
    return null ; //class is always allowed in class selection step
    /*
    const template = config?.character
    if (!template) return null
    const res = evaluateRestriction(template, option.id ?? option.uuid)
    if (!res.locked) return null
    const classId = res.requiredClassId ?? res.prohibitedClassId
    const className = classesById?.[String(classId)]?.name ?? null
    return { kind: res.reason, classId, className }*/
  }

  // A character-template option locked by its own restrictions vs the
  // currently-selected class.
  if (type === 'character') {
    const cls = config?.class
    if (!cls) return null
    const res = evaluateRestriction(option, cls.id ?? cls.uuid)
    if (!res.locked) return null
    const classId = res.requiredClassId ?? res.prohibitedClassId
    //find name from classes list [{id,card:{name,..},..},..], so search by id and get card.name
    const className = classesById?.[String(classId)]?.card?.title ?? null
    //console.log("getOptionLockInfo", { option, cls, res, classId, className , classesById})    
    return { kind: res.reason, classId, className , res}
  }

  // A trait option locked by its own restrictions vs the currently-selected class.
  if (type === 'trait') {
    const cls = config?.class
    if (!cls) return null
    const res = evaluateRestriction(option, cls.id ?? cls.uuid)
    if (!res.locked) return null
    const classId = res.requiredClassId ?? res.prohibitedClassId
    const className = classesById?.[String(classId)]?.card?.title ?? null
    return { kind: res.reason, classId, className , res}
  }

  return null
}
