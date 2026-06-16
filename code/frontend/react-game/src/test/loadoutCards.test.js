import { describe, it, expect } from 'vitest'
import {
  buildGameTypeCard,
  buildLoginCard,
  buildTermsCard,
  buildAntibotCard,
  buildFreeToPlay,
  buildStatisticsCard,
} from '../utils/loadoutCards'

// Identity translate fn so we can assert on the i18n keys directly.
const t = (k) => k

describe('utils/loadoutCards', () => {
  it('buildGameTypeCard maps the single game-type labels and a person image', () => {
    const c = buildGameTypeCard(t)
    expect(c.name).toBe('book.single')
    expect(c.description).toBe('book.singleDesc')
    expect(c.card.urlImage).toBeTruthy()
  })

  it('buildLoginCard maps the guest labels', () => {
    const c = buildLoginCard(t)
    expect(c.name).toBe('book.guest')
    expect(c.description).toBe('book.guestDesc')
    expect(c.card).toBeTypeOf('object')
  })

  it('buildTermsCard carries the scroll icon and terms texts', () => {
    const c = buildTermsCard(t)
    expect(c.name).toBe('book.termsTitle')
    expect(c.icon).toBe('fas fa-scroll')
    expect(c.description).toBe('book.termsDesc')
  })

  it('buildAntibotCard carries the shield icon', () => {
    const c = buildAntibotCard(t)
    expect(c.name).toBe('book.antibotOk')
    expect(c.icon).toBe('fas fa-shield-alt')
  })

  it('buildFreeToPlay carries the gift icon', () => {
    const c = buildFreeToPlay(t)
    expect(c.name).toBe('book.freeToPlay')
    expect(c.icon).toBe('fas fa-gift')
  })

  it('buildStatisticsCard projects totals onto statItemsToPageContent and nulls the image', () => {
    const totals = [
      { category: 'dexterity', value: 3 },
      { category: 'intelligence', value: 5 },
    ]
    const c = buildStatisticsCard(t, totals, { card: { urlImage: 'http://x/s.png' } })
    expect(c.name).toBe('book.stats.title')
    expect(c.totals).toBe(totals)
    expect(c.card.urlImage).toBeNull()
    expect(c.card.statItemsToPageContent).toEqual([
      { key: 'dexterity', label: 'book.stats.totals.dexterity', value: 3 },
      { key: 'intelligence', label: 'book.stats.totals.intelligence', value: 5 },
    ])
  })
})
