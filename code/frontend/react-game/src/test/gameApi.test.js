import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/matches', () => ({ getMatchInfo: vi.fn() }))
vi.mock('../mock/matchInfo.json', () => ({ default: { __mock: true } }))

import { getMatchInfo } from '../api/matches'
import { getGameData } from '../api/game'

describe('api/game — getGameData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the live match info when available', async () => {
    getMatchInfo.mockResolvedValue({ live: true })
    expect(await getGameData('m1', 'tok')).toEqual({ live: true })
    expect(getMatchInfo).toHaveBeenCalledWith('m1', 'tok')
  })

  it('falls back to the mock payload when there is no match uuid', async () => {
    expect(await getGameData()).toEqual({ __mock: true })
    expect(getMatchInfo).not.toHaveBeenCalled()
  })

  it('falls back to the mock payload when getMatchInfo returns null (mock server)', async () => {
    getMatchInfo.mockResolvedValue(null)
    expect(await getGameData('m1')).toEqual({ __mock: true })
  })

  it('falls back to the mock payload when getMatchInfo throws', async () => {
    getMatchInfo.mockRejectedValue(new Error('network'))
    expect(await getGameData('m1', 'tok')).toEqual({ __mock: true })
  })
})
