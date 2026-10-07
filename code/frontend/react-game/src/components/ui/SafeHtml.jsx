import { isValidElement } from 'react'
import { sanitizeHtml, halveBlankLines } from '../../utils/sanitizeHtml'

/**
 * SafeHtml — renders a value that may be a React element OR an HTML string.
 * - React element → rendered directly (e.g. JSX titles/descriptions from gamebook utils)
 * - string        → sanitized and injected as HTML
 * - null/undefined→ nothing
 *
 * Shared by the book "page" rendering for both title and description.
 * `halfBlankLines` (the page description only): a blank line is half a line high.
 */
export default function SafeHtml({ value, halfBlankLines = false }) {
  if (value == null) return null
  if (isValidElement(value)) return value
  const html = sanitizeHtml(String(value))
  return <span dangerouslySetInnerHTML={{ __html: halfBlankLines ? halveBlankLines(html) : html }} />
}
