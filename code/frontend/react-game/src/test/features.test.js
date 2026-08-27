import { describe, it, expect } from 'vitest'
import {
  parseFlag, hideWhereClass,
  SHOW_BOOK_BOOKMARKS, SHOW_CARD_CHARACTERISTICS, SHOW_MOBILE_CARD_CHARACTERISTICS,
} from '../constants/features'

describe('constants/features', () => {
  it('keeps the fallback when the env var says nothing', () => {
    expect(parseFlag(undefined, true)).toBe(true)
    expect(parseFlag(null, false)).toBe(false)
    expect(parseFlag('', true)).toBe(true)
  })

  it('reads the words a build uses to turn a feature off', () => {
    for (const off of ['false', '0', 'no', 'off', ' OFF ', 'False']) {
      expect(parseFlag(off, true)).toBe(false)
    }
  })

  it('treats anything else as on', () => {
    for (const on of ['true', '1', 'yes', 'whatever']) expect(parseFlag(on, false)).toBe(true)
  })

  it('ships the bookmarks on, and the status card on mobile only', () => {
    expect(SHOW_BOOK_BOOKMARKS).toBe(true)
    // Inside the book the bookmarks carry the same news, so the card sits that copy out.
    expect(SHOW_CARD_CHARACTERISTICS).toBe(false)
    // The mobile stack has no bookmarks at all: without the card the news would be lost.
    expect(SHOW_MOBILE_CARD_CHARACTERISTICS).toBe(true)
  })
})

describe('hideWhereClass', () => {
  it('asks for no class at all when both copies show the card', () => {
    expect(hideWhereClass(true, true)).toBeNull()
  })

  it('hides the book copy alone — the mobile stack keeps it', () => {
    expect(hideWhereClass(false, true)).toBe('hide-in-book')
  })

  it('hides the mobile copy alone', () => {
    expect(hideWhereClass(true, false)).toBe('hide-in-mobile')
  })

  it('names both when neither side wants it (the caller then renders nothing)', () => {
    expect(hideWhereClass(false, false)).toBe('hide-in-book hide-in-mobile')
  })
})
