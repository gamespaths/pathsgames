import { describe, it, expect } from 'vitest'
import {
  getNonZeroStats,
  getClassBonusStats,
  aggregateBonusTotals,
  isClassAllowedByTemplate,
  buildClassesById,
  getOptionLockInfo,
  STAT_CATEGORY_ORDER,
} from '../utils/bonusStats'

describe('getNonZeroStats', () => {
  it('returns only non-zero base stats for a character', () => {
    const character = { lifeMax: 12, energyMax: 0, sadMax: 8, dexterityStart: 0, intelligenceStart: 3 }
    const stats = getNonZeroStats(character, 'character')
    expect(stats).toEqual([
      { key: 'lifeMax', value: 12 },
      { key: 'sadMax', value: 8 },
      { key: 'intelligenceStart', value: 3 },
    ])
  })

  it('returns base stats AND class bonuses for a class', () => {
    const cls = {
      weightMax: 12,
      dexterityBase: 0,
      intelligenceBase: 3,
      constitutionBase: 0,
      bonuses: [
        { statistic: 'life', value: 3 },
        { statistic: 'energy', value: 2 },
        { statistic: 'sad', value: 0 },
      ],
    }
    const stats = getNonZeroStats(cls, 'class')
    expect(stats).toContainEqual({ key: 'weightMax', value: 12 })
    expect(stats).toContainEqual({ key: 'intelligenceBase', value: 3 })
    expect(stats).toContainEqual({ key: 'life', value: 3 })
    expect(stats).toContainEqual({ key: 'energy', value: 2 })
    expect(stats.find(s => s.key === 'sad')).toBeUndefined()
  })
})

describe('getClassBonusStats', () => {
  it('returns empty for missing bonuses', () => {
    expect(getClassBonusStats({})).toEqual([])
    expect(getClassBonusStats(null)).toEqual([])
  })

  it('maps shorthand statistic codes to canonical categories', () => {
    const cls = {
      bonuses: [
        { statistic: 'dex', value: 2 },
        { statistic: 'int', value: 1 },
        { statistic: 'cos', value: 4 },
      ],
    }
    expect(getClassBonusStats(cls)).toEqual([
      { key: 'dexterity', value: 2 },
      { key: 'intelligence', value: 1 },
      { key: 'constitution', value: 4 },
    ])
  })

  it('drops bonuses with unknown statistic or zero value', () => {
    const cls = {
      bonuses: [
        { statistic: 'mystery', value: 5 },
        { statistic: 'life', value: 0 },
        { statistic: 'life', value: 2 },
      ],
    }
    expect(getClassBonusStats(cls)).toEqual([{ key: 'life', value: 2 }])
  })
})

describe('aggregateBonusTotals', () => {
  it('sums base stats and class bonuses into category totals', () => {
    const character = { lifeMax: 12, dexterityStart: 1 }
    const cls = { dexterityBase: 1, bonuses: [{ statistic: 'life', value: 3 }] }
    const totals = aggregateBonusTotals([
      { entity: character, type: 'character' },
      { entity: cls, type: 'class' },
    ])
    const map = Object.fromEntries(totals.map(t => [t.category, t.value]))
    expect(map.life).toBe(12 + 3)
    expect(map.dexterity).toBe(1 + 1)
  })

  it('returns categories in canonical order', () => {
    const cls = {
      bonuses: [
        { statistic: 'exp', value: 1 },
        { statistic: 'life', value: 1 },
      ],
    }
    const totals = aggregateBonusTotals([{ entity: cls, type: 'class' }])
    expect(totals.map(t => t.category)).toEqual(
      STAT_CATEGORY_ORDER.filter(c => c === 'life' || c === 'exp')
    )
  })
})

describe('isClassAllowedByTemplate', () => {
  it('returns true when template has no restrictions', () => {
    expect(isClassAllowedByTemplate({ id: 1 }, { idClassPermitted: null, idClassProhibited: null })).toBe(true)
  })

  it('blocks classes not matching idClassPermitted', () => {
    expect(isClassAllowedByTemplate({ id: 1 }, { idClassPermitted: 2, idClassProhibited: null })).toBe(false)
    expect(isClassAllowedByTemplate({ id: 2 }, { idClassPermitted: 2, idClassProhibited: null })).toBe(true)
  })

  it('blocks classes matching idClassProhibited', () => {
    expect(isClassAllowedByTemplate({ id: 1 }, { idClassPermitted: null, idClassProhibited: 1 })).toBe(false)
    expect(isClassAllowedByTemplate({ id: 2 }, { idClassPermitted: null, idClassProhibited: 1 })).toBe(true)
  })
})

describe('buildClassesById', () => {
  it('indexes class entities by their numeric id', () => {
    const map = buildClassesById([
      { id: 1, name: 'Warrior' },
      { id: 2, name: 'Mage' },
      { name: 'Ghost' }, // no id → skipped
    ])
    expect(map['1'].name).toBe('Warrior')
    expect(map['2'].name).toBe('Mage')
    expect(Object.keys(map)).toHaveLength(2)
  })
})

describe('getOptionLockInfo', () => {
  const story = {
    classes: [
      { id: 1, name: 'Warrior', card: { title: 'Warrior' } },
      { id: 2, name: 'Mage',    card: { title: 'Mage' } },
    ],
  }
  const classesById = buildClassesById(story.classes)

  it('returns null when no relevant selection is set', () => {
    expect(getOptionLockInfo({ type: 'trait', option: { idClassPermitted: 1 }, config: {}, classesById })).toBeNull()
  })

  it('never locks a class during the class selection step', () => {
    expect(getOptionLockInfo({
      type: 'class',
      option: { id: 1, name: 'Warrior' },
      config: { character: { idClassPermitted: 2 } },
      classesById,
    })).toBeNull()
  })

  it('locks character template options prohibited by current class', () => {
    const lock = getOptionLockInfo({
      type: 'character',
      option: { idClassProhibited: 1 },
      config: { class: { id: 1 } },
      classesById,
    })
    expect(lock?.kind).toBe('prohibited')
    expect(lock?.classId).toBe(1)
    expect(lock?.className).toBe('Warrior')
  })

  it('locks trait options that require a class different from the selected one', () => {
    const lock = getOptionLockInfo({
      type: 'trait',
      option: { idClassPermitted: 2 },
      config: { class: { id: 1 } },
      classesById,
    })
    expect(lock?.kind).toBe('requires')
    expect(lock?.classId).toBe(2)
    expect(lock?.className).toBe('Mage')
  })

  it('returns null when restrictions are satisfied', () => {
    const lock = getOptionLockInfo({
      type: 'trait',
      option: { idClassPermitted: 1 },
      config: { class: { id: 1 } },
      classesById,
    })
    expect(lock).toBeNull()
  })
})
