import { describe, it, expect } from 'vitest'
import { effectStatItems } from '../utils/statBadges'

const t = (k) => k
const ME = 'char-me'

const effect = (over = {}) => ({
  eventUuid: 'evt-a', effectUuid: 'eff-1', statistic: null, value: null,
  target: 'ONLY_ONE', targetClass: null, characterUuids: [ME], card: null, ...over,
})

// statChangeItems keeps its own coverage in GameBook.test.jsx — it moved here unchanged.
describe('effectStatItems (v0.33.1)', () => {
  it('badges the authored statistic/value of each effect row', () => {
    expect(effectStatItems([
      effect({ statistic: 'energy', value: -3 }),
      effect({ statistic: 'exp', value: 11 }),
    ], ME, t)).toEqual([
      { key: 'energy', label: 'game.stats.energy', value: '-3' },
      { key: 'experience', label: 'game.stats.experience', value: '+11' },
    ])
  })

  it('sums the rows that touch the same statistic', () => {
    expect(effectStatItems([
      effect({ statistic: 'life', value: -2 }),
      effect({ statistic: 'life', value: -3 }),
    ], ME, t)).toEqual([{ key: 'life', label: 'game.stats.life', value: '-5' }])
  })

  it('drops rows that landed on somebody else', () => {
    expect(effectStatItems([
      effect({ statistic: 'life', value: -5, characterUuids: ['char-other'] }),
    ], ME, t)).toEqual([])
  })

  it('keeps a row that landed on nobody — an automatic event can run with no actor', () => {
    expect(effectStatItems([
      effect({ statistic: 'sad', value: 4, characterUuids: [] }),
    ], ME, t)).toEqual([{ key: 'sadness', label: 'game.stats.sadness', value: '+4' }])
  })

  it('ignores rows with no statistic, an unknown one, or a net zero', () => {
    expect(effectStatItems([
      effect({ statistic: null, value: 5 }),
      effect({ statistic: 'nonsense', value: 5 }),
      effect({ statistic: 'energy', value: 2 }),
      effect({ statistic: 'energy', value: -2 }),
    ], ME, t)).toEqual([])
  })

  it('survives a missing or empty list', () => {
    expect(effectStatItems(undefined, ME, t)).toEqual([])
    expect(effectStatItems([], ME, t)).toEqual([])
  })

  it('keeps every row when no player is given', () => {
    expect(effectStatItems([
      effect({ statistic: 'coin', value: 7, characterUuids: ['char-other'] }),
    ], null, t)).toEqual([{ key: 'coins', label: 'game.stats.coins', value: '+7' }])
  })
})
