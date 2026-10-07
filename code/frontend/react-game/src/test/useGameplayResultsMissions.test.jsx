import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/matches', () => ({ getInventory: vi.fn(), selectChoice: vi.fn() }))

import useGameplayResults from '../features/gameplay/js/useGameplayResults'
import { getInventory } from '@/api/matches'

function setup({ weather = null } = {}) {
  const viewActions = {
    resetForReload: vi.fn(), setPreviewRight: vi.fn(), setPreviewLeft: vi.fn(),
    openPreview: vi.fn(), setChoices: vi.fn(), closeChoices: vi.fn(), setCounterZero: vi.fn(),
    openItems: vi.fn(),
  }
  const hook = renderHook(({ w }) => useGameplayResults({
    matchUuid: 'm1', accessToken: 'tok', lang: 'en', t: k => k, playerUuid: 'p1',
    playerStats: {}, gameData: {}, weather: w, clock: null, view: {}, viewActions,
    refreshChrome: vi.fn(), onReload: vi.fn(), onError: vi.fn(),
  }), { initialProps: { w: weather } })
  return { ...hook, viewActions }
}

const mission = (over = {}) => ({ uuid: 'm-1', name: 'Tutorial', status: 'COMPLETED',
  card: { title: 'Tutorial done' }, steps: [{ done: true }], ...over })

/** The updater the hook handed to setPreviewRight, applied to what the right page showed. */
function applied(viewActions, prev) {
  const updater = viewActions.setPreviewRight.mock.calls.at(-1)[0]
  expect(typeof updater).toBe('function')
  return updater(prev)
}

describe('useGameplayResults — showMissionsCompleted (v0.38.2)', () => {
  it('shows nothing for no missions', () => {
    const { result, viewActions } = setup()
    let shown
    act(() => { shown = result.current.showMissionsCompleted([]) })
    expect(shown).toBe(false)
    act(() => { shown = result.current.showMissionsCompleted(undefined) })
    expect(shown).toBe(false)
    expect(viewActions.setPreviewRight).not.toHaveBeenCalled()
  })

  it('puts the mission card on an empty right page, back arrow kept', () => {
    const { result, viewActions } = setup()
    act(() => { result.current.showMissionsCompleted([mission()]) })
    const page = applied(viewActions, null)

    expect(page.kind).toBe('preview')
    expect(page.type).toBe('missions')
    expect(page.card).toEqual({ title: 'Tutorial done', description: undefined })
    // "Mission completed" in green replaces "Status: Completed"; the step count stays.
    expect(page.statItemsToPageContent.map(s => s.key)).toEqual(['missionCompleted', 'missionSteps'])
    expect(page.statItemsToPageContent[0].value).toBe('game.missions.completed')
    expect(page.statItemsToPageContent[0].className).toBe('bonus-badge--done')
    // The word "Completed" must survive the badge list; no forward, and no back override.
    expect(page.additionalProps).toEqual({ bonusBadgeShowZeros: true })
  })

  it('chains behind the effect card: it only leads forward, and the mission keeps its back', () => {
    const { result, viewActions } = setup()
    act(() => { result.current.showMissionsCompleted([mission()]) })
    const effect = { kind: 'preview', card: { title: 'Effect' }, type: 'effect',
      additionalProps: { onClose: 'keep-me-out' } }
    const chained = applied(viewActions, effect)

    expect(chained.card.title).toBe('Effect')
    expect(chained.additionalProps.onClose).toBeUndefined()
    expect(typeof chained.additionalProps.onForward).toBe('function')

    chained.additionalProps.onForward()
    const page = viewActions.setPreviewRight.mock.calls.at(-1)[0]
    expect(page.card.title).toBe('Tutorial done')
    expect(page.additionalProps.onForward).toBeUndefined()
    expect('onClose' in page.additionalProps).toBe(false)
  })

  it('keeps where the effect card already led (the weather) at the END of the chain', () => {
    const { result, viewActions } = setup()
    const toWeather = vi.fn()
    act(() => { result.current.showMissionsCompleted([mission(), mission({ uuid: 'm-2',
      card: { title: 'Second' } })]) })
    const effect = { kind: 'preview', card: { title: 'Effect' }, type: 'effect',
      additionalProps: { onClose: undefined, onForward: toWeather } }
    const chained = applied(viewActions, effect)

    chained.additionalProps.onForward()
    const first = viewActions.setPreviewRight.mock.calls.at(-1)[0]
    expect(first.card.title).toBe('Tutorial done')
    expect(first.additionalProps.onClose).toBeUndefined()
    expect('onClose' in first.additionalProps).toBe(true)

    first.additionalProps.onForward()
    const second = viewActions.setPreviewRight.mock.calls.at(-1)[0]
    expect(second.card.title).toBe('Second')
    expect(second.additionalProps.onForward).toBe(toWeather)
    expect(toWeather).not.toHaveBeenCalled()
  })

  it('leads forward to a page that cannot carry an arrow itself (the weather)', () => {
    const { result, viewActions } = setup()
    act(() => { result.current.showMissionsCompleted([mission()]) })
    const weather = { kind: 'weather' }
    const page = applied(viewActions, weather)

    expect(page.card.title).toBe('Tutorial done')
    expect(page.additionalProps.onClose).toBeUndefined()
    page.additionalProps.onForward()
    expect(viewActions.setPreviewRight.mock.calls.at(-1)[0]).toBe(weather)
  })

  it('reads several closed missions one after the other, the last with a back arrow', () => {
    const { result, viewActions } = setup()
    act(() => { result.current.showMissionsCompleted([mission(), null,
      mission({ uuid: 'm-2', card: { title: 'Second' } })]) })
    const first = applied(viewActions, null)

    expect(first.card.title).toBe('Tutorial done')
    expect('onClose' in first.additionalProps).toBe(true)
    first.additionalProps.onForward()
    const second = viewActions.setPreviewRight.mock.calls.at(-1)[0]
    expect(second.card.title).toBe('Second')
    expect(second.additionalProps).toEqual({ bonusBadgeShowZeros: true })
  })
})

