/**
 * Story texts are authored in plain textareas but rendered as HTML by both game boards,
 * where a bare newline collapses into a space. Saving therefore stamps a `<br />` in front
 * of every newline: the break survives the render, and the newline itself stays so the
 * stored text is still readable in the editor, in a diff and in the database.
 *
 * The rule is deliberately idempotent. `initialValues` loads the STORED text back into the
 * boxes when an author reopens a text, so a second save sees `<br />\n` and must leave it
 * alone — otherwise every edit would stack another break onto every line.
 */

/** Matches a newline, capturing an already-present break (and any spaces after it). */
const NEWLINE_WITH_OPTIONAL_BREAK = /(<br\s*\/?>[ \t]*)?(\r?\n)/gi

export const HTML_LINE_BREAK = '<br />'

/**
 * Insert `<br />` before every newline that has not got one already.
 *
 *   "a\nb"          -> "a<br />\nb"
 *   "a<br />\nb"    -> "a<br />\nb"      (unchanged: already converted)
 *   "a<br/>\nb"     -> "a<br/>\nb"       (unchanged: any spelling counts)
 *   "a\r\nb"        -> "a<br />\r\nb"    (Windows newlines keep their \r)
 *
 * Non-strings and empty strings pass through untouched, so a null long-text stays null
 * rather than becoming "".
 */
export function withHtmlLineBreaks(value) {
  if (typeof value !== 'string' || value === '') return value
  return value.replace(NEWLINE_WITH_OPTIONAL_BREAK,
    (match, existingBreak, newline) => (existingBreak ? match : HTML_LINE_BREAK + newline))
}

/**
 * The same conversion over the `{ en: {...}, it: {...} }` shape the Fast Text Creator
 * submits, so the caller cannot convert three boxes and forget the fourth.
 */
export function translationsWithHtmlLineBreaks(translations) {
  if (!translations || typeof translations !== 'object') return translations
  return Object.fromEntries(
    Object.entries(translations).map(([lang, fields]) => [
      lang,
      fields && typeof fields === 'object'
        ? Object.fromEntries(
            Object.entries(fields).map(([key, val]) => [key, withHtmlLineBreaks(val)]))
        : fields,
    ]))
}
