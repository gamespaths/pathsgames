import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as storyApi from '../../api/storyApi'
import {
  emptyFastEventForm, emptyChoice, setIn, toNumber, compact, validateFastEvent,
  saveFastEvent, rollback, isConditionFilled, MODE_CHOICE, MODE_EFFECT, FAST_EVENT_CHOICES,
} from '../../pages/story/FastNewEventHelpers'

vi.mock('../../api/storyApi')

const STORY = 'story-1'

// Backend double: every create answers with a uuid; events/choices get a DB id.
function mockBackend({ texts = [{ idText: 10 }, { idText: 11 }], cards = [{ idCard: 5 }], cardIdOffset = 0 } = {}) {
  let seq = 0
  let dbId = 100
  storyApi.listEntities.mockImplementation((_s, type) =>
    Promise.resolve(type === 'texts' ? texts : type === 'cards' ? cards : []))
  storyApi.createEntity.mockImplementation((_s, type, payload) => {
    seq += 1
    const res = { uuid: `u${seq}` }
    if (type === 'cards') res.idCard = payload.idCard + cardIdOffset
    if (type === 'events' || type === 'choices') res.id = dbId++
    return Promise.resolve(res)
  })
  storyApi.deleteEntity.mockResolvedValue(true)
}

const calls = (type) => storyApi.createEntity.mock.calls.filter(c => c[1] === type).map(c => c[2])

function effectForm() {
  const form = emptyFastEventForm()
  Object.assign(form, {
    titleEn: 'Storm', titleIt: 'Tempesta', descEn: 'A storm', copyright: 'CC-BY',
    link: 'http://l', urlImage: 'http://img', idSpecificLocation: '3', costEnery: '2',
    registryKeyCondition: 'DOOR', registryValueCondition: 'OPEN', registryValueOperatorCondition: '=',
  })
  Object.assign(form.effect, {
    titleEn: 'Wet', statistics: 'LIFE', value: '-1', target: 'ALL',
    keyToAdd: 'WET', keyValueToAdd: 'YES', idLocation: '7',
  })
  return form
}

