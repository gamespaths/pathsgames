import { describe, it, expect } from 'vitest'
import { STORIES_ENTITIES_FIELDS, STORIES_ENTITIES_COLUMNS } from '../../constants/story/storiesEntities'
import {
  ITEM_EFFECT_CODE_OPTIONS, CHOICE_CONDITION_OPERATOR_OPTIONS, KEY_VISIBILITY_OPTIONS,
} from '../../constants/story/storyFieldOptions'

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

describe('items entity config (Step 35)', () => {
  it('offers flagShowEffects as a checkbox, next to the consumable one', () => {
    const fields = STORIES_ENTITIES_FIELDS.items
    const byKey = Object.fromEntries(fields.map(f => [f.key, f]))
    expect(byKey.flagShowEffects).toMatchObject({ key: 'flagShowEffects', type: 'checkbox' })
    // Right after Consumable: both answer "what can the player do with this item".
    const keys = fields.map(f => f.key)
    expect(keys.indexOf('flagShowEffects')).toBe(keys.indexOf('isConsumabile') + 1)
  })
})

describe('items quantity config (v0.35.1)', () => {
  const byKey = () => Object.fromEntries(STORIES_ENTITIES_FIELDS.items.map(f => [f.key, f]))

  it('offers the cap and the two action amounts as numbers', () => {
    for (const key of ['maxPerCharacter', 'amountDrop', 'amountUse']) {
      expect(byKey()[key]).toMatchObject({ key, type: 'number' })
    }
  })

  it('says in the label what an empty value means, since empty is not zero', () => {
    // 0/empty is "no limit" for the cap and "one unit" for the two amounts: an author
    // reading the form must not have to guess which.
    expect(byKey().maxPerCharacter.label).toMatch(/no limit/i)
    expect(byKey().amountDrop.label).toMatch(/1/)
    expect(byKey().amountUse.label).toMatch(/1/)
  })
})

describe('item-effects entity config (Step 35)', () => {
  const fields = () => STORIES_ENTITIES_FIELDS['item-effects']
  const byKey = () => Object.fromEntries(fields().map(f => [f.key, f]))

  it('offers the narrative card the engine already reads off list_items_effects.id_card', () => {
    // Without it the column could only be authored by importing a JSON story, and using an
    // item narrated nothing.
    expect(byKey().idCard).toMatchObject({ key: 'idCard', type: 'number' })
    expect(fields()[0].key).toBe('idCard')
  })

  it('constrains the effect code to the vocabulary the engine acts on', () => {
    const field = byKey().effectCode
    expect(field.type).toBe('select')
    expect(field.options).toBe(ITEM_EFFECT_CODE_OPTIONS)
    const values = field.options.map(o => o.value)
    // The ten tokens of EffectStatCodec.KNOWN, spelled as the schema documents them.
    expect(values).toEqual(expect.arrayContaining([
      'LIFE', 'ENERGY', 'SAD', 'EXP', 'DEX', 'INT', 'COS', 'FOOD', 'MAGIC', 'COIN',
    ]))
    // Plus the two aliases the codec translates, so a pre-v0.34.0 row still renders.
    expect(values).toEqual(expect.arrayContaining(['SADNESS', 'COINS']))
  })

  it('keeps the trait CSVs in the event-effect format — one format, not a third', () => {
    expect(byKey().traitsToAdd.type).toBe('text')
    expect(byKey().traitsToRemove.type).toBe('text')
  })
})

describe('traits entity config (v0.35.2)', () => {
  it('offers hideOnStartMatch as a checkbox', () => {
    const byKey = Object.fromEntries(STORIES_ENTITIES_FIELDS.traits.map(f => [f.key, f]))
    expect(byKey.hideOnStartMatch).toMatchObject({ key: 'hideOnStartMatch', type: 'checkbox' })
  })

  it('keeps it next to the costs, which are the other rules of picking a trait', () => {
    const keys = STORIES_ENTITIES_FIELDS.traits.map(f => f.key)
    expect(keys.indexOf('hideOnStartMatch')).toBe(keys.indexOf('costNegative') + 1)
  })
})

describe('registry condition operator (Step 36)', () => {
  const OPERATOR_ENTITIES = ['events', 'location-neighbors', 'weather-rules']

  it('is offered on every entity that gates on a registry key', () => {
    for (const entity of OPERATOR_ENTITIES) {
      const field = STORIES_ENTITIES_FIELDS[entity]
        .find(f => f.key === 'registryValueOperatorCondition')
      expect(field, `missing on ${entity}`).toBeTruthy()
      expect(field.type).toBe('select')
    }
  })

  it('reuses the choice-condition vocabulary: one operator list, not four', () => {
    for (const entity of OPERATOR_ENTITIES) {
      const field = STORIES_ENTITIES_FIELDS[entity]
        .find(f => f.key === 'registryValueOperatorCondition')
      expect(field.options).toBe(CHOICE_CONDITION_OPERATOR_OPTIONS)
    }
    expect(CHOICE_CONDITION_OPERATOR_OPTIONS.map(o => o.value)).toEqual(['=', '>', '<', '!='])
  })

  it('sits right after the value it compares, so the pair reads together', () => {
    const after = {
      events: 'registryValueCondition',
      'location-neighbors': 'conditionRegistryValue',
      'weather-rules': 'conditionKeyValue',
    }
    for (const [entity, valueKey] of Object.entries(after)) {
      const keys = STORIES_ENTITIES_FIELDS[entity].map(f => f.key)
      expect(keys[keys.indexOf(valueKey) + 1]).toBe('registryValueOperatorCondition')
    }
  })

  it('stores a string: an operator must not be coerced to a number', () => {
    for (const entity of OPERATOR_ENTITIES) {
      const field = STORIES_ENTITIES_FIELDS[entity]
        .find(f => f.key === 'registryValueOperatorCondition')
      expect(field.valueType).toBeUndefined()
    }
  })
})

describe('registry key visibility (Step 36)', () => {
  it('is a select, so a key cannot be left in an ambiguous state by hand', () => {
    const field = STORIES_ENTITIES_FIELDS.keys.find(f => f.key === 'visibility')
    expect(field).toMatchObject({ key: 'visibility', type: 'select' })
    expect(field.options).toBe(KEY_VISIBILITY_OPTIONS)
  })

  it('offers exactly the two states the engine distinguishes', () => {
    // The backend shows a key only when visibility is exactly PUBLIC; everything else hides
    // it. Offering a third word here would invent a state the engine does not have.
    expect(KEY_VISIBILITY_OPTIONS.map(o => o.value)).toEqual(['PUBLIC', 'HIDDEN'])
  })
})
