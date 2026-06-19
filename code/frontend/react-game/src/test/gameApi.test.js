import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/matches', () => ({ getMatchInfo: vi.fn() }))
vi.mock('../mock/matchInfo.json', () => ({ default: { __mock: true } }))

import { getMatchInfo as fetchMatchInfo } from '../api/matches'
import { getMatchInfo, MatchNotRunningError } from '../api/game'

describe('api/game — getMatchInfo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the live match info when status is RUNNING', async () => {
    fetchMatchInfo.mockResolvedValue({ match: { status: 'RUNNING' }, live: true })
    expect(await getMatchInfo('m1', 'tok')).toEqual({ match: { status: 'RUNNING' }, live: true })
    expect(fetchMatchInfo).toHaveBeenCalledWith('m1', 'tok')
  })

  it('throws MatchNotRunningError when status is ENDED', async () => {
    fetchMatchInfo.mockResolvedValue({ match: { status: 'ENDED' } })
    await expect(getMatchInfo('m1', 'tok')).rejects.toThrow(MatchNotRunningError)
  })

  it('MatchNotRunningError carries the status', async () => {
    fetchMatchInfo.mockResolvedValue({ match: { status: 'GAMEOVER' } })
    const err = await getMatchInfo('m1', 'tok').catch(e => e)
    expect(err).toBeInstanceOf(MatchNotRunningError)
    expect(err.status).toBe('GAMEOVER')
  })

  it('falls back to the mock payload when there is no match uuid', async () => {
    expect(await getMatchInfo()).toEqual({ __mock: true })
    expect(fetchMatchInfo).not.toHaveBeenCalled()
  })

  it('falls back to the mock payload when fetchMatchInfo returns null (mock server)', async () => {
    fetchMatchInfo.mockResolvedValue(null)
    expect(await getMatchInfo('m1')).toEqual({ __mock: true })
  })

  it('falls back to the mock payload when fetchMatchInfo throws (network error)', async () => {
    fetchMatchInfo.mockRejectedValue(new Error('network'))
    expect(await getMatchInfo('m1', 'tok')).toEqual({ __mock: true })
  })
})
