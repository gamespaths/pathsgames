import { describe, it, expect } from 'vitest'
import {
  buildGameTypeCard,
  buildLoginCard,
  buildTermsCard,
  buildAntibotCard,
  buildFreeToPlay,
  buildStatisticsCard,
  buildCardToSleep,
  buildEndGameCard,
  buildWeatherCard,
} from '../utils/loadoutCards'

// Identity translate fn so we can assert on the i18n keys directly.
const t = (k) => k

describe('utils/loadoutCards weather (Step 27)', () => {
  it('buildWeatherCard appends a negative energy delta', () => {
    const c = buildWeatherCard({ deltaEnergy: -3 }, t)
    expect(c.title).toBe('game.weather.title')
    expect(c.description).toContain('-3')
  })

  it('buildWeatherCard appends a positive energy delta with a + sign', () => {
    const c = buildWeatherCard({ deltaEnergy: 2 }, t)
    expect(c.description).toContain('+2')
  })

  it('buildWeatherCard leaves the description unchanged for a zero delta', () => {
    const c = buildWeatherCard({ deltaEnergy: 0 }, t)
    expect(c.description).not.toContain('(')
  })

  it('buildWeatherCard tolerates a null weather payload', () => {
    const c = buildWeatherCard(null, t)
    expect(c.title).toBe('game.weather.title')
  })
})

describe('utils/loadoutCards', () => {
  it('buildGameTypeCard maps the single game-type labels and a person image', () => {
    const c = buildGameTypeCard(t)
    expect(c.title).toBe('book.single')
    expect(c.description).toBe('book.singleDesc')
    expect(c.urlImage).toBeTruthy()
  })

  it('buildLoginCard maps the guest labels', () => {
    const c = buildLoginCard(t)
    expect(c.title).toBe('book.guest')
    expect(c.description).toBe('book.guestDesc')
    expect(c.urlImage).toBeTruthy()
  })

  it('buildTermsCard carries the terms texts', () => {
    const c = buildTermsCard(t)
    expect(c.title).toBe('book.termsTitle')
    expect(c.description).toBe('book.termsDesc')
  })

  it('buildAntibotCard maps the antibot-ok labels', () => {
    const c = buildAntibotCard(t)
    expect(c.title).toBe('book.antibotOk')
    expect(c.description).toBe('book.antibotDesc')
  })

  it('buildFreeToPlay maps the free-to-play labels', () => {
    const c = buildFreeToPlay(t)
    expect(c.title).toBe('book.freeToPlay')
    expect(c.description).toBe('book.freeToPlayDesc')
  })

  it('buildCardToSleep maps the sleep confirm i18n keys', () => {
    const c = buildCardToSleep({ card: {} }, { energy: 5, energyMax: 10 }, t)
    expect(c.title).toBe('game.sleep.confirmTitle')
    expect(c.description).toContain('game.sleep.confirmBody')
  })

  it('buildEndGameCard maps the end-game card i18n keys', () => {
    const c = buildEndGameCard(t)
    expect(c.title).toBe('game.endGameCard.title')
    expect(c.description).toBe('game.endGameCard.description')
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
