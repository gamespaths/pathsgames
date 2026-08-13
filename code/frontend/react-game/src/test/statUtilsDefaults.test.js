import { describe, it, expect } from 'vitest'
import { statChangeItems, effectStatItems } from '../utils/statBadges'
import { getNonZeroStats, getClassBonusStats, aggregateBonusTotals, getOptionLockInfo } from '../utils/bonusStats'

/**
 * The stat helpers are called from two places: the book, which passes the i18n
 * translator, and the log/preview cards, which do not. Without one they must fall
 * back to the raw keys rather than throwing.
 */

describe('statBadges without a translator', () => {
  it('labels the badges by their raw key', () => {
    const items = statChangeItems(
      { statChanges: [{ characterUuid: 'me', statistic: 'LIFE', delta: -3 }] }, 'me')

    expect(items).toHaveLength(1)
    expect(Number(items[0].value)).toBe(-3)
  })

  it('drops a change whose statistic is unknown or whose delta is not a number', () => {
    expect(statChangeItems({ statChanges: [
      { statistic: 'KARMA', delta: 2 },
      { statistic: 'LIFE', delta: 'lots' },
      { statistic: null, delta: 1 },
    ] }, null)).toEqual([])
  })

  it('reads the authored effect rows the same way, without a translator', () => {
    const items = effectStatItems([
      { statistic: 'ENERGY', value: -10, characterUuids: [] },       // nobody in particular
      { statistic: 'ENERGY', value: -5, characterUuids: ['me'] },
      { statistic: 'ENERGY', value: -1, characterUuids: ['other'] }, // another character
      { statistic: 'MANA', value: 3 },                               // unknown statistic
    ], 'me')

    expect(items).toHaveLength(1)
    expect(Number(items[0].value)).toBe(-15)
  })

  it('is empty for payloads that carry nothing', () => {
    expect(statChangeItems(null, 'me')).toEqual([])
    expect(effectStatItems(null, 'me')).toEqual([])
  })
})

describe('bonusStats edges', () => {
  const t = (k) => k

  it('has no stats for an unknown entity type', () => {
    expect(getNonZeroStats({ life: 3 }, 'unknown-type', t)).toEqual([])
    expect(getNonZeroStats(null, 'class', t)).toEqual([])
  })

  it('drops class bonuses that name no known statistic or no value', () => {
    expect(getClassBonusStats({ bonuses: [
      { statistic: 'KARMA', value: 2 },
      { statistic: 'LIFE', value: 0 },
      { statistic: null, value: 1 },
      { statistic: 'LIFE', value: 'x' },
    ] })).toEqual([])
    expect(getClassBonusStats({})).toEqual([])
  })

  it('skips a stat that belongs to no category when totalling', () => {
    // `exp` is a stat of the difficulty entity that maps to no bonus category
    const totals = aggregateBonusTotals([{ entity: { life: 2, expCost: 5 }, type: 'difficulty' }], t)
    expect(totals.every(item => item.value !== 0)).toBe(true)
  })

  it('leaves an option unlocked while no class is chosen', () => {
    expect(getOptionLockInfo({ type: 'character', option: { uuid: 'ct-1' }, config: {}, classesById: {} })).toBeNull()
    expect(getOptionLockInfo({ type: 'trait', option: { uuid: 'tr-1' }, config: {}, classesById: {} })).toBeNull()
    expect(getOptionLockInfo({ type: 'difficulty', option: { uuid: 'x' }, config: {}, classesById: {} })).toBeNull()
    expect(getOptionLockInfo({ type: 'trait', option: null, config: {}, classesById: {} })).toBeNull()
  })

  it('names the class a restriction points at, and tolerates an unknown one', () => {
    const config = { class: { id: 2, uuid: 'cls-2' } }
    const option = { idClassPermitted: 1 }

    const named = getOptionLockInfo({
      type: 'trait', option, config, classesById: { 1: { card: { title: 'Wizard' } } },
    })
    expect(named.className).toBe('Wizard')

    const unnamed = getOptionLockInfo({ type: 'character', option, config, classesById: {} })
    expect(unnamed.className).toBeNull()
  })
})
