import { describe, it, expect } from 'vitest'
import { turnFor, TAB_ORDER } from '../features/gameplay/js/bookTurns'
import { bookViewReducer } from '../features/gameplay/js/useBookView'

// Step 15 — the direction of every GameBook change (step file 6.4): full turns only for view changes.

const BASE = {
  view: 'board', previewLeft: null, previewRight: null, pendingChoices: null, counterZero: null,
  mapSelected: null, missionSelected: null, sleepCardForced: false, turn: { key: 0, direction: null }, hold: false,
}
const at = (patch = {}) => ({ ...BASE, ...patch })
const turnOf = (state, action) => bookViewReducer(state, action).turn

describe('turnFor — tabs by bookmark order', () => {
  it('the order is position, information, backpack, map, missions', () => {
    expect(TAB_ORDER).toEqual(['board', 'info', 'items', 'map', 'missions'])
  })

  it('from the board every tab turns forward', () => {
    for (const type of ['openInfo', 'openItems', 'openMap', 'openMissions']) {
      expect(turnFor(at(), { type })).toBe('forward')
    }
  })

  it('tab to tab: to the right forward, to the left back', () => {
    expect(turnFor(at({ view: 'info' }), { type: 'openItems' })).toBe('forward')
    expect(turnFor(at({ view: 'items' }), { type: 'openMap' })).toBe('forward')
    expect(turnFor(at({ view: 'map' }), { type: 'openMissions' })).toBe('forward')
    expect(turnFor(at({ view: 'missions' }), { type: 'openItems' })).toBe('back')
    expect(turnFor(at({ view: 'map' }), { type: 'openInfo' })).toBe('back')
    expect(turnFor(at({ view: 'items' }), { type: 'openInfo' })).toBe('back')
  })

  it('a page outside the tabs (registry, training) to a tab turns forward; the same tab does not turn', () => {
    expect(turnFor(at({ view: 'registry' }), { type: 'openItems' })).toBe('forward')
    expect(turnFor(at({ view: 'exp' }), { type: 'openMap' })).toBe('forward')
    expect(turnFor(at({ view: 'items' }), { type: 'openItems' })).toBeUndefined()
    // the information view asked again with another page: a fade, not a turn
    expect(turnFor(at({ view: 'info' }), { type: 'openInfo' })).toBe('fade')
  })
})

describe('turnFor — the rows of the GameBook table', () => {
  it('registry, training, a mission\'s steps and the choices open forward', () => {
    for (const type of ['openRegistry', 'openExp', 'openMission', 'setChoices']) {
      expect(turnFor(at({ view: 'info' }), { type })).toBe('forward')
    }
  })

  it('back to the board turns back from any page; with only previews open it fades; nothing open: no turn', () => {
    expect(turnFor(at({ view: 'map' }), { type: 'closeAll' })).toBe('back')
    expect(turnFor(at({ view: 'items' }), { type: 'closeAll' })).toBe('back')
    expect(turnFor(at({ previewLeft: { type: 'trait' } }), { type: 'closeAll' })).toBe('fade')
    expect(turnFor(at({ previewRight: { kind: 'close' } }), { type: 'closeAll' })).toBe('fade')
    expect(turnFor(at({ mapSelected: { id: 1 } }), { type: 'closeAll' })).toBe('fade')
    expect(turnFor(at({ sleepCardForced: true }), { type: 'closeAll' })).toBe('fade')
    expect(turnFor(at(), { type: 'closeAll' })).toBeUndefined()
  })

  it('mission steps back to the grid, choices closed, coma / sadness closed: back', () => {
    expect(turnFor(at({ view: 'missionSteps' }), { type: 'openMissions' })).toBe('back')
    expect(turnFor(at({ pendingChoices: {} }), { type: 'closeChoices' })).toBe('back')
    expect(turnFor(at({ previewLeft: { kind: 'coma' } }), { type: 'previewLeft', value: null })).toBe('back')
    expect(turnFor(at({ previewLeft: { kind: 'sad' } }), { type: 'previewLeft', value: null })).toBe('back')
  })

  it('(i) reading pages, map node, close card, match-updated card, news chain arrows: fade', () => {
    expect(turnFor(at(), { type: 'previewLeft', value: { type: 'trait' } })).toBe('fade')
    expect(turnFor(at({ previewLeft: { type: 'trait' } }), { type: 'previewLeft', value: null })).toBe('fade')
    expect(turnFor(at(), { type: 'clearPreview' })).toBe('fade')
    expect(turnFor(at({ view: 'map' }), { type: 'mapSelected', value: { id: 3 } })).toBe('fade')
    expect(turnFor(at(), { type: 'forceSleepCard' })).toBe('fade')
    expect(turnFor(at(), { type: 'counterZero', value: null })).toBe('fade')
    const close = { kind: 'close' }
    expect(turnFor(at(), { type: 'previewRight' }, at({ previewRight: close }))).toBe('fade')
    const weather = { kind: 'weather' }
    expect(turnFor(at({ previewRight: { kind: 'preview' } }), { type: 'previewRight' }, at({ previewRight: weather }))).toBe('fade')
    expect(turnFor(at({ previewRight: weather }), { type: 'previewRight' }, at())).toBe('fade')
  })

  it('the match history turns forward and its back arrow back; the same page is no turn', () => {
    const log = { kind: 'matchlog' }
    expect(turnFor(at(), { type: 'previewRight' }, at({ previewRight: log }))).toBe('forward')
    expect(turnFor(at({ previewRight: log }), { type: 'previewRight' }, at())).toBe('back')
    expect(turnFor(at({ previewRight: log }), { type: 'previewRight' }, at({ previewRight: log }))).toBeUndefined()
  })

  it('a reload is a change with no turn; an unknown action asks nothing', () => {
    expect(turnFor(at({ view: 'items' }), { type: 'resetForReload' })).toBeNull()
    expect(turnFor(at(), { type: 'nope' })).toBeUndefined()
    expect(turnFor(at(), null)).toBeUndefined()
  })
})

