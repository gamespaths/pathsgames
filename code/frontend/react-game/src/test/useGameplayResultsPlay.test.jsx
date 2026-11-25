import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/matches', () => ({ getInventory: vi.fn(), selectChoice: vi.fn() }))

import useGameplayResults, { SLOW_RELOAD_MS, HOLD_MAX_MS } from '../features/gameplay/js/useGameplayResults'
import { selectChoice } from '@/api/matches'
import { installWaapi } from './fixtures/waapi'

// Step 15 — the order of a played answer: land (fall, flight), then hold + reload in one commit,
// then ONE turn once the board and the chrome have settled (or 1 s later while still loading).

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function setup({ landing = null, onReload = () => Promise.resolve(), refreshChrome = () => Promise.resolve() } = {}) {
  const order = []
  const log = name => vi.fn((...args) => { order.push(args.length && args[0] !== undefined ? `${name}:${args[0]}` : name) })
  const viewActions = {
    resetForReload: log('reset'), setPreviewRight: vi.fn(), setPreviewLeft: vi.fn(),
    openPreview: vi.fn(), setChoices: vi.fn(), closeChoices: vi.fn(), setCounterZero: vi.fn(),
    openItems: log('openItems'), holdTurn: log('hold'), releaseTurn: log('release'),
  }
  const play = {
    land: vi.fn(() => { order.push('land'); return landing }),
    end: vi.fn(() => order.push('end')),
    cancel: vi.fn(() => order.push('cancel')),
  }
  const onError = vi.fn()
  const hook = renderHook(() => useGameplayResults({
    matchUuid: 'm1', accessToken: 'tok', lang: 'en', t: k => k, playerUuid: 'p1',
    playerStats: {}, gameData: {}, weather: null, clock: null, view: {}, viewActions,
    refreshChrome: vi.fn(refreshChrome), onReload: vi.fn(() => { order.push('reload'); return onReload() }),
    onError, play,
  }))
  return { ...hook, viewActions, play, order, onError }
}

/** The release waits one task after the answer's news effects (real timers). */
const tick = () => act(async () => { await new Promise(res => setTimeout(res, 0)) })

let waapi = null
afterEach(() => {
  waapi?.restore()
  waapi = null
  vi.useRealTimers()
})

describe('useGameplayResults — no play, no turn (jsdom: no WAAPI)', () => {
  it('stays synchronous: the reload starts in the click, nothing is held', () => {
    const { result, play, viewActions, order } = setup()
    let reload
    act(() => { reload = result.current.handleMovementDone({}) })
    expect(reload).toBeInstanceOf(Promise)
    expect(order).toEqual(['land', 'end', 'reset'])
    expect(viewActions.holdTurn).not.toHaveBeenCalled()
    expect(play.end).toHaveBeenCalled()
  })

  it('without a play controller at all the handlers are today\'s', () => {
    const viewActions = { resetForReload: vi.fn(), setCounterZero: vi.fn(), setPreviewLeft: vi.fn() }
    const { result } = renderHook(() => useGameplayResults({ t: k => k, viewActions, refreshChrome: vi.fn(),
      onReload: vi.fn() }))
    act(() => { result.current.handleSlept({ counterZero: [] }) })
    expect(viewActions.resetForReload).toHaveBeenCalled()
  })

  it('a drop reopens the bag on itself with no turn', () => {
    const { result, order } = setup()
    act(() => { result.current.handleItemDropped() })
    expect(order).toEqual(['reset', 'openItems:null'])
  })
})

describe('useGameplayResults — play on, turn off', () => {
  it('lands first, then today\'s reload with no hold', async () => {
    const landing = deferred()
    const { result, order, viewActions } = setup({ landing: landing.promise })
    let done
    act(() => { done = result.current.handleEventExecuted({}) })
    expect(order).toEqual(['land'])
    await act(async () => { landing.resolve(); await done })
    expect(order).toEqual(['land', 'end', 'reset', 'reload'])
    expect(viewActions.holdTurn).not.toHaveBeenCalled()
  })
})

