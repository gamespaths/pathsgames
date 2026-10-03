/**
 * storyJson — shared helpers for the story JSON export/import contract.
 * Nulls are omitted on export; every backend reads an absent key as null/default.
 */

const isPlainObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// Recursively drops null/undefined object properties; array order and length are preserved.
export function stripNulls(value) {
  if (Array.isArray(value)) {
    return value.map(stripNulls)
  }
  if (isPlainObject(value)) {
    return Object.keys(value).reduce((acc, key) => {
      if (value[key] !== null && value[key] !== undefined) {
        acc[key] = stripNulls(value[key])
      }
      return acc
    }, {})
  }
  return value
}

// Backends read the header top-level: lift a legacy nested `story` block up next to the entity arrays.
export function normalizeImportJson(data) {
  if (!isPlainObject(data) || !isPlainObject(data.story)) {
    return data
  }
  const { story, ...rest } = data
  return { ...story, ...rest }
}

// v0.41.5 — same shape every backend accepts on import; case and spaces are normalized there.
const STORY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// True when the story uuid is absent or blank (the backend mints one) or a valid 8-4-4-4-12 UUID.
export function isValidStoryUuid(raw) {
  if (raw === null || raw === undefined) return true
  const value = String(raw).trim().toLowerCase()
  return value === '' || STORY_UUID.test(value)
}

// One admin CRUD row as the story export writes it: stamps and idStory out, text ids fixed, and
// v0.41.4 the template id (idTipo) as id — the bundled-story format of the match export.
export function exportEntity(jsonKey, item) {
  // eslint-disable-next-line no-unused-vars
  const { tsInsert, tsUpdate, idStory, ...rest } = item
  if (jsonKey === 'texts' && item.idText) {
    rest.id = Number(item.idText)
    rest.idText = Number(item.idText)
  } else if (rest.id == null && item.idTipo != null) {
    rest.id = item.idTipo
  }
  return rest
}
