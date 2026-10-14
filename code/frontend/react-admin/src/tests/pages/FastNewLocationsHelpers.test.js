import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as storyApi from '../../api/storyApi'
import {
  emptyFastLocationsForm, emptyLocationRow, emptyNeighborRow, newLocationRef, newRefIndex,
  isLocationRowEmpty, buildEndpointOptions, removeLocationRow, validateFastLocations, saveFastLocations,
} from '../../pages/story/FastNewLocationsHelpers'

vi.mock('../../api/storyApi')

const STORY = 'story-1'

// Backend double: every create answers with a uuid; locations get a DB id from 200.
function mockBackend({ texts = [{ idText: 10 }], cards = [{ idCard: 5 }], cardIdOffset = 0 } = {}) {
  let seq = 0
  let dbId = 200
  storyApi.listEntities.mockImplementation((_s, type) =>
    Promise.resolve(type === 'texts' ? texts : type === 'cards' ? cards : []))
  storyApi.createEntity.mockImplementation((_s, type, payload) => {
    seq += 1
    const res = { uuid: `u${seq}` }
    if (type === 'cards') res.idCard = payload.idCard + cardIdOffset
    if (type === 'locations') res.id = dbId++
    return Promise.resolve(res)
  })
  storyApi.deleteEntity.mockResolvedValue(true)
}

const calls = (type) => storyApi.createEntity.mock.calls.filter(c => c[1] === type).map(c => c[2])
const loc = (fields) => ({ ...emptyLocationRow(), ...fields })
const nb = (fields) => ({ ...emptyNeighborRow(), ...fields })

describe('FastNewLocationsHelpers — form model', () => {
  it('starts with one empty location row and no neighbors', () => {
    const form = emptyFastLocationsForm()
    expect(form.locations).toEqual([emptyLocationRow()])
    expect(form.neighbors).toEqual([])
    expect(emptyNeighborRow().flagBack).toBe('0')
  })

  it('encodes and decodes the references to new rows', () => {
    expect(newLocationRef(2)).toBe('new:2')
    expect(newRefIndex('new:2')).toBe(2)
    expect(newRefIndex('7')).toBeNull()
    expect(newRefIndex('')).toBeNull()
    expect(newRefIndex(7)).toBeNull()
    expect(newRefIndex('new:x')).toBeNull()
    expect(newRefIndex('new:-1')).toBeNull()
  })

  it('treats a row as empty only when nothing is typed', () => {
    expect(isLocationRowEmpty(emptyLocationRow())).toBe(true)
    expect(isLocationRowEmpty(undefined)).toBe(true)
    expect(isLocationRowEmpty(loc({ titleEn: '   ' }))).toBe(true)
    expect(isLocationRowEmpty(loc({ energy: '0' }))).toBe(false)
    expect(isLocationRowEmpty(loc({ urlImage: 'x' }))).toBe(false)
  })

  it('lists the new rows first, then existing locations by descending id', () => {
    const options = buildEndpointOptions(
      [loc({ titleEn: ' Hall ' }), loc()],
      [{ value: 1, label: '#1 Forest' }, { value: 12, label: '#12 Lake' }, { value: 3, label: '#3 Cave' }],
    )
    expect(options).toEqual([
      { value: 'new:0', label: 'New 1: Hall' },
      { value: 'new:1', label: 'New 2: (no title)' },
      { value: '12', label: '#12 Lake' },
      { value: '3', label: '#3 Cave' },
      { value: '1', label: '#1 Forest' },
    ])
    expect(buildEndpointOptions(null, null)).toEqual([])
  })

  it('removing a location row clears its references and shifts the later ones', () => {
    const form = {
      locations: [loc({ titleEn: 'A' }), loc({ titleEn: 'B' }), loc({ titleEn: 'C' })],
      neighbors: [nb({ from: 'new:0', to: 'new:1' }), nb({ from: 'new:2', to: '5' })],
    }
    const next = removeLocationRow(form, 1)
    expect(next.locations.map(r => r.titleEn)).toEqual(['A', 'C'])
    expect(next.neighbors.map(n => [n.from, n.to])).toEqual([['new:0', ''], ['new:1', '5']])
    expect(form.locations).toHaveLength(3)
  })
})