describe('FastNewEventHelpers — pure helpers', () => {
  it('builds an empty form with five choices', () => {
    const form = emptyFastEventForm()
    expect(form.mode).toBe(MODE_EFFECT)
    expect(form.type).toBe('NORMAL')
    expect(form.choices).toHaveLength(FAST_EVENT_CHOICES)
    expect(form.choices[0]).toEqual(emptyChoice())
  })

  it('setIn replaces nested values without mutating the source', () => {
    const src = { a: [{ b: 1 }, { b: 2 }] }
    const next = setIn(src, ['a', 1, 'b'], 9)
    expect(next.a[1].b).toBe(9)
    expect(src.a[1].b).toBe(2)
    expect(next.a[0]).toBe(src.a[0])
    expect(setIn({}, [], 'x')).toBe('x')
    expect(setIn(undefined, ['k'], 1)).toEqual({ k: 1 })
  })

  it('toNumber parses numbers and nulls blanks or garbage', () => {
    expect(toNumber('4')).toBe(4)
    expect(toNumber(0)).toBe(0)
    expect(toNumber('')).toBeNull()
    expect(toNumber('  ')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })

  it('compact drops empty values but keeps zero', () => {
    expect(compact({ a: 0, b: '', c: null, d: undefined, e: 'x' })).toEqual({ a: 0, e: 'x' })
  })

  it('isConditionFilled needs both type and key', () => {
    expect(isConditionFilled({ type: 'KEYS', key: 'K' })).toBe(true)
    expect(isConditionFilled({ type: 'KEYS', key: '' })).toBe(false)
    expect(isConditionFilled(undefined)).toBe(false)
  })

  it('validateFastEvent reports the missing titles', () => {
    const form = emptyFastEventForm()
    expect(validateFastEvent(form)).toEqual([
      'Event: English title is required', 'Effect: English title is required',
    ])
    form.mode = MODE_CHOICE
    form.titleEn = 'T'
    expect(validateFastEvent(form)).toEqual(['Choices: at least one choice with an English title is required'])
    form.choices[2].titleEn = 'C'
    expect(validateFastEvent(form)).toEqual([])
    expect(validateFastEvent(undefined)).toEqual(['Event: English title is required'])
    expect(validateFastEvent({ titleEn: 'x', mode: MODE_CHOICE })).toHaveLength(1)
  })
})

describe('saveFastEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates texts, cards, event and effect linked together (effect mode)', async () => {
    mockBackend()
    const res = await saveFastEvent({ storyUuid: STORY, story: { idCreator: 4 }, form: effectForm() })
    expect(res.ok).toBe(true)

    const texts = calls('texts')
    // event: title 12 (en+it), desc 13 (en only), copyright 14 (en); effect title 15 (en)
    expect(texts.map(t => [t.idText, t.lang])).toEqual([
      [12, 'en'], [12, 'it'], [13, 'en'], [14, 'en'], [15, 'en'],
    ])
    expect(texts[0]).toEqual({ id: 12, idText: 12, lang: 'en', shortText: 'Storm', idCreator: 4 })
    expect(texts[1].shortText).toBe('Tempesta')

    const [eventCard, effectCard] = calls('cards')
    expect(eventCard).toEqual({
      idCard: 6, idTextName: 12, idTextTitle: 12, idTextDescription: 13, idTextCopyright: 14,
      linkCopyright: 'http://l', urlImage: 'http://img', idCreator: 4,
    })
    expect(effectCard).toEqual({ idCard: 7, idTextName: 15, idTextTitle: 15, idCreator: 4 })

    expect(calls('events')[0]).toEqual({
      idCard: 6, idTextName: 12, idTextDescription: 13, idSpecificLocation: 3, type: 'NORMAL',
      costEnery: 2, registryKeyCondition: 'DOOR', registryValueCondition: 'OPEN',
      registryValueOperatorCondition: '=',
    })
    expect(calls('event-effects')[0]).toEqual({
      idCard: 7, idTextName: 15, idEvent: 100, statistics: 'LIFE', value: -1, target: 'ALL',
      keyToAdd: 'WET', keyValueToAdd: 'YES', idLocation: 7,
    })
    expect(calls('choices')).toHaveLength(0)
    expect(res.created.map(c => c.label)).toContain('Event #100')
    expect(res.created).toHaveLength(9)
  })

  it('turns newlines into <br /> in the descriptions only', async () => {
    mockBackend()
    const form = effectForm()
    Object.assign(form, { titleEn: 'Two\nlines', descEn: 'Line 1\nLine 2', descIt: 'Riga 1\r\nRiga 2' })
    Object.assign(form.effect, { descEn: '\n\n', copyright: 'a\nb' })
    await saveFastEvent({ storyUuid: STORY, story: {}, form })
    const texts = calls('texts')
    expect(texts.find(t => t.idText === 12 && t.lang === 'en').shortText).toBe('Two\nlines')
    expect(texts.find(t => t.idText === 13 && t.lang === 'en').shortText).toBe('Line 1<br />\nLine 2')
    expect(texts.find(t => t.idText === 13 && t.lang === 'it').shortText).toBe('Riga 1<br />\r\nRiga 2')
    // a description of blank lines only is empty: no text, no desc on the effect card
    expect(calls('cards')[1].idTextDescription).toBeUndefined()
    expect(texts.find(t => t.shortText === 'a\nb')).toBeDefined()
  })

  it('uses the idCard returned by the backend (AWS rewrites it)', async () => {
    mockBackend({ cardIdOffset: 40 })
    await saveFastEvent({ storyUuid: STORY, story: {}, form: effectForm() })
    const [eventCard, effectCard] = calls('cards')
    expect(eventCard.idCard).toBe(6)
    expect(calls('events')[0].idCard).toBe(46)
    // next card id moves past the one the backend returned
    expect(effectCard.idCard).toBe(47)
    expect(calls('event-effects')[0].idCard).toBe(87)
    // no creator on the story → no idCreator sent
    expect(calls('texts')[0].idCreator).toBeUndefined()
  })

  it('starts ids from 1 on an empty story and falls back to the sent idCard', async () => {
    mockBackend({ texts: null, cards: null })
    storyApi.createEntity.mockImplementation((_s, type) =>
      Promise.resolve(type === 'events' ? { uuid: 'e', idEvent: 9 } : { uuid: 'x' }))
    const res = await saveFastEvent({ storyUuid: STORY, story: null, form: effectForm() })
    expect(res.ok).toBe(true)
    expect(calls('texts')[0].idText).toBe(1)
    expect(calls('events')[0].idCard).toBe(1)
    expect(calls('event-effects')[0]).toMatchObject({ idEvent: 9, idCard: 2 })
  })

  it('creates only the filled choices, with their condition and effect', async () => {
    mockBackend()
    const form = emptyFastEventForm()
    form.mode = MODE_CHOICE
    form.titleEn = 'Crossroad'
    Object.assign(form.choices[0], { titleEn: 'Left', descEn: 'Go left', priority: '2' })
    Object.assign(form.choices[0].condition, { type: 'KEYS', key: 'MAP', value: '1', operator: '>' })
    Object.assign(form.choices[0].effect, {
      titleEn: 'Lost', descEn: 'You are lost', statistics: 'SAD', value: '1',
      key: 'LOST', valueToAdd: 'Y', valueToRemove: 'N', idLocation: '8',
    })
    Object.assign(form.choices[2], { titleEn: 'Right' })
    // condition without key and effect without title are ignored
    Object.assign(form.choices[2].condition, { type: 'KEYS' })
    Object.assign(form.choices[2].effect, { descEn: 'no title' })
    // no title → whole choice ignored
    Object.assign(form.choices[4], { descEn: 'ignored', priority: '9' })

    const res = await saveFastEvent({ storyUuid: STORY, story: { idCreator: 1 }, form })
    expect(res.ok).toBe(true)
    expect(calls('event-effects')).toHaveLength(0)

    const choices = calls('choices')
    expect(choices).toHaveLength(2)
    // event texts: 12 title; choice 1: 13 title, 14 desc; its effect: 15 title, 16 desc
    expect(choices[0]).toEqual({ idCard: 7, idTextName: 13, idTextNarrative: 13, idEvent: 100, priority: 2 })
    expect(choices[1]).toEqual({ idCard: 9, idTextName: 17, idTextNarrative: 17, idEvent: 100 })

    expect(calls('choice-conditions')).toEqual([
      { idChoices: 101, type: 'KEYS', key: 'MAP', value: '1', operator: '>' },
    ])
    expect(calls('choice-effects')).toEqual([{
      idCard: 8, idTextName: 15, idText: 16, idChoices: 101, idScelta: 101,
      statistics: 'SAD', value: 1, key: 'LOST', valueToAdd: 'Y', valueToRemove: 'N', idLocation: 8,
    }])
    expect(res.created.map(c => c.label)).toEqual(expect.arrayContaining([
      'Choice 1 #101', 'Choice 3 #102', 'Choice 1 condition', 'Choice 1 effect',
    ]))
  })

  it('rolls back in reverse order and reports what could not be deleted', async () => {
    mockBackend()
    const original = storyApi.createEntity.getMockImplementation()
    storyApi.createEntity.mockImplementation((s, type, payload) =>
      type === 'event-effects'
        ? Promise.reject({ response: { data: { message: 'boom' } } })
        : original(s, type, payload))
    storyApi.deleteEntity.mockImplementation((_s, _t, uuid) =>
      uuid === 'u3' ? Promise.reject(new Error('nope')) : Promise.resolve(true))

    const res = await saveFastEvent({ storyUuid: STORY, story: {}, form: effectForm() })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('boom')
    expect(res.created).toHaveLength(8)
    const deletedUuids = storyApi.deleteEntity.mock.calls.map(c => c[2])
    expect(deletedUuids).toEqual(['u8', 'u7', 'u6', 'u5', 'u4', 'u3', 'u2', 'u1'])
    expect(res.orphans).toEqual([{ entityType: 'texts', uuid: 'u3', label: 'Text #13 (en)' }])
  })

  it('aborts when the backend returns no event id', async () => {
    mockBackend()
    storyApi.createEntity.mockResolvedValue({ uuid: 'same' })
    const res = await saveFastEvent({ storyUuid: STORY, story: {}, form: effectForm() })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('The backend returned no id for the new event')
    expect(res.orphans).toEqual([])
  })

  it('falls back to a generic error message', async () => {
    mockBackend()
    storyApi.createEntity.mockRejectedValue({})
    const res = await saveFastEvent({ storyUuid: STORY, story: {}, form: effectForm() })
    expect(res).toEqual({ ok: false, error: 'Save failed', created: [], orphans: [] })
  })
})

describe('rollback', () => {
  it('keeps entries without uuid as orphans', async () => {
    storyApi.deleteEntity.mockResolvedValue(true)
    const orphans = await rollback(STORY, [
      { entityType: 'texts', uuid: 'a', label: 'A' },
      { entityType: 'cards', uuid: null, label: 'B' },
    ])
    expect(orphans).toEqual([{ entityType: 'cards', uuid: null, label: 'B' }])
    expect(storyApi.deleteEntity).toHaveBeenCalledWith(STORY, 'texts', 'a')
  })
})
