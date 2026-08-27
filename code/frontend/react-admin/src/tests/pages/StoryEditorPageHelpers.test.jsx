import { describe, it, expect } from 'vitest'
import {
  REFERENCE_REFRESH_TABS,
  extractNumericId,
  getEnShortText,
  makeReferenceOptions,
  buildLocationOptions,
  buildKeysOptions,
  getOptionDisplay,
  getTextDisplay,
  normalizeIdCardPayload,
  normalizeEntityForForm,
  getNewEntityDefaults,
  mapEntityList,
} from '../../pages/story/StoryEditorPageHelpers'

const TEXTS = [
  { idText: 1, lang: 'en', shortText: 'Hero' },
  { idText: 1, lang: 'it', shortText: 'Eroe' },
  { idText: 2, lang: 'en', shortText: '' },
]

describe('StoryEditorPageHelpers', () => {
  describe('REFERENCE_REFRESH_TABS', () => {
    it('contains the cross-reference entity tabs', () => {
      expect(REFERENCE_REFRESH_TABS).toContain('events')
      expect(REFERENCE_REFRESH_TABS).toContain('cards')
      expect(REFERENCE_REFRESH_TABS).not.toContain('metadata')
    })
  })

  describe('extractNumericId', () => {
    it('returns the first finite numeric value found', () => {
      expect(extractNumericId({ a: '', b: '5' }, ['a', 'b'])).toBe(5)
      expect(extractNumericId({ a: 3 }, ['a'])).toBe(3)
    })
    it('returns null when nothing matches', () => {
      expect(extractNumericId({ a: 'x' }, ['a'])).toBeNull()
      expect(extractNumericId({}, ['missing'])).toBeNull()
      expect(extractNumericId(null, ['a'])).toBeNull()
      expect(extractNumericId({}, [])).toBeNull()
    })
  })

  describe('getEnShortText', () => {
    it('resolves the English shortText of the first text id', () => {
      expect(getEnShortText(TEXTS, { idTextName: 1 })).toBe('Hero')
    })
    it('returns empty string when no id or no match', () => {
      expect(getEnShortText(TEXTS, { idTextName: null })).toBe('')
      expect(getEnShortText(TEXTS, { idTextName: 99 })).toBe('')
      expect(getEnShortText(null, { idTextName: 1 })).toBe('')
    })
  })

  describe('makeReferenceOptions', () => {
    it('builds value/label pairs with resolved labels', () => {
      const result = makeReferenceOptions({
        entities: [{ idEvent: 1, idTextName: 1 }, { idEvent: 2, idTextName: 2 }],
        idKeys: ['idEvent'],
        texts: TEXTS,
      })
      expect(result).toEqual([
        { value: 1, label: '#1 Hero' },
        { value: 2, label: '#2' },
      ])
    })
    it('drops entities without a numeric id', () => {
      const result = makeReferenceOptions({
        entities: [{ name: 'x' }],
        idKeys: ['idEvent'],
        texts: TEXTS,
      })
      expect(result).toEqual([])
    })
    it('handles a missing entities list', () => {
      expect(makeReferenceOptions({ idKeys: ['id'] })).toEqual([])
    })
  })

  describe('buildLocationOptions', () => {
    it('builds labelled options for locations', () => {
      const result = buildLocationOptions(
        [{ id: 3, idTextName: 1 }], TEXTS)
      expect(result).toEqual([{ value: 3, label: '#3 Hero' }])
    })
    it('uses a placeholder when no name text exists', () => {
      const result = buildLocationOptions([{ id: 4, idTextName: 999 }], TEXTS)
      expect(result[0].label).toBe('#4 (no name text)')
    })
    it('filters out non-numeric ids', () => {
      expect(buildLocationOptions([{ idTextName: 1 }], TEXTS)).toEqual([])
    })
  })

  describe('buildKeysOptions', () => {
    it('builds name = value labels', () => {
      expect(buildKeysOptions([{ name: 'k1', value: 'v1' }, { name: 'k2' }]))
        .toEqual([
          { value: 'k1', label: 'k1 = v1' },
          { value: 'k2', label: 'k2' },
        ])
    })
    it('drops keys without a name', () => {
      expect(buildKeysOptions([{ value: 'orphan' }])).toEqual([])
      expect(buildKeysOptions(null)).toEqual([])
    })
  })

  describe('getOptionDisplay', () => {
    const opts = [{ value: 7, label: 'Warrior' }]
    it('returns the matching label', () => {
      expect(getOptionDisplay(opts, 7)).toBe('Warrior')
      expect(getOptionDisplay(opts, '7')).toBe('Warrior')
    })
    it('falls back to #value when not matched', () => {
      expect(getOptionDisplay(opts, 9)).toBe('#9')
    })
    it('returns empty string for empty value', () => {
      expect(getOptionDisplay(opts, null)).toBe('')
      expect(getOptionDisplay(opts, '')).toBe('')
    })
  })

  describe('getTextDisplay', () => {
    it('returns #id + shortText for a known text', () => {
      expect(getTextDisplay(TEXTS, 1)).toBe('#1 Hero')
    })
    it('shows (empty) when the text has no shortText', () => {
      expect(getTextDisplay(TEXTS, 2)).toBe('#2 (empty)')
    })
    it('reports a not-found text', () => {
      expect(getTextDisplay(TEXTS, 99)).toBe('Text #99 (EN not found)')
    })
    it('returns empty string for an empty id', () => {
      expect(getTextDisplay(TEXTS, null)).toBe('')
    })
  })

  describe('normalizeIdCardPayload', () => {
    it('normalises a numeric idCard onto both keys', () => {
      const out = normalizeIdCardPayload({ idCard: '5', name: 'x' })
      expect(out).toEqual({ idCard: 5, id_card: 5, name: 'x' })
    })
    it('empties both keys when idCard is blank', () => {
      const out = normalizeIdCardPayload({ idCard: '' })
      expect(out).toEqual({ idCard: '', id_card: null })
    })
    it('returns a copy unchanged when no card key is present', () => {
      const src = { name: 'x' }
      const out = normalizeIdCardPayload(src)
      expect(out).toEqual({ name: 'x' })
      expect(out).not.toBe(src)
    })
  })

  describe('normalizeEntityForForm', () => {
    it('coerces idCard to a number', () => {
      expect(normalizeEntityForForm({ idCard: '8' }))
        .toEqual({ idCard: 8, id_card: 8 })
    })
    it('uses empty/null when idCard is not finite', () => {
      expect(normalizeEntityForForm({ id_card: 'abc' }))
        .toEqual({ idCard: '', id_card: null })
    })
    it('passes through entities without a card key', () => {
      expect(normalizeEntityForForm({ name: 'x' })).toEqual({ name: 'x' })
    })
    it('returns the value as-is when falsy', () => {
      expect(normalizeEntityForForm(null)).toBeNull()
    })
  })

  describe('getNewEntityDefaults', () => {
    it('provides defaults for location-neighbors', () => {
      const d = getNewEntityDefaults('location-neighbors')
      expect(d).toMatchObject({ flagBack: 1 })
      expect(d.direction).toBeDefined()
    })
    it('a new item shows its effects unless the author unticks the box (Step 35)', () => {
      // An unticked checkbox is written as an explicit 0, so without this default every
      // item created from the form would be born secret.
      expect(getNewEntityDefaults('items')).toMatchObject({ flagShowEffects: 1 })
    })
    it('returns null for other tabs', () => {
      expect(getNewEntityDefaults('difficulties')).toBeNull()
    })
  })

  describe('mapEntityList', () => {
    it('projects entities onto the declared field set and keeps id', () => {
      const result = mapEntityList([{ id: 1, expCost: 5, extra: 'drop' }], 'difficulties')
      expect(result[0].id).toBe(1)
      expect(result[0]).toHaveProperty('expCost', 5)
      expect(result[0]).not.toHaveProperty('extra')
    })
    it('returns an empty array for an unknown type or null list', () => {
      expect(mapEntityList(null, 'difficulties')).toEqual([])
      expect(mapEntityList([{ id: 1 }], 'totally-unknown')).toEqual([{ id: 1 }])
    })
  })
})
