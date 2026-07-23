import { describe, it, expect } from 'vitest'
import { STORIES_ENTITIES_FIELDS, STORIES_ENTITIES_COLUMNS } from '../../constants/story/storiesEntities'

describe('event-effects entity config', () => {
  it('opens the form with card, name, description and event, in this order', () => {
    const keys = STORIES_ENTITIES_FIELDS['event-effects'].map(field => field.key)
    expect(keys.slice(0, 4)).toEqual(['idCard', 'idTextName', 'idTextDescription', 'idEvent'])
  })

  it('lists the resolved name right after the card column', () => {
    const [first] = STORIES_ENTITIES_COLUMNS['event-effects']
    expect(first).toMatchObject({ key: 'idTextName', type: 'idTextName' })
  })

  it('offers the v0.29.3 forced-movement location as a number field', () => {
    const field = STORIES_ENTITIES_FIELDS['event-effects'].find(f => f.key === 'idLocation')
    expect(field).toMatchObject({ key: 'idLocation', type: 'number' })
  })
})

describe('choice-effects entity config (Step 32)', () => {
  const fields = () => STORIES_ENTITIES_FIELDS['choice-effects']

  it('exposes every v0.32.0 effect target, so an author can reach them from the form', () => {
    const keys = fields().map(field => field.key)
    expect(keys).toEqual(expect.arrayContaining([
      'idItemTarget', 'itemAction', 'idLocation', 'idWeather', 'idEvent',
    ]))
  })

  it('types the new targets exactly like their event-effect twins', () => {
    const byKey = Object.fromEntries(fields().map(f => [f.key, f]))
    const eventByKey = Object.fromEntries(
      STORIES_ENTITIES_FIELDS['event-effects'].map(f => [f.key, f]),
    )
    for (const key of ['idItemTarget', 'idLocation', 'idWeather']) {
      expect(byKey[key].type).toBe('number')
    }
    // The same option list the event effects use: one vocabulary, not two.
    expect(byKey.itemAction.options).toBe(eventByKey.itemAction.options)
    expect(byKey.statistics.options).toBe(eventByKey.statistics.options)
  })

  it('keeps the registry pair as free text — value_to_remove must match to clear', () => {
    const byKey = Object.fromEntries(fields().map(f => [f.key, f]))
    expect(byKey.key.type).toBe('text')
    expect(byKey.valueToAdd.type).toBe('text')
    expect(byKey.valueToRemove.type).toBe('text')
  })
})

describe('location-neighbors entity config', () => {
  it('hides Card Back ID unless flagBack is YES (1)', () => {
    const field = STORIES_ENTITIES_FIELDS['location-neighbors'].find(f => f.key === 'idCardBack')
    expect(field.showIf({ flagBack: 1 })).toBe(true)
    expect(field.showIf({ flagBack: '1' })).toBe(true)
    expect(field.showIf({ flagBack: 0 })).toBe(false)
    expect(field.showIf({})).toBe(false)
  })
})