describe('useGameplayResults — turn on (WAAPI)', () => {
  beforeEach(() => { waapi = installWaapi() })

  it('land → hold → end → reload in one go, then ONE forward turn once board and chrome settled', async () => {
    const landing = deferred()
    const reload = deferred()
    const chrome = deferred()
    const { result, order, viewActions } = setup({ landing: landing.promise, onReload: () => reload.promise,
      refreshChrome: () => chrome.promise })
    let done
    act(() => { done = result.current.handleMovementDone({}) })
    expect(order).toEqual(['land'])
    await act(async () => { landing.resolve() })
    expect(order).toEqual(['land', 'hold', 'end', 'reset', 'reload'])
    await act(async () => { reload.resolve(); await done })
    expect(viewActions.releaseTurn).not.toHaveBeenCalled() // the weather of the same answer is still coming
    await act(async () => { chrome.resolve() })
    expect(viewActions.releaseTurn).not.toHaveBeenCalled() // after the news effects of that commit
    await tick()
    expect(viewActions.releaseTurn).toHaveBeenCalledTimes(1)
    expect(viewActions.releaseTurn).toHaveBeenCalledWith('forward')
  })

  // Step 15 (6.2) — a weather change of the same answer lands inside the one turn, never after it.
  it('the weather news of the answer is written before the release (inside the ONE turn, no fade cutting it)', async () => {
    const order = []
    const viewActions = {
      resetForReload: vi.fn(), setPreviewLeft: vi.fn(), openPreview: vi.fn(), setChoices: vi.fn(),
      closeChoices: vi.fn(), setCounterZero: vi.fn(), openItems: vi.fn(), holdTurn: vi.fn(),
      setPreviewRight: vi.fn(() => order.push('weather')),
      releaseTurn: vi.fn(dir => order.push(`release:${dir}`)),
    }
    const chrome = deferred()
    const props = { matchUuid: 'm1', t: k => k, playerUuid: 'p1', playerStats: {}, gameData: {}, clock: null,
      view: {}, viewActions, refreshChrome: () => chrome.promise, onReload: () => Promise.resolve(), play: null }
    const { result, rerender } = renderHook(p => useGameplayResults(p), { initialProps: { ...props, weather: { uuid: 'w1' } } })
    await act(async () => { result.current.handleMovementDone({}) })
    // the weather call answers last: the settled chrome and the new weather reach React in ONE batch
    await act(async () => {
      chrome.resolve()
      for (let i = 0; i < 10; i += 1) await Promise.resolve()
      rerender({ ...props, weather: { uuid: 'w2' } })
    })
    await tick()
    expect(order).toEqual(['weather', 'release:forward'])
  })

  it('play off, turn on: no landing, still held and released with one turn', async () => {
    const { result, order, viewActions } = setup()
    await act(async () => { await result.current.handleSlept({ counterZero: [] }) })
    await tick()
    expect(order.slice(0, 4)).toEqual(['land', 'hold', 'end', 'reset'])
    expect(viewActions.releaseTurn).toHaveBeenCalledWith('forward')
  })

  it('item use and training close their page: ONE back turn', async () => {
    const { result, viewActions } = setup()
    await act(async () => { await result.current.handleItemUsed({ card: { title: 'potion' } }) })
    await tick()
    expect(viewActions.releaseTurn).toHaveBeenLastCalledWith('back')
    await act(async () => { await result.current.handleExpUsed({}) })
    await tick()
    expect(viewActions.releaseTurn).toHaveBeenLastCalledWith('back')
    expect(viewActions.releaseTurn).toHaveBeenCalledTimes(2)
  })

  it('a slow reload: released 1 s after the landing (the turn shows the loading page), no second turn', async () => {
    vi.useFakeTimers()
    const reload = deferred()
    const { result, viewActions } = setup({ onReload: () => reload.promise })
    let done
    await act(async () => { done = result.current.handleMovementDone({}) })
    expect(result.current.loading).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_RELOAD_MS - 1) })
    expect(viewActions.releaseTurn).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(viewActions.releaseTurn).toHaveBeenCalledWith('forward')
    await act(async () => { reload.resolve(); await done })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(viewActions.releaseTurn).toHaveBeenCalledTimes(1)
  })

  it('a chrome that never answers: the hold still ends after 10 s', async () => {
    vi.useFakeTimers()
    const { result, viewActions } = setup({ refreshChrome: () => new Promise(() => {}) })
    // news covers the reload (loading off at once), so the slow fallback does not fire
    await act(async () => { result.current.handleMovementDone({ edgeState: null, automaticEvents: [{ card: { title: 'x' } }] }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_RELOAD_MS) })
    expect(viewActions.releaseTurn).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(HOLD_MAX_MS - SLOW_RELOAD_MS) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(viewActions.releaseTurn).toHaveBeenCalledTimes(1)
  })

  it('a newer hold makes the older release a no-op', async () => {
    const first = deferred()
    const second = deferred()
    const onReload = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, viewActions } = setup({ onReload })
    await act(async () => { result.current.handleSlept({}) })
    await act(async () => { result.current.handleSlept({}) })
    await act(async () => { first.resolve() })
    await tick()
    expect(viewActions.releaseTurn).not.toHaveBeenCalled()
    await act(async () => { second.resolve() })
    await tick()
    expect(viewActions.releaseTurn).toHaveBeenCalledTimes(1)
  })

  it('a choice: select-choice answers, lands, holds, turns forward', async () => {
    selectChoice.mockResolvedValue({ status: 'OK' })
    const landing = deferred()
    const { result, order, viewActions } = setup({ landing: landing.promise })
    let done
    await act(async () => { done = result.current.handleSelectChoice({ uuid: 'c1' }) })
    expect(order).toEqual(['land'])
    await act(async () => { landing.resolve(); await done })
    expect(order.slice(0, 4)).toEqual(['land', 'hold', 'end', 'reset'])
    expect(viewActions.closeChoices).toHaveBeenCalled()
    await tick()
    expect(viewActions.releaseTurn).toHaveBeenCalledWith('forward')
  })

  it('a refused choice puts the lifted card down and says why', async () => {
    selectChoice.mockRejectedValue({ response: { data: { error: 'CHOICE_GONE' } } })
    const { result, play, onError, viewActions } = setup()
    await act(async () => { await result.current.handleSelectChoice({ uuid: 'c1' }) })
    expect(play.cancel).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('CHOICE_GONE')
    expect(viewActions.holdTurn).not.toHaveBeenCalled()
  })
})
