import { describe, it, expect } from 'vitest'
import { isHiddenStory, withoutHiddenStories, compileHiddenLists } from '../utils/hiddenStories'
import hidden from '../data/hidden-stories.json'

const REAL = { uuid: '8415eb87-93c4-4b3b-95ed-d22f2fca8dc0', author: 'Paths.games', category: 'Adventure' }
const SEED = { uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', author: 'PathsMaster', category: 'tutorial' }

describe('data/hidden-stories.json', () => {
  it('ships the three lists, each a list of non-empty strings', () => {
    for (const key of ['uuids', 'authors', 'categories']) {
      expect(Array.isArray(hidden[key])).toBe(true)
      expect(hidden[key].every(v => typeof v === 'string' && v.trim())).toBe(true)
    }
  })

  it('lists the four Robot seed/demo stories by uuid', () => {
    expect(hidden.uuids).toEqual(expect.arrayContaining([
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    ]))
  })
})

describe('isHiddenStory', () => {
  it('matches by uuid, author or category — case-insensitive, whitespace ignored', () => {
    expect(isHiddenStory(SEED)).toBe(true)
    expect(isHiddenStory({ uuid: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D' })).toBe(true)
    expect(isHiddenStory({ uuid: 'x', author: ' pathsmaster ' })).toBe(true)
    expect(isHiddenStory({ uuid: 'x', category: 'RobotTest' })).toBe(true)
  })

  it('lets a real story through, and never hides on a missing field', () => {
    expect(isHiddenStory(REAL)).toBe(false)
    expect(isHiddenStory({})).toBe(false)
    expect(isHiddenStory({ uuid: null, author: undefined })).toBe(false)
    expect(isHiddenStory(null)).toBe(false)
    expect(isHiddenStory(undefined)).toBe(false)
  })

  it('takes custom lists, and treats a malformed list as empty', () => {
    const lists = compileHiddenLists({ uuids: ['x', '', null], authors: 'not-a-list' })
    expect(lists.uuids).toEqual(new Set(['x']))
    expect(lists.authors.size).toBe(0)
    expect(lists.categories.size).toBe(0)
    expect(isHiddenStory({ uuid: 'x' }, lists)).toBe(true)
    expect(isHiddenStory(SEED, lists)).toBe(false)
    expect(isHiddenStory(SEED, compileHiddenLists(null))).toBe(false)
  })
})

describe('withoutHiddenStories', () => {
  it('drops the blacklisted stories and keeps the order of the rest', () => {
    const other = { uuid: 'z', author: 'Someone', category: 'Horror' }
    expect(withoutHiddenStories([SEED, REAL, other])).toEqual([REAL, other])
  })

  it('returns the list untouched when hiding is off', () => {
    const list = [SEED, REAL]
    expect(withoutHiddenStories(list, false)).toBe(list)
  })

  it('survives a catalog that is not an array', () => {
    expect(withoutHiddenStories(null)).toEqual([])
    expect(withoutHiddenStories(undefined, false)).toEqual([])
    expect(withoutHiddenStories('nope')).toEqual([])
  })
})
