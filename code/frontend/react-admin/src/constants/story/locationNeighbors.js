export const LOCATION_NEIGHBOR_DIRECTIONS = [
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'ABOVE',
  'BELOW',
  'SKY',
]

export const LOCATION_NEIGHBOR_DIRECTION_OPTIONS = LOCATION_NEIGHBOR_DIRECTIONS.map(direction => ({
  value: direction,
  label: direction,
}))

export const LOCATION_NEIGHBOR_FLAG_BACK_OPTIONS = [
  { value: 1, label: 'YES' },
  { value: 0, label: 'NO' },
]
