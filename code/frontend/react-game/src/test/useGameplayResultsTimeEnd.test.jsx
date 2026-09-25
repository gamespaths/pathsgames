import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/matches', () => ({ getInventory: vi.fn(), selectChoice: vi.fn() }))

import { getInventory, selectChoice } from '@/api/matches'
import useGameplayResults from '../features/gameplay/js/useGameplayResults'

// Step 40 — an action that ends the time early narrates the time-start after its own card.

function setup({ weather = null, view = {} } = {}) {
  const viewActions = {
    resetForReload: vi.fn(), setPreviewRight: vi.fn(), setPreviewLeft: vi.fn(),
    openPreview: vi.fn(), setChoices: vi.fn(), closeChoices: vi.fn(), setCounterZero: vi.fn(),
    openItems: vi.fn(),
  }
  const hook = renderHook(props => useGameplayResults({
    matchUuid: 'm1', accessToken: 'tok', lang: 'en', t: k => k, playerUuid: 'p1',
    playerStats: {}, gameData: {}, weather: props.weather, clock: null, view: props.view,
    viewActions, refreshChrome: vi.fn(), onReload: () => Promise.resolve(), onError: vi.fn(),
  }), { initialProps: { weather, view } })
  return { ...hook, viewActions }
}

const CZ = [{ trigger: 'COUNTER_ZERO', eventUuid: 'evt-fuse' }]
const EFFECT = { status: 'APPLIED', effects: [{ card: { title: 'Night falls' } }] }

/** The last page set with setPreviewRight, following a functional update when given one. */
function lastRightPage(viewActions, prev = null) {
  const calls = viewActions.setPreviewRight.mock.calls
  const value = calls[calls.length - 1][0]
  return typeof value === 'function' ? value(prev) : value
}

describe('useGameplayResults — early time-end news (Step 40)', () => {
  it('event card → (→) changed weather → (→) wake-up list', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted({ ...EFFECT, timeEnded: true,
      weather: { uuid: 'w-rain', changed: true }, counterZero: CZ }) })

    expect(viewActions.setCounterZero).toHaveBeenCalledWith(CZ)
    const opened = viewActions.openPreview.mock.calls[0][0]
    expect(opened.props.onClose).toBeUndefined()
    act(() => opened.props.onForward())
    const weatherPage = lastRightPage(viewActions)
    expect(weatherPage.kind).toBe('weather')
    act(() => weatherPage.onForward())
    expect(lastRightPage(viewActions)).toBeNull()
  })

  it('an unchanged weather is skipped: the card leads straight to the wake-up list', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted({ ...EFFECT, timeEnded: true,
      weather: { uuid: 'w-sun', changed: false }, counterZero: CZ }) })
    const opened = viewActions.openPreview.mock.calls[0][0]
    act(() => opened.props.onForward())
    expect(lastRightPage(viewActions)).toBeNull()
  })

  it('no card of its own: the weather page opens at once, with no list to lead to', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted({ status: 'APPLIED',
      effects: [], timeEnded: true, weather: { uuid: 'w-rain', changed: true }, counterZero: [] }) })
    expect(viewActions.openPreview).not.toHaveBeenCalled()
    const page = lastRightPage(viewActions)
    expect(page.kind).toBe('weather')
    expect(page.onForward).toBeUndefined()
    expect(viewActions.setCounterZero).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('the reloaded weather does not show its card a second time', async () => {
    const { result, viewActions, rerender } = setup({ weather: { uuid: 'w-sun' } })
    await act(async () => { await result.current.handleEventExecuted({ ...EFFECT, timeEnded: true,
      weather: { uuid: 'w-rain', changed: true }, counterZero: [] }) })
    const before = viewActions.setPreviewRight.mock.calls.length
    rerender({ weather: { uuid: 'w-rain' }, view: {} })
    expect(viewActions.setPreviewRight.mock.calls.length).toBe(before)
  })

  it('a time that did not end adds nothing', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted({ ...EFFECT, timeEnded: false,
      weather: null, counterZero: [] }) })
    expect(viewActions.openPreview.mock.calls[0][0].props).toBeNull()
    expect(viewActions.setCounterZero).not.toHaveBeenCalled()
  })

  it('a granted item keeps the weather behind its forward arrow', async () => {
    getInventory.mockResolvedValue({ items: [{ itemUuid: 'it-1', card: { title: 'Lantern' } }] })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleEventExecuted({ status: 'APPLIED',
      effects: [], itemChanges: [{ characterUuid: 'p1', itemUuid: 'it-1', action: 'ADD' }],
      timeEnded: true, weather: { uuid: 'w-rain', changed: true }, counterZero: [] }) })
    await act(async () => { await Promise.resolve() })
    const weatherPage = { kind: 'weather' }
    const itemPage = lastRightPage(viewActions, weatherPage)
    expect(itemPage.card.title).toBe('Lantern')
    act(() => itemPage.additionalProps.onForward())
    expect(lastRightPage(viewActions)).toBe(weatherPage)
  })

  it('select-choice: the outcome card leads to the weather', async () => {
    selectChoice.mockResolvedValue({ status: 'APPLIED', choiceEventCard: { title: 'Dusk' },
      timeEnded: true, weather: { uuid: 'w-rain', changed: true }, counterZero: CZ })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleSelectChoice({ uuid: 'ch-1' }) })
    expect(viewActions.setCounterZero).toHaveBeenCalledWith(CZ)
    const opened = viewActions.openPreview.mock.calls[0][0]
    act(() => opened.props.onForward())
    expect(lastRightPage(viewActions).kind).toBe('weather')
  })

  it('select-choice with no card opens the news directly', async () => {
    selectChoice.mockResolvedValue({ status: 'APPLIED', effects: [], timeEnded: true,
      weather: { uuid: 'w-rain', changed: true }, counterZero: [] })
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleSelectChoice({ uuid: 'ch-1' }) })
    expect(viewActions.openPreview).not.toHaveBeenCalled()
    expect(lastRightPage(viewActions).kind).toBe('weather')
  })

  it('movement: the arrival cards lead to the weather, then the list', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleMovementDone({
      automaticEvents: [{ card: { title: 'Dusk' } }], timeEnded: true,
      weather: { uuid: 'w-rain', changed: true }, counterZero: CZ }) })
    const arrival = lastRightPage(viewActions)
    expect(arrival.card.title).toBe('Dusk')
    act(() => arrival.additionalProps.onForward())
    const weatherPage = lastRightPage(viewActions)
    expect(weatherPage.kind).toBe('weather')
    act(() => weatherPage.onForward())
    expect(lastRightPage(viewActions)).toBeNull()
  })

  it('movement with no arrival card still tells the news and stops the loading page', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleMovementDone({ automaticEvents: [],
      timeEnded: true, weather: { uuid: 'w-sun', changed: false }, counterZero: CZ }) })
    expect(viewActions.setCounterZero).toHaveBeenCalledWith(CZ)
    expect(lastRightPage(viewActions)).toBeNull()
  })

  it('F1 — sleep: the changed weather comes first, the wake-up list waits under it', async () => {
    const { result, viewActions, rerender } = setup({ weather: { uuid: 'w-sun' } })
    await act(async () => { await result.current.handleSlept({ counterZero: CZ }) })
    expect(viewActions.setCounterZero).toHaveBeenCalledWith(CZ)
    rerender({ weather: { uuid: 'w-rain' }, view: { counterZero: CZ } })
    const page = lastRightPage(viewActions)
    expect(page.kind).toBe('weather')
    act(() => page.onForward())
    expect(lastRightPage(viewActions)).toBeNull()
  })
})
