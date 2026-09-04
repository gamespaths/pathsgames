import { describe, it, expect } from 'vitest'
import {
  effectStatItems, itemCap, itemCarryBadges, itemDescriptionBadges, itemPromiseBadges,
  registryChangeItems, unitsPerUse, unitsPerDrop,
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

  it('reads a missing or empty amountDrop as one unit, exactly as the engine does', () => {
    expect(unitsPerDrop({ amount: 9, amountDrop: 3 })).toBe(3)
    expect(unitsPerDrop({ amount: 9, amountDrop: 0 })).toBe(1)
    expect(unitsPerDrop({ amount: 9, amountDrop: -3 })).toBe(1)
    expect(unitsPerDrop({ amount: 9 })).toBe(1)
    expect(unitsPerDrop({})).toBe(1)
  })

  it('caps the drop at what is held: putting down what you have is never a refusal', () => {
    expect(unitsPerDrop({ amount: 2, amountDrop: 10 })).toBe(2)
    expect(unitsPerDrop({ amountDrop: 10 })).toBe(1)   // a null amount is one unit held
  })

  it('drops the count of a weightless carried-only token: a key is a key', () => {
    const token = { amount: 3, weight: 0, isConsumabile: false, maxPerCharacter: 5 }
    expect(itemCarryBadges(token, t).find(b => b.key === 'amount')).toBeUndefined()
    // The page reading loses it too, not only the row.
    expect(itemDescriptionBadges(token, t).find(b => b.key === 'amount')).toBeUndefined()
  })

  it('keeps the count when the thing weighs something, or can be used', () => {
    const heavy = { amount: 3, weight: 1, isConsumabile: false }
    const usable = { amount: 3, weight: 0, isConsumabile: true }
    expect(itemCarryBadges(heavy, t).find(b => b.key === 'amount')?.value).toBe('3')
    expect(itemCarryBadges(usable, t).find(b => b.key === 'amount')?.value).toBe('3')
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

describe('registryChangeItems (Step 36.1)', () => {
  const registry = [
    { key: 'evidence_found', multiValue: true, card: { title: 'Evidence found' } },
    { key: 'door', multiValue: false, card: { title: 'The door' } },
    { key: 'no_card', multiValue: false, card: null },
  ]
  const result = changes => ({ registryChanges: changes })

  it('names the badge with the key card title, never with the key itself', () => {
    const badges = registryChangeItems(
      result([{ key: 'evidence_found', oldValue: null, newValue: 'ledger' }]), registry)

    expect(badges).toEqual([{ key: 'registry:evidence_found', label: 'Evidence found',
      value: '+ledger', icon: 'fas fa-scroll', color: null }])
  })

  it('falls back to the key name when the author wrote no card for it', () => {
    const badges = registryChangeItems(result([{ key: 'no_card', newValue: 'x' }]), registry)
    expect(badges[0].label).toBe('no_card')
  })

  it('says nothing about a key the story hid', () => {
    // /info never carries a hidden key, so it is not in the registry the board holds — and a
    // badge would announce on the outcome card the very secret the story is keeping.
    expect(registryChangeItems(result([{ key: 'secret_door', newValue: 'OPEN' }]), registry))
      .toEqual([])
  })

  it('says nothing when there is no key, and nothing when nothing moved', () => {
    expect(registryChangeItems(result([
      { key: null, newValue: 'orphan' },
      { key: 'evidence_found', oldValue: 'ledger', newValue: 'ledger' },
      { key: 'evidence_found', oldValue: null, newValue: '' },
    ]), registry)).toEqual([])
  })

  it('survives a payload with no changes and a board with no registry', () => {
    expect(registryChangeItems({}, registry)).toEqual([])
    expect(registryChangeItems(result([{ key: 'evidence_found', newValue: 'ledger' }]), null))
      .toEqual([])
  })

  it('shows only what JOINED a multi key, not the set it joined', () => {
    // The whole point: on a key already holding three clues, the fourth is the news.
    const badges = registryChangeItems(
      result([{ key: 'evidence_found', oldValue: 'ledger,seal', newValue: 'ledger,letter,seal' }]),
      registry)
    expect(badges[0].value).toBe('+letter')
  })

  it('shows what LEFT a multi key, emptying it included', () => {
    expect(registryChangeItems(
      result([{ key: 'evidence_found', oldValue: 'ledger,letter', newValue: 'letter' }]),
      registry)[0].value).toBe('-ledger')

    // The last member going is news too — the old "no value, no badge" reading lost it.
    expect(registryChangeItems(
      result([{ key: 'evidence_found', oldValue: 'ledger', newValue: null }]),
      registry)[0].value).toBe('-ledger')
  })

  it('reads a replacement on a single key as both halves of the move', () => {
    expect(registryChangeItems(
      result([{ key: 'door', oldValue: 'SHUT', newValue: 'OPEN' }]), registry)[0].value)
      .toBe('+OPEN -SHUT')
    // Nothing there before: only the arrival is the delta.
    expect(registryChangeItems(
      result([{ key: 'door', oldValue: null, newValue: 'OPEN' }]), registry)[0].value)
      .toBe('+OPEN')
  })

  it('never splits a SINGLE key value on its commas', () => {
    // A multi key's members are comma-joined by the backend; a single key's value is opaque
    // and may hold one. Splitting blindly would invent members that never existed.
    expect(registryChangeItems(
      result([{ key: 'door', oldValue: null, newValue: 'Rome, Italy' }]), registry)[0].value)
      .toBe('+Rome, Italy')
  })

  it('namespaces the key so a story key cannot steal a statistic glyph', () => {
    const badges = registryChangeItems(result([{ key: 'life', newValue: 'cursed' }]),
      [{ key: 'life', card: { title: 'The Curse' } }])
    // Left bare, STAT_VISUAL['life'] would hand this badge the red heart of the life stat.
    expect(badges[0].key).toBe('registry:life')
    expect(badges[0].icon).toBe('fas fa-scroll')
  })
})
