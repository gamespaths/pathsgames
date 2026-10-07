/**
 * How long a story text may be. Mirrors list_texts.short_text, widened to
 * VARCHAR(2000) in V0.35.8 — a form that accepts more would fail on save.
 */
export const TEXT_MAX_LENGTH = 2000

/** Counter shown under a capped field: "1 890 / 2000". */
export function textLengthLabel(value, max = TEXT_MAX_LENGTH) {
  return `${(value ?? '').length} / ${max}`
}
