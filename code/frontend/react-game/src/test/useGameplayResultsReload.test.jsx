import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/matches', () => ({ getInventory: vi.fn(), selectChoice: vi.fn() }))

import useGameplayResults from '../features/gameplay/js/useGameplayResults'

function setup(onReload) {
  const viewActions = {
    resetForReload: vi.fn(), setPreviewRight: vi.fn(), setPreviewLeft: vi.fn(),
    openPreview: vi.fn(), setChoices: vi.fn(), closeChoices: vi.fn(), setCounterZero: vi.fn(),
    openItems: vi.fn(),
  }
  const hook = renderHook(() => useGameplayResults({
    matchUuid: 'm1', accessToken: 'tok', lang: 'en', t: k => k, playerUuid: 'p1',
    playerStats: {}, gameData: {}, weather: null, view: {}, viewActions,
    refreshChrome: vi.fn(), onReload, onError: vi.fn(),
  }))
  return { ...hook, viewActions }
}

/** A reload the test resolves by hand. */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useGameplayResults — reload-driven loading (v0.37.4)', () => {
  it('keeps the loading page up until the reload has landed, no timer', async () => {
    const d = deferred()
    const { result } = setup(() => d.promise)

    let reload
    act(() => { reload = result.current.reloadBoard() })
    expect(result.current.loading).toBe(true)

    await act(async () => { d.resolve(); await reload })
    expect(result.current.loading).toBe(false)
  })

  it('a failed reload puts the loading page away too, and the handler still settles', async () => {
    const d = deferred()
    const { result } = setup(() => d.promise)

    let done
    act(() => { done = result.current.handleMovementDone({}) })
    await act(async () => { d.reject(new Error('boom')); await done })
    expect(result.current.loading).toBe(false)
  })

  it('only the LATEST reload may put the loading page away', async () => {
    const first = deferred()
    const second = deferred()
    const onReload = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = setup(onReload)

    let r1, r2
    act(() => { r1 = result.current.handleSlept({}) })
    act(() => { r2 = result.current.handleItemDropped() })
    await act(async () => { first.resolve(); await r1 })
    // The first landed, but the second is still on its way: the page stays.
    expect(result.current.loading).toBe(true)
    await act(async () => { second.resolve(); await r2 })
    expect(result.current.loading).toBe(false)
  })

  it('a move with no news keeps the loading page up until the destination has landed', async () => {
    const d = deferred()
    const { result } = setup(() => d.promise)
    let done
    act(() => { done = result.current.handleMovementDone({ automaticEvents: [], edgeState: null }) })
    expect(result.current.loading).toBe(true)
    await act(async () => { d.resolve(); await done })
    expect(result.current.loading).toBe(false)
  })

  it('a move whose arrival fired an event shows it at once, over the reload', async () => {
    const d = deferred()
    const { result, viewActions } = setup(() => d.promise)
    act(() => { result.current.handleMovementDone({
      automaticEvents: [{ card: { title: 'Ambush' } }] }) })
    expect(result.current.loading).toBe(false)
    expect(viewActions.setPreviewRight).toHaveBeenCalled()
  })

  it('a collapse on arrival is news too, and outranks the loading page', async () => {
    const d = deferred()
    const { result, viewActions } = setup(() => d.promise)
    act(() => { result.current.handleMovementDone({ edgeState: { comaUuids: ['p1'] } }) })
    expect(result.current.loading).toBe(false)
    expect(viewActions.setPreviewLeft).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'coma' }))
  })

  it('an event with nothing to narrate keeps the loading page up until the board lands', async () => {
    const d = deferred()
    const { result } = setup(() => d.promise)
    let done
    act(() => { done = result.current.handleEventExecuted({ status: 'OK', effects: [] }) })
    expect(result.current.loading).toBe(true)
    await act(async () => { d.resolve(); await done })
    expect(result.current.loading).toBe(false)
  })

  it('an event with a card to narrate puts the loading page away at once', async () => {
    const d = deferred()
    const { result, viewActions } = setup(() => d.promise)
    act(() => { result.current.handleEventExecuted({ status: 'OK',
      effects: [{ card: { title: 'Boom' } }] }) })
    expect(result.current.loading).toBe(false)
    expect(viewActions.openPreview).toHaveBeenCalled()
  })

  it('works with a caller that wired no reload at all', async () => {
    const { result } = setup(undefined)
    let reload
    act(() => { reload = result.current.handleItemUsed({}) })
    await act(async () => { await reload })
    expect(result.current.loading).toBe(false)
  })
})
