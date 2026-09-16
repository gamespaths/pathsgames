import { describe, it, expect } from 'vitest'
import { getOptionsForType, hasChoiceForType, selectedEntityForType } from '../features/start-book/startBookOptions'

const STORY = {
  classes: [{ uuid: 'c1' }, { uuid: 'c2' }],
  characterTemplates: [{ uuid: 'ch1' }],
  traits: [{ uuid: 't1' }, { uuid: 't2', hideOnStartMatch: true }],
  difficulties: [{ uuid: 'd1' }],
}

describe('startBookOptions', () => {
  it('getOptionsForType returns each list, traits without the hidden ones, [] otherwise', () => {
    expect(getOptionsForType('class', STORY)).toHaveLength(2)
    expect(getOptionsForType('character', STORY)).toHaveLength(1)
    expect(getOptionsForType('difficulty', STORY)).toHaveLength(1)
    expect(getOptionsForType('trait', STORY).map(t => t.uuid)).toEqual(['t1'])
    expect(getOptionsForType('nonsense', STORY)).toEqual([])
    expect(getOptionsForType('class', null)).toEqual([])
  })

  it('hasChoiceForType is true only past one option', () => {
    expect(hasChoiceForType('class', STORY)).toBe(true)
    expect(hasChoiceForType('character', STORY)).toBe(false)
    expect(hasChoiceForType('trait', STORY)).toBe(false)
    expect(hasChoiceForType('class', {})).toBe(false)
  })

  it('selectedEntityForType reads the loadout, traits by their first entry', () => {
    const config = { class: { uuid: 'c1' }, character: null, traits: [{ uuid: 't1' }], difficulty: { uuid: 'd1' } }
    expect(selectedEntityForType('class', config)).toEqual({ uuid: 'c1' })
    expect(selectedEntityForType('character', config)).toBeNull()
    expect(selectedEntityForType('trait', config)).toEqual({ uuid: 't1' })
    expect(selectedEntityForType('trait', { traits: [] })).toBeNull()
    expect(selectedEntityForType('trait', { traits: undefined })).toBeNull()
    expect(selectedEntityForType('difficulty', null)).toBeNull()
  })
})
