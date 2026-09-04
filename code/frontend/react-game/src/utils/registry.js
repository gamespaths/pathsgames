/**
 * The registry as the board reads it. Step 36.1 — a key holds a SET, already rendered and
 * ordered by the backend, so the board neither parses columns nor sorts members.
 */
export function registryValues(entry) {
  return Array.isArray(entry?.values) ? entry.values : []
}

/** The one string a key shows: its members joined, or null when the set is empty. */
export function registryValue(entry) {
  const values = registryValues(entry)
  return values.length === 0 ? null : values.join(', ')
}

/** The visible keys of the match, ordered as the backend groups them: category, priority, key. */
export function visibleRegistry(registry) {
  const rows = Array.isArray(registry) ? registry : []
  return rows
    .filter(r => r?.visible !== false)
    .sort((a, b) =>
      (a.category ?? '').localeCompare(b.category ?? '')
      || (a.priority ?? 0) - (b.priority ?? 0)
      || (a.key ?? '').localeCompare(b.key ?? ''))
}

