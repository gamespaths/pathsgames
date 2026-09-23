import { describe, it, expect } from 'vitest'
import { stripNulls, normalizeImportJson } from '../../utils/storyJson'

describe('storyJson', () => {
  describe('stripNulls', () => {
    it('drops null and undefined properties at every depth', () => {
      const input = {
        a: 1, b: null, c: undefined,
        nested: { x: null, y: 'ok', deeper: { z: null, w: 0 } },
        list: [{ id: 1, maxPerCharacter: null, weight: 0 }],
      }
      expect(stripNulls(input)).toEqual({
        a: 1,
        nested: { y: 'ok', deeper: { w: 0 } },
        list: [{ id: 1, weight: 0 }],
      })
    })

    it('keeps falsy values that are not null', () => {
      expect(stripNulls({ zero: 0, no: false, empty: '', arr: [] }))
        .toEqual({ zero: 0, no: false, empty: '', arr: [] })
    })

    it('preserves array length and order, including null elements', () => {
      expect(stripNulls([null, 1, { a: null }])).toEqual([null, 1, {}])
    })

    it('returns primitives and null unchanged', () => {
      expect(stripNulls(null)).toBeNull()
      expect(stripNulls(5)).toBe(5)
      expect(stripNulls('s')).toBe('s')
    })
  })

  describe('normalizeImportJson', () => {
    it('lifts a nested story header next to the entity arrays', () => {
      const input = { story: { uuid: 'u1', author: 'A' }, texts: [{ idText: 1 }] }
      expect(normalizeImportJson(input)).toEqual({ uuid: 'u1', author: 'A', texts: [{ idText: 1 }] })
    })

    it('lets a top-level field win over the nested one', () => {
      expect(normalizeImportJson({ story: { uuid: 'old' }, uuid: 'new' })).toEqual({ uuid: 'new' })
    })

    it('leaves the flat shape and non-object inputs untouched', () => {
      const flat = { uuid: 'u1', texts: [] }
      expect(normalizeImportJson(flat)).toBe(flat)
      expect(normalizeImportJson({ story: null, uuid: 'u' })).toEqual({ story: null, uuid: 'u' })
      expect(normalizeImportJson({ story: ['x'] })).toEqual({ story: ['x'] })
      expect(normalizeImportJson(null)).toBeNull()
      expect(normalizeImportJson([1])).toEqual([1])
    })
  })
})