describe('validateFastLocations', () => {
  it('asks for something to save', () => {
    expect(validateFastLocations(emptyFastLocationsForm())).toEqual(['Add at least one location or one neighbor'])
    expect(validateFastLocations(undefined)).toEqual(['Add at least one location or one neighbor'])
    expect(validateFastLocations({ locations: [loc({ titleEn: 'A' })], neighbors: [] })).toEqual([])
  })

  it('requires the English title on a non-empty location row', () => {
    const form = { locations: [loc({ descEn: 'no title' }), loc()], neighbors: [] }
    expect(validateFastLocations(form)).toEqual(['Location 1: English title is required'])
  })

  it('requires From, To, Direction and different ends', () => {
    const form = { locations: [], neighbors: [nb({}), nb({ from: '3', to: '3', direction: 'NORTH' })] }
    expect(validateFastLocations(form)).toEqual([
      'Neighbor 1: From, To and Direction are required',
      'Neighbor 2: From and To must be different',
    ])
  })

  it('requires a title on the referenced new rows', () => {
    const form = {
      locations: [loc(), loc({ titleEn: 'B' })],
      neighbors: [nb({ from: 'new:0', to: 'new:1', direction: 'EAST' }), nb({ from: 'new:1', to: 'new:4', direction: 'WEST' })],
    }
    expect(validateFastLocations(form)).toEqual([
      'Neighbor 1: New 1 has no English title',
      'Neighbor 2: New 5 has no English title',
    ])
  })

  it('blocks the same From and Direction twice, in the form and against the story (R2_NEIGHBOR_DUP)', () => {
    const form = {
      locations: [loc({ titleEn: 'A' })],
      neighbors: [
        nb({ from: 'new:0', to: '3', direction: 'NORTH' }),
        nb({ from: 'new:0', to: '4', direction: 'NORTH' }),
        nb({ from: '3', to: 'new:0', direction: 'south' }),
        nb({ from: '3', to: 'new:0', direction: 'EAST' }),
      ],
    }
    const existing = [
      { idLocationFrom: 3, direction: 'SOUTH' },
      { idLocationFrom: null, direction: 'EAST' },
      { idLocationFrom: 3, direction: '' },
      null,
    ]
    expect(validateFastLocations(form, existing)).toEqual([
      'Neighbor 2: the From location already has a neighbor going NORTH',
      'Neighbor 3: the From location already has a neighbor going south',
    ])
    expect(validateFastLocations(form, null)).toHaveLength(1)
  })
})

