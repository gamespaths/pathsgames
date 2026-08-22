import { describe, it, expect } from 'vitest'
import {
  effectStatItems, itemCap, itemCarryBadges, itemDescriptionBadges, itemPromiseBadges,
  unitsPerUse,
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

describe('the cap and the cost of a usage (v0.35.1)', () => {
  it('reads 0 and null as no cap, exactly as the engine does', () => {
    expect(itemCap({ maxPerCharacter: 3 })).toBe(3)
    expect(itemCap({ maxPerCharacter: 0 })).toBeNull()
    expect(itemCap({})).toBeNull()
    expect(itemCap(null)).toBeNull()
  })

  it('reads a missing or empty amountUse as one unit', () => {
    // The board must never promise a cheaper action than the server will honour.
    expect(unitsPerUse({ amountUse: 2 })).toBe(2)
    expect(unitsPerUse({ amountUse: 0 })).toBe(1)
    expect(unitsPerUse({ amountUse: -3 })).toBe(1)
    expect(unitsPerUse({})).toBe(1)
  })

  it('writes the amount as carried/cap when there is one', () => {
    const badges = itemCarryBadges({ amount: 2, weight: 1, maxPerCharacter: 3 }, k => k)
    const amount = badges.find(b => b.key === 'amount')
    expect(amount.value).toBe('2/3')
    // The x belongs to the uncapped reading only: "x2/3" reads as nonsense.
    expect(amount.prefix).toBeUndefined()
  })

  it('says 1/1 rather than nothing: one unit IS the news when the cap is one', () => {
    const badges = itemCarryBadges({ amount: 1, weight: 1, maxPerCharacter: 1 }, k => k)
    expect(badges.find(b => b.key === 'amount').value).toBe('1/1')
    // Without a cap a single unit earns no badge at all.
    expect(itemCarryBadges({ amount: 1, weight: 1 }, k => k).map(b => b.key)).toEqual(['weight'])
  })

  it('adds the cost of a usage only when it is more than one unit', () => {
    const badges = itemDescriptionBadges(
      { amount: 4, weight: 1, isConsumabile: true, amountUse: 2 }, k => k)
    expect(badges.find(b => b.key === 'perUse')).toMatchObject({ value: '2' })
    // One unit per usage is what every pre-v0.35.1 item did: saying so would be noise.
    expect(itemDescriptionBadges({ amount: 4, weight: 1, isConsumabile: true }, k => k)
      .find(b => b.key === 'perUse')).toBeUndefined()
  })
})
