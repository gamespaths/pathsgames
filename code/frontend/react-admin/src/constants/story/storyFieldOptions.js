const mapOptions = values => values.map(value => ({ value, label: value }))

export const CARD_TYPE_OPTIONS = mapOptions([
  'story',
  'difficulty',
  'creator',
  'card',
  'text',
  'key',
  'class',
  'classBonus',
  'trait',
  'character',
  'location',
  'locationNeighbor',
  'item',
  'itemEffect',
  'event',
  'eventEffect',
  'choice',
  'choiceCondition',
  'choiceEffect',
  'weatherRule',
  'globalRandomEvent',
  'mission',
  'missionStep',
])

// NORMAL and ONCE are the player-executable ones; AUTOMATIC and FIRST are engine-driven.
// ONCE is per-MATCH: once triggered, it stays spent for the rest of that match (Step 29).
export const EVENT_TYPE_OPTIONS = mapOptions([
  'AUTOMATIC',
  'FIRST',
  'NORMAL',
  'ONCE',
])

export const EVENT_EFFECT_TARGET_OPTIONS = mapOptions([
  'ALL',
  'ONLY_ONE',
])

export const POSSIBLE_STATISTICS_OPTIONS = mapOptions([
  'LIFE',
  'ENERGY',
  'SAD',
  'DEXTERITY',
  'INTELLIGENCE',
  'CONSTITUTION',
  'COINS',
  'TIME',
])

// The statistics the Step 29 event engine actually understands — the vocabulary of the
// list_events_effects.statistics column. Anything else is silently dropped at execution,
// which is why event-effects do NOT reuse POSSIBLE_STATISTICS_OPTIONS above: that list
// offers DEXTERITY/INTELLIGENCE/CONSTITUTION/COINS/TIME, none of which the engine matches.
// LIFE, ENERGY and SAD are clamped to their max; the rest never go below zero.
export const EVENT_EFFECT_STATISTICS_OPTIONS = mapOptions([
  'LIFE',
  'ENERGY',
  'SAD',
  'EXP',
  'DEX',
  'INT',
  'COS',
  'FOOD',
  'MAGIC',
  'COIN',
])

export const ITEM_ACTION_OPTIONS = mapOptions([
  'REMOVE',
  'ADD',
])

export const LOGIC_OPERATOR_OPTIONS = mapOptions([
  'AND',
  'OR',
])

export const CHOICE_CONDITION_TYPE_OPTIONS = mapOptions([
  'KEYS',
  'ITEM',
  'CLASS',
  'LOCATION',
  'ALL_IN_SAME_LOC',
  'TRAITS',
  'STATISTICS',
  'STATISTICS_SUM',
])

export const CHOICE_CONDITION_OPERATOR_OPTIONS = mapOptions([
  '=',
  '>',
  '<',
  '!=',
])