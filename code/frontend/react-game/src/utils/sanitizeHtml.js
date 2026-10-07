import DOMPurify from 'dompurify'

/**
 * sanitizeHtml — strips any active/script content from an HTML string so it is
 * safe to inject via `dangerouslySetInnerHTML`.
 *
 * Story/card descriptions come from the backend and may contain light markup
 * (line breaks, `<p>`, `<i>`, `<b>`, alignment) authored by content editors.
 * A compromised or malicious backend could otherwise smuggle `<script>`,
 * inline event handlers or `javascript:` URLs — DOMPurify removes all of them
 * while keeping the formatting tags the UI relies on.
 *
 * @param {unknown} dirty raw HTML string (anything else → empty string)
 * @returns {string} sanitized HTML safe for rendering
 */
export function sanitizeHtml(dirty) {
  if (typeof dirty !== 'string' || dirty.length === 0) return ''
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
}

/**
 * Step 40 — a blank line (a run of 2+ `<br>`) becomes half a line high: each extra `<br>` turns
 * into one `.book-page-gap` block (0.5lh), the block itself ending the line of text before it.
 *
 * @param {string} html sanitized HTML
 * @returns {string} the same HTML with its blank lines halved
 */
export function halveBlankLines(html) {
  if (typeof html !== 'string' || html.length === 0) return ''
  return html.replace(/(?:<br\s*\/?>\s*){2,}/gi,
    run => '<span class="book-page-gap"></span>'.repeat(run.match(/<br/gi).length - 1))
}

export default sanitizeHtml
