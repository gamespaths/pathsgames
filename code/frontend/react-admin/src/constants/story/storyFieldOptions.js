const mapOptions = values => values.map(value => ({ value, label: value }))

export const EVENT_TYPE_OPTIONS = mapOptions([
  'AUTOMATIC',
  'FIRST',
  'NORMAL',
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