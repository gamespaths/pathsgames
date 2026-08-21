import { describe, it, expect } from 'vitest'
import {
  effectStatItems, itemCarryBadges, itemDescriptionBadges, itemPromiseBadges,
} from '../utils/statBadges'

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

describe('item badges (Step 35)', () => {
  const ROW = { weight: 2, amount: 3, isConsumabile: true,
                effects: [{ statistic: 'life', value: 3 }] }

  it('weighs the whole stack, and carries the x only on the card face', () => {
    const face = itemCarryBadges(ROW, k => k)
    expect(face.map(b => [b.key, b.value, b.prefix]))
      .toEqual([['amount', '3', 'x'], ['weight', '6', undefined]])
    // In the description the label spells the amount out, so the x would only repeat it.
    expect(itemDescriptionBadges(ROW, k => k).find(b => b.key === 'amount').prefix)
      .toBeUndefined()
  })

  it('drops the amount badge for a single unit', () => {
    expect(itemCarryBadges({ weight: 5 }, k => k).map(b => b.key)).toEqual(['weight'])
    expect(itemCarryBadges(null, k => k)).toEqual([{ key: 'weight', value: '0',
                                                    label: 'game.item.weight' }])
  })

  it('appends the promise after the figures, for a usable item only', () => {
    expect(itemDescriptionBadges(ROW, k => k).map(b => b.key))
      .toEqual(['amount', 'weight', 'life'])
    // A carried-only item never fires its rows, so it promises nothing — but it still
    // weighs what it weighs.
    expect(itemDescriptionBadges({ ...ROW, isConsumabile: false }, k => k).map(b => b.key))
      .toEqual(['amount', 'weight'])
    // flagShowEffects = 0 empties effects[] server-side: same outcome, other reason.
    expect(itemDescriptionBadges({ ...ROW, effects: [] }, k => k).map(b => b.key))
      .toEqual(['amount', 'weight'])
  })
})

describe('the badges of an item just received (Step 35)', () => {
  const ROW = { weight: 2, amount: 3, isConsumabile: true,
                effects: [{ statistic: 'life', value: 3 }] }

  it('carries the unit weight and the promise, and never a count', () => {
    expect(itemPromiseBadges(ROW, k => k).map(b => [b.key, b.value]))
      .toEqual([['weight', '2'], ['life', '+3']])
  })

  it('leaves a secret item with its weight alone', () => {
    // flagShowEffects = 0 empties effects[] server-side. What it weighs is not a secret.
    expect(itemPromiseBadges({ ...ROW, effects: [] }, k => k).map(b => b.key))
      .toEqual(['weight'])
    expect(itemPromiseBadges(null, k => k)).toEqual([{ key: 'weight', value: '0',
                                                      label: 'game.item.weight' }])
  })

  it('the bag still counts and weighs the whole stack', () => {
    // The two readings are deliberately different, and each is right where it is shown.
    expect(itemDescriptionBadges(ROW, k => k).map(b => [b.key, b.value]))
      .toEqual([['amount', '3'], ['weight', '6'], ['life', '+3']])
  })
})
