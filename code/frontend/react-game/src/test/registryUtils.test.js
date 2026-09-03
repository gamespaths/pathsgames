import { describe, it, expect } from 'vitest'
import { registryValue, visibleRegistry } from '../utils/registry'

describe('registry utils (Step 36)', () => {
  describe('registryValue', () => {
    it('renders the string, else the int, else nothing — the backend rule', () => {
      expect(registryValue({ stringValue: 'OPEN', intValue: null })).toBe('OPEN')
      expect(registryValue({ stringValue: null, intValue: 5 })).toBe('5')
      expect(registryValue({ stringValue: null, intValue: null })).toBeNull()
      expect(registryValue(null)).toBeNull()
    })

    it('keeps a zero, which is a value and not an absence', () => {
      expect(registryValue({ stringValue: null, intValue: 0 })).toBe('0')
    })

    it('keeps an empty string, which is what a blank default seeds', () => {
      expect(registryValue({ stringValue: '', intValue: null })).toBe('')
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