describe('useGameplayResults — a granted item read before what landed meanwhile (v0.38.2)', () => {
  const GRANT = { status: 'APPLIED', effects: [],
    itemChanges: [{ characterUuid: 'p1', itemUuid: 'item-9', action: 'ADD' }] }
  const ROW = { uuid: 'row-9', itemUuid: 'item-9', card: { title: 'A key' }, weight: 1, effects: [] }

  it('puts the fresh item on an empty right page, back arrow kept', async () => {
    getInventory.mockResolvedValue({ items: [ROW] })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted(GRANT) })
    await act(async () => {})
    const page = applied(viewActions, null)

    expect(page.type).toBe('item')
    expect(page.card.title).toBe('A key')
    expect(page.additionalProps).toEqual({})
  })

  it('leads forward to the mission the item closed when that landed first', async () => {
    getInventory.mockResolvedValue({ items: [ROW] })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted(GRANT) })
    await act(async () => {})
    const missionPage = { kind: 'preview', card: { title: 'Quest' }, type: 'missions',
      additionalProps: { bonusBadgeShowZeros: true } }
    const page = applied(viewActions, missionPage)

    expect(page.card.title).toBe('A key')
    expect(page.additionalProps.onClose).toBeUndefined()
    page.additionalProps.onForward()
    expect(viewActions.setPreviewRight.mock.calls.at(-1)[0]).toBe(missionPage)
  })

  it('a row with no card shows nothing and covers nothing', async () => {
    getInventory.mockResolvedValue({ items: [{ ...ROW, card: null }] })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted(GRANT) })
    await act(async () => {})
    // Only the reload's own reset touched the right page — no updater was handed over.
    expect(viewActions.setPreviewRight).not.toHaveBeenCalled()
  })
})

