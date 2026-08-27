import { describe, it, expect } from 'vitest'
import {
  withHtmlLineBreaks,
  translationsWithHtmlLineBreaks,
  HTML_LINE_BREAK,
} from '../../utils/htmlLineBreaks'

describe('withHtmlLineBreaks', () => {
  it('stamps a <br /> before a newline and keeps the newline', () => {
    expect(withHtmlLineBreaks('a\nb')).toBe('a<br />\nb')
  })

  it('converts every newline, not just the first', () => {
    expect(withHtmlLineBreaks('a\nb\nc')).toBe('a<br />\nb<br />\nc')
  })

  it('keeps the \\r of a Windows newline', () => {
    expect(withHtmlLineBreaks('a\r\nb')).toBe('a<br />\r\nb')
  })

  it('is idempotent — re-saving an edited text does not stack breaks', () => {
    const once = withHtmlLineBreaks('a\nb')
    expect(withHtmlLineBreaks(once)).toBe(once)
    expect(withHtmlLineBreaks(withHtmlLineBreaks(once))).toBe(once)
  })

  it('recognises any spelling of an existing break', () => {
    for (const br of ['<br>', '<br/>', '<br />', '<BR />', '<br  />']) {
      expect(withHtmlLineBreaks(`a${br}\nb`)).toBe(`a${br}\nb`)
    }
  })

  it('tolerates spaces between an existing break and its newline', () => {
    expect(withHtmlLineBreaks('a<br />  \nb')).toBe('a<br />  \nb')
  })

  it('converts a blank line (two newlines in a row)', () => {
    expect(withHtmlLineBreaks('a\n\nb')).toBe('a<br />\n<br />\nb')
  })

  it('converts a trailing newline too', () => {
    expect(withHtmlLineBreaks('a\n')).toBe('a<br />\n')
  })

  it('leaves a text with no newline untouched', () => {
    expect(withHtmlLineBreaks('just one line')).toBe('just one line')
  })

  it('passes non-strings through, so a null long text stays null', () => {
    expect(withHtmlLineBreaks(null)).toBeNull()
    expect(withHtmlLineBreaks(undefined)).toBeUndefined()
    expect(withHtmlLineBreaks('')).toBe('')
    expect(withHtmlLineBreaks(7)).toBe(7)
  })

  it('exports the break it writes', () => {
    expect(HTML_LINE_BREAK).toBe('<br />')
  })
})

describe('translationsWithHtmlLineBreaks', () => {
  it('converts every field of every language — all four boxes, none forgotten', () => {
    const out = translationsWithHtmlLineBreaks({
      en: { shortText: 'a\nb', longText: 'c\nd' },
      it: { shortText: 'e\nf', longText: 'g\nh' },
    })
    expect(out).toEqual({
      en: { shortText: 'a<br />\nb', longText: 'c<br />\nd' },
      it: { shortText: 'e<br />\nf', longText: 'g<br />\nh' },
    })
  })

  it('leaves null/empty fields alone', () => {
    const out = translationsWithHtmlLineBreaks({
      en: { shortText: '', longText: null },
      it: { shortText: 'x', longText: undefined },
    })
    expect(out).toEqual({
      en: { shortText: '', longText: null },
      it: { shortText: 'x', longText: undefined },
    })
  })

  it('passes a missing or malformed payload through untouched', () => {
    expect(translationsWithHtmlLineBreaks(null)).toBeNull()
    expect(translationsWithHtmlLineBreaks({ en: null })).toEqual({ en: null })
  })
})
