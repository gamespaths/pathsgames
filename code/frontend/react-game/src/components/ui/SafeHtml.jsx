import { isValidElement } from 'react'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

/**
 * SafeHtml — renders a value that may be a React element OR an HTML string.
 * - React element → rendered directly (e.g. JSX titles/descriptions from gamebook utils)
 * - string        → sanitized and injected as HTML
 * - null/undefined→ nothing
 *
 * Shared by the book "page" rendering for both title and description.
 */
export default function SafeHtml({ value }) {
  if (value == null) return null
  if (isValidElement(value)) return value
  return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }} />
}
