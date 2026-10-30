// v1.11.0 safeExternalUrl: only http(s) links from story/image data are opened.
import { describe, it, expect } from 'vitest'
import { safeExternalUrl } from '../utils/safeUrl'

describe('safeExternalUrl', () => {
  it('keeps http and https links as written', () => {
    expect(safeExternalUrl('https://paths.games')).toBe('https://paths.games')
    expect(safeExternalUrl(' http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1')
  })

  it('drops any other scheme, junk and empty values', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x',
      'file:///etc/passwd', 'not a url', '//evil.example', '', '   ', null, undefined, 42]) {
      expect(safeExternalUrl(bad)).toBeNull()
    }
  })
})
