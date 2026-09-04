import { describe, it, expect } from 'vitest'
import { registryValue, registryValues, visibleRegistry } from '../utils/registry'

describe('registry utils (Step 36)', () => {
  describe('registryValue', () => {
    it('shows the one member of a single-valued key', () => {
      expect(registryValue({ values: ['OPEN'] })).toBe('OPEN')
      expect(registryValue({ values: ['5'] })).toBe('5')
    })

    it('joins the members of a multi-valued key, in the order the backend sent', () => {
      expect(registryValue({ values: ['2', '10', 'alpha'], multiValue: true }))
        .toBe('2, 10, alpha')
    })

    it('reads an empty set as nothing at all', () => {
      expect(registryValue({ values: [] })).toBeNull()
      expect(registryValue({})).toBeNull()
      expect(registryValue(null)).toBeNull()
    })

    it('keeps a zero, which is a value and not an absence', () => {
      expect(registryValue({ values: ['0'] })).toBe('0')
    })

    it('keeps an empty string, which is what a blank default seeds', () => {
      expect(registryValue({ values: [''] })).toBe('')
    })
  })

  describe('registryValues', () => {
    it('hands back the members, and an empty list when there are none', () => {
      expect(registryValues({ values: ['a', 'b'] })).toEqual(['a', 'b'])
      expect(registryValues({})).toEqual([])
      expect(registryValues(null)).toEqual([])
    })
  })

  describe('visibleRegistry', () => {
    it('drops what the story hid and orders category, priority, key', () => {
      const rows = [
        { key: 'z', category: 'b', priority: 1, visible: true },
        { key: 'a', category: 'a', priority: 2, visible: true },
        { key: 'b', category: 'a', priority: 1, visible: true },
        { key: 'hidden', category: 'a', priority: 0, visible: false },
      ]
      expect(visibleRegistry(rows).map(r => r.key)).toEqual(['b', 'a', 'z'])
    })

    it('treats a row with no visible flag as visible, not as hidden', () => {
      expect(visibleRegistry([{ key: 'k' }]).map(r => r.key)).toEqual(['k'])
    })

    it('survives a missing registry', () => {
      expect(visibleRegistry(undefined)).toEqual([])
      expect(visibleRegistry(null)).toEqual([])
    })
  })

})