describe('useGameplayResults — the weather keeps a chain it lands on (v0.38.2)', () => {
  const SUNNY = { uuid: 'w1', card: { title: 'Sunny' } }
  const RAINY = { uuid: 'w2', card: { title: 'Rainy' } }

  it('slots in behind the effect card and leads on to what that already led to', async () => {
    const { result, viewActions, rerender } = setup({ weather: SUNNY })
    // An effect card is up (arms the "during event" flag), then the weather changes.
    await act(async () => { await result.current.handleEventExecuted(
      { effects: [{ card: { title: 'Effect' } }] }) })
    rerender({ w: RAINY })
    const toMission = vi.fn()
    const effect = { kind: 'preview', card: { title: 'Effect' }, type: 'effect',
      additionalProps: { onClose: undefined, onForward: toMission } }
    const chained = applied(viewActions, effect)

    chained.additionalProps.onForward()
    const weather = viewActions.setPreviewRight.mock.calls.at(-1)[0]
    expect(weather).toEqual({ kind: 'weather', onForward: toMission })
    expect(toMission).not.toHaveBeenCalled()
  })

  it('an effect card that led nowhere gets a weather page that leads nowhere either', async () => {
    const { result, viewActions, rerender } = setup({ weather: SUNNY })
    await act(async () => { await result.current.handleEventExecuted(
      { effects: [{ card: { title: 'Effect' } }] }) })
    rerender({ w: RAINY })
    const chained = applied(viewActions, { kind: 'preview', card: {}, additionalProps: {} })
    chained.additionalProps.onForward()
    expect(viewActions.setPreviewRight.mock.calls.at(-1)[0])
      .toEqual({ kind: 'weather', onForward: undefined })
  })
})

// Step 39 — after a sleep the new weather comes first, the wake-up list waits behind (→).
describe('useGameplayResults — the weather leads on to the wake-up list (Step 39)', () => {
  const SUNNY = { uuid: 'w1', card: { title: 'Sunny' } }
  const RAINY = { uuid: 'w2', card: { title: 'Rainy' } }

  function setupWith(view) {
    const viewActions = {
      resetForReload: vi.fn(), setPreviewRight: vi.fn(), setPreviewLeft: vi.fn(),
      openPreview: vi.fn(), setChoices: vi.fn(), closeChoices: vi.fn(), setCounterZero: vi.fn(),
      openItems: vi.fn(),
    }
    const hook = renderHook(({ w }) => useGameplayResults({
      matchUuid: 'm1', accessToken: 'tok', lang: 'en', t: k => k, playerUuid: 'p1',
      playerStats: {}, gameData: {}, weather: w, clock: null, view, viewActions,
      refreshChrome: vi.fn(), onReload: vi.fn(), onError: vi.fn(),
    }), { initialProps: { w: SUNNY } })
    return { ...hook, viewActions }
  }

  it('opens the weather page, whose forward arrow reveals the random event underneath', () => {
    const { viewActions, rerender } = setupWith({ counterZero: [{ trigger: 'RANDOM_EVENT' }] })
    rerender({ w: RAINY })
    const page = applied(viewActions, null)
    expect(page.kind).toBe('weather')
    page.onForward()
    expect(viewActions.setPreviewRight).toHaveBeenLastCalledWith(null)
  })

  it('never covers a card that already owns the right page (a coma)', () => {
    const { viewActions, rerender } = setupWith({ counterZero: [{ trigger: 'COUNTER_ZERO' }] })
    rerender({ w: RAINY })
    const coma = { kind: 'coma' }
    expect(applied(viewActions, coma)).toBe(coma)
  })

  it('a pending choice still keeps the weather away entirely', () => {
    const { viewActions, rerender } = setupWith({ pendingChoices: { event: {} },
      counterZero: [{ trigger: 'RANDOM_EVENT' }] })
    rerender({ w: RAINY })
    expect(viewActions.setPreviewRight).not.toHaveBeenCalled()
  })
})