describe('saveFastLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates every location then the neighbors with the resolved ids', async () => {
    mockBackend()
    const form = {
      locations: [
        loc({ titleEn: 'Hall', titleIt: 'Sala', descEn: 'Big\nhall', copyright: 'CC', link: 'http://l', urlImage: 'http://i', energy: '2' }),
        loc(),
        loc({ titleEn: 'Tower' }),
      ],
      neighbors: [
        nb({
          from: 'new:0', to: 'new:2', direction: 'ABOVE', flagBack: '1', energyCost: '1', costFood: '2',
          costMagic: '3', costCoin: '4', conditionRegistryKey: 'DOOR', conditionRegistryValue: 'OPEN',
          registryValueOperatorCondition: '=',
        }),
        nb({ from: '7', to: 'new:0', direction: 'WEST' }),
      ],
    }
    const res = await saveFastLocations({ storyUuid: STORY, story: { idCreator: 4 }, form })
    expect(res.ok).toBe(true)

    // Hall: title 11 (en+it), desc 12, copyright 13; Tower: title 14
    expect(calls('texts').map(t => [t.idText, t.lang])).toEqual([
      [11, 'en'], [11, 'it'], [12, 'en'], [13, 'en'], [14, 'en'],
    ])
    expect(calls('texts')[2].shortText).toBe('Big<br />\nhall')
    expect(calls('cards')).toEqual([
      { idCard: 6, idTextName: 11, idTextTitle: 11, idTextDescription: 12, idTextCopyright: 13,
        linkCopyright: 'http://l', urlImage: 'http://i', idCreator: 4 },
      { idCard: 7, idTextName: 14, idTextTitle: 14, idCreator: 4 },
    ])
    expect(calls('locations')).toEqual([
      { idCard: 6, idTextName: 11, idTextDescription: 12, idTextNarrative: 12, costEnergyEnter: 2 },
      { idCard: 7, idTextName: 14 },
    ])
    expect(calls('location-neighbors')).toEqual([
      { idLocationFrom: 200, idLocationTo: 201, direction: 'ABOVE', conditionRegistryKey: 'DOOR',
        conditionRegistryValue: 'OPEN', registryValueOperatorCondition: '=', energyCost: 1,
        costFood: 2, costMagic: 3, costCoin: 4, flagBack: 1 },
      { idLocationFrom: 7, idLocationTo: 200, direction: 'WEST', flagBack: 0 },
    ])
    // all locations are written before the first neighbor; never a card or text on a neighbor
    const order = storyApi.createEntity.mock.calls.map(c => c[1])
    expect(order.lastIndexOf('locations')).toBeLessThan(order.indexOf('location-neighbors'))
    for (const n of calls('location-neighbors')) {
      for (const k of ['idCard', 'idTextName', 'idTextGo', 'idTextBack', 'idCardBack']) expect(n).not.toHaveProperty(k)
    }
    expect(res.created.map(c => c.label)).toEqual(expect.arrayContaining([
      'Location 1 #200', 'Location 3 #201', 'Neighbor 1 (ABOVE)', 'Neighbor 2 (WEST)',
    ]))
  })

  it('saves neighbors alone and reads the location id from idLocation', async () => {
    mockBackend({ texts: null, cards: null, cardIdOffset: 30 })
    storyApi.createEntity.mockImplementation((_s, type, payload) => Promise.resolve(
      type === 'locations' ? { uuid: 'l', idLocation: 9 } : { uuid: 'x', idCard: payload.idCard + 30 }))
    const res = await saveFastLocations({
      storyUuid: STORY, story: null,
      form: { locations: [loc({ titleEn: 'A' })], neighbors: [nb({ from: 'new:0', to: '1', direction: 'SKY', flagBack: 'x' })] },
    })
    expect(res.ok).toBe(true)
    expect(calls('texts')[0]).toMatchObject({ idText: 1, shortText: 'A' })
    expect(calls('texts')[0].idCreator).toBeUndefined()
    expect(calls('locations')[0]).toEqual({ idCard: 31, idTextName: 1 })
    expect(calls('location-neighbors')[0]).toEqual({ idLocationFrom: 9, idLocationTo: 1, direction: 'SKY', flagBack: 0 })
  })

  it('aborts and rolls back when the backend returns no location id', async () => {
    // cards listed with `id` only still give the max+1 card id
    mockBackend({ cards: [{ id: 8 }] })
    storyApi.createEntity.mockImplementation((_s, type, payload) =>
      Promise.resolve(type === 'cards' ? { uuid: 'c', idCard: payload.idCard } : { uuid: type }))
    const res = await saveFastLocations({ storyUuid: STORY, story: {}, form: { locations: [loc({ titleEn: 'A' })], neighbors: [] } })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('The backend returned no id for the new location')
    expect(calls('cards')[0].idCard).toBe(9)
    expect(storyApi.deleteEntity.mock.calls.map(c => c[1])).toEqual(['locations', 'cards', 'texts'])
    expect(res.orphans).toEqual([])
  })

  it('fails when a neighbor points at a row that was not saved', async () => {
    mockBackend()
    const res = await saveFastLocations({
      storyUuid: STORY, story: {},
      form: { locations: [loc()], neighbors: [nb({ from: 'new:0', to: '1', direction: 'EAST' })] },
    })
    expect(res).toEqual({ ok: false, error: 'The backend returned no id for the new location 1', created: [], orphans: [] })
  })

  it('rolls back in reverse order when a neighbor fails and reports the orphans', async () => {
    mockBackend()
    const original = storyApi.createEntity.getMockImplementation()
    storyApi.createEntity.mockImplementation((s, type, payload) =>
      type === 'location-neighbors' && payload.direction === 'EAST'
        ? Promise.reject({ response: { data: { message: 'dup' } } })
        : original(s, type, payload))
    storyApi.deleteEntity.mockImplementation((_s, _t, uuid) =>
      uuid === 'u2' ? Promise.reject(new Error('nope')) : Promise.resolve(true))
    const res = await saveFastLocations({
      storyUuid: STORY, story: {},
      form: {
        locations: [loc({ titleEn: 'A' })],
        neighbors: [nb({ from: 'new:0', to: '1', direction: 'NORTH' }), nb({ from: 'new:0', to: '2', direction: 'EAST' })],
      },
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('dup')
    expect(storyApi.deleteEntity.mock.calls.map(c => c[2])).toEqual(['u4', 'u3', 'u2', 'u1'])
    expect(res.orphans).toEqual([{ entityType: 'cards', uuid: 'u2', label: 'Card #6' }])
  })
})
