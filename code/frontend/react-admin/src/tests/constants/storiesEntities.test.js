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

describe('location-neighbors entity config', () => {
  it('hides Card Back ID unless flagBack is YES (1)', () => {
    const field = STORIES_ENTITIES_FIELDS['location-neighbors'].find(f => f.key === 'idCardBack')
    expect(field.showIf({ flagBack: 1 })).toBe(true)
    expect(field.showIf({ flagBack: '1' })).toBe(true)
    expect(field.showIf({ flagBack: 0 })).toBe(false)
    expect(field.showIf({})).toBe(false)
  })
})
