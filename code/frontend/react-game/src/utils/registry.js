/**
 * The registry as the board reads it. `/info` sends both value columns apart so a client can
 * tell "0" from 0; everything on screen wants the one comparable string, and it must be the
 * same rule the backend renders with — the string wins, else the int, else nothing.
 */
export function registryValue(entry) {
  if (!entry) return null
  if (entry.stringValue !== null && entry.stringValue !== undefined) return entry.stringValue
  if (entry.intValue !== null && entry.intValue !== undefined) return String(entry.intValue)
  return null
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

