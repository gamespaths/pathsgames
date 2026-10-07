import { describe, it, expect } from 'vitest'
import {
  buildStatBadges, isItemUsable, itemCarryBadges, itemDescriptionBadges,
  itemPromiseBadges, registryChangeItems,
} from '../utils/statBadges'

/**
 * The item badge builders each take a translator, but default to echoing the key so a
 * caller with nothing to translate (a test, a card built off a raw payload) still works.
 */
describe('statBadges — the default translator and the label switches', () => {
  it('buildStatBadges drops the labels when the caller asks for none', () => {
    const badges = buildStatBadges({ life: 3, lifeMax: 10 }, k => k, { showLabel: false })
    expect(badges.every(b => b.label === null)).toBe(true)
    expect(badges.find(b => b.key === 'life').value).toBe('3/10')
  })

  it('buildStatBadges closes the plain list with the clock and its authored label', () => {
    const badges = buildStatBadges({ clock: 4, clockLabelSingular: 'Turn' }, k => k, { plainFlag: true })
    expect(badges.at(-1)).toEqual({ key: 'clock', label: 'Turn', value: 4 })
  })

  it('buildStatBadges falls back to "Time" when the story names no clock label', () => {
    const badges = buildStatBadges({ clock: 4 }, k => k, { plainFlag: true })
    expect(badges.at(-1).label).toBe('Time')
  })

  it('itemCarryBadges echoes the key with no translator given', () => {
    expect(itemCarryBadges({ weight: 2, amount: 3, isConsumabile: true }))
      .toEqual([
        { key: 'amount', value: '3', prefix: 'x', label: 'game.item.amount' },
        { key: 'weight', value: '6', label: 'game.item.weight' },
      ])
  })

  it('itemDescriptionBadges echoes the key with no translator given', () => {
    const badges = itemDescriptionBadges({ weight: 1, amount: 2, isConsumabile: true, amountUse: 2 })
    expect(badges.find(b => b.key === 'perUse')).toEqual({
      key: 'perUse', value: '2', label: 'game.item.perUse',
    })
    // The carry badges lose their prefix here: the bag row spells the count out instead.
    expect(badges.every(b => b.prefix === undefined)).toBe(true)
  })

  it('itemPromiseBadges weighs one unit, not the stack, with no translator given', () => {
    expect(itemPromiseBadges({ weight: 3, amount: 9 }))
      .toEqual([{ key: 'weight', value: '3', label: 'game.item.weight' }])
  })

  it('an item is usable only when it is a consumable that carries a whole usage', () => {
    expect(isItemUsable({ isConsumabile: true })).toBe(true)
    expect(isItemUsable({ isConsumabile: true, amount: 1, amountUse: 2 })).toBe(false)
    expect(isItemUsable({ isConsumabile: true, amount: 2, amountUse: 2 })).toBe(true)
    expect(isItemUsable({ isConsumabile: false, amount: 9 })).toBe(false)
    expect(isItemUsable(null)).toBe(false)
  })

  it('registryChangeItems skips a definition row with no key', () => {
    const items = registryChangeItems(
      { registryChanges: [{ key: 'WINTER', newValue: 'YES' }] },
      [{ label: 'no key here' }, { key: 'WINTER', category: 'weather' }])
    expect(Array.isArray(items)).toBe(true)
  })
})