describe('bookViewReducer — the turn it carries', () => {
  it('bumps the key with the direction of each change', () => {
    const s1 = bookViewReducer(at(), { type: 'openMap' })
    expect(s1.turn).toEqual({ key: 1, direction: 'forward' })
    const s2 = bookViewReducer(s1, { type: 'closeAll' })
    expect(s2.turn).toEqual({ key: 2, direction: 'back' })
  })

  it('an action\'s own direction overrides the table (null: a change with no turn)', () => {
    expect(turnOf(at({ view: 'items' }), { type: 'closeAll', direction: null })).toEqual({ key: 1, direction: null })
    expect(turnOf(at(), { type: 'previewRight', value: { kind: 'close' }, direction: 'forward' }))
      .toEqual({ key: 1, direction: 'forward' })
  })

  it('no page change, no turn (same values, or nothing open to close)', () => {
    expect(turnOf(at(), { type: 'counterZero', value: null })).toEqual(BASE.turn)
    expect(bookViewReducer(at(), { type: 'closeAll' }).turn).toEqual(BASE.turn)
    expect(bookViewReducer(at({ view: 'items' }), { type: 'openItems' }).turn).toEqual(BASE.turn)
  })

  it('a page change the table does not turn (the open tab asked again) keeps the key', () => {
    const next = bookViewReducer(at({ view: 'items', previewRight: { kind: 'preview' } }), { type: 'openItems' })
    expect(next.previewRight).toBeNull()
    expect(next.turn).toEqual(BASE.turn)
  })

  it('a state written before step 15 (no turn yet) starts counting from 0', () => {
    const { turn, ...old } = BASE
    expect(turn).toBeDefined()
    expect(bookViewReducer(old, { type: 'openMap' }).turn).toEqual({ key: 1, direction: 'forward' })
  })

  it('hold, then release with the answer\'s direction: ONE key bump; release with nothing held is a no-op', () => {
    const held = bookViewReducer(at(), { type: 'holdTurn' })
    expect(held.hold).toBe(true)
    expect(bookViewReducer(held, { type: 'holdTurn' })).toBe(held)
    const reloading = bookViewReducer(held, { type: 'resetForReload' })
    expect(reloading.hold).toBe(true)
    const released = bookViewReducer(reloading, { type: 'releaseTurn', direction: 'forward' })
    expect(released.hold).toBe(false)
    expect(released.turn).toEqual({ key: reloading.turn.key + 1, direction: 'forward' })
    expect(bookViewReducer(released, { type: 'releaseTurn', direction: 'back' })).toBe(released)
    expect(bookViewReducer(held, { type: 'releaseTurn' }).turn.direction).toBeNull()
  })
})
