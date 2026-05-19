/**
 * StoryEditorPageHelpers — pure helper functions extracted from
 * StoryEditorPage.jsx so they can be unit-tested in isolation (no React
 * rendering, no component state).
 */
import { STORIES_ENTITIES_FIELDS as FIELDS } from '../../constants/story/storiesEntities'
import { LOCATION_NEIGHBOR_DIRECTIONS } from '../../constants/story/locationNeighbors'

/** Entity tabs whose change must refresh the cross-reference option lists. */
export const REFERENCE_REFRESH_TABS = [
  'events', 'traits', 'items', 'classes', 'choices',
  'missions', 'keys', 'cards', 'weather-rules',
]

/**
 * Returns the first finite numeric value found by probing `keys` on `entity`.
 * @returns {number|null}
 */
export function extractNumericId(entity, keys = []) {
  for (const key of keys) {
    const value = entity?.[key]
    if (value === null || value === undefined || value === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/**
 * Resolves the English shortText of the first text id found on `entity`.
 */
export function getEnShortText(texts, entity, textIdKeys = ['idTextName']) {
  const textId = extractNumericId(entity, textIdKeys)
  if (textId === null) return ''
  const match = (texts || []).find(
    item => Number(item.idText) === textId && item.lang === 'en')
  return match?.shortText || ''
}

/**
 * Builds `{ value, label }` option entries for a list of reference entities.
 */
export function makeReferenceOptions({ entities, idKeys, textIdKeys = ['idTextName'], texts = [] }) {
  return (entities || [])
    .map(entity => {
      const id = extractNumericId(entity, idKeys)
      if (id === null) return null
      const shortText = getEnShortText(texts, entity, textIdKeys)
      return { value: id, label: shortText ? `#${id} ${shortText}` : `#${id}` }
    })
    .filter(Boolean)
}

/**
 * Builds `{ value, label }` option entries for the story locations.
 */
export function buildLocationOptions(locations = [], texts = []) {
  return locations
    .map(location => {
      const locationId = location.idLocation ?? location.id ?? location.id_location
      const nameText = (texts || []).find(
        item => Number(item.idText) === Number(location.idTextName) && item.lang === 'en')
      return {
        value: Number(locationId),
        label: `#${locationId} ${nameText?.shortText || '(no name text)'}`,
      }
    })
    .filter(option => !Number.isNaN(option.value))
}

/**
 * Builds `{ value, label }` option entries for the story keys.
 */
export function buildKeysOptions(keysRef = []) {
  return (keysRef || [])
    .map(keyEntity => {
      const keyName = keyEntity?.name
      if (!keyName) return null
      const keyValue = keyEntity?.value
      return { value: keyName, label: keyValue ? `${keyName} = ${keyValue}` : keyName }
    })
    .filter(Boolean)
}

/**
 * Resolves the display label for a value against a pre-built option list.
 */
export function getOptionDisplay(options, value) {
  if (value === null || value === undefined || value === '') return ''
  const match = (options || []).find(option => String(option.value) === String(value))
  return match?.label || `#${value}`
}

/**
 * Resolves the display label for a text id directly against the texts list.
 */
export function getTextDisplay(texts, idText) {
  if (idText === null || idText === undefined || idText === '') return ''
  const target = (texts || []).find(
    item => Number(item.idText) === Number(idText) && item.lang === 'en')
  if (!target) return `Text #${idText} (EN not found)`
  return `#${idText} ${target.shortText || '(empty)'}`
}

/**
 * Normalises the `idCard` / `id_card` pair on an entity so it has consistent
 * types before being sent to the persistence layer. Returns a new object.
 */
export function normalizeIdCardPayload(payload) {
  const next = { ...payload }
  const hasCardKey = Object.prototype.hasOwnProperty.call(next, 'idCard')
    || Object.prototype.hasOwnProperty.call(next, 'id_card')
  if (!hasCardKey) return next

  const rawIdCard = next.idCard ?? next.id_card
  const normalizedIdCard = Number(rawIdCard)
  if (rawIdCard === '' || rawIdCard === null || rawIdCard === undefined) {
    next.idCard = ''
    next.id_card = null
  } else if (Number.isFinite(normalizedIdCard)) {
    next.idCard = normalizedIdCard
    next.id_card = normalizedIdCard
  }
  return next
}

/**
 * Normalises an entity loaded from the API before it is shown in EntityForm:
 * keeps the `idCard` / `id_card` pair consistent.
 */
export function normalizeEntityForForm(entity) {
  if (!entity) return entity
  const next = { ...entity }
  if (Object.prototype.hasOwnProperty.call(next, 'idCard')
    || Object.prototype.hasOwnProperty.call(next, 'id_card')) {
    const normalized = Number(next.idCard ?? next.id_card)
    next.idCard = Number.isFinite(normalized) ? normalized : ''
    next.id_card = Number.isFinite(normalized) ? normalized : null
  }
  return next
}

/**
 * Default field values for a freshly created entity of `activeTab`.
 * @returns {object|null}
 */
export function getNewEntityDefaults(activeTab) {
  if (activeTab === 'location-neighbors') {
    return { direction: LOCATION_NEIGHBOR_DIRECTIONS[0], flagBack: 1 }
  }
  return null
}

/**
 * Projects an entity list onto the field set declared in FIELDS[entityType],
 * defaulting missing fields to null and preserving the `id` reference.
 * Used by the story-export feature.
 */
export function mapEntityList(list, entityType) {
  const fieldKeys = (FIELDS[entityType] ?? []).map(f => f.key)
  return (list ?? []).map(entity => {
    const mapped = {}
    for (const key of fieldKeys) {
      mapped[key] = entity[key] ?? null
    }
    if (entity.id !== undefined) mapped.id = entity.id
    return mapped
  })
}
