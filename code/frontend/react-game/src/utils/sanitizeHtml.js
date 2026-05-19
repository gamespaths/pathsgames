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

export default sanitizeHtml
