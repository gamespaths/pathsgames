import { describe, it, expect } from 'vitest'
import sanitizeHtml, { sanitizeHtml as named } from '../utils/sanitizeHtml'

describe('utils/sanitizeHtml', () => {
  it('keeps benign formatting markup', () => {
    const out = sanitizeHtml('<p>hello <b>world</b></p>')
    expect(out).toContain('<b>world</b>')
    expect(out).toContain('<p>')
  })

  it('strips script tags and inline event handlers', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><script>alert(2)</script>ok')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('onerror')
    expect(out).toContain('ok')
  })

  it('returns empty string for non-string or empty input', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
    expect(sanitizeHtml(42)).toBe('')
    expect(sanitizeHtml({})).toBe('')
  })

  it('exposes the same function as default and named export', () => {
    expect(named).toBe(sanitizeHtml)
  })
})
