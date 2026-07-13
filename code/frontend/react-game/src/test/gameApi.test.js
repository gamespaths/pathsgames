import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/matches', () => ({ getMatchInfo: vi.fn() }))

import { getMatchInfo as fetchMatchInfo } from '../api/matches'
import { getMatchInfo, MatchNotRunningError } from '../api/game'

describe('api/game — getMatchInfo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the live match info when status is RUNNING', async () => {
    fetchMatchInfo.mockResolvedValue({ match: { status: 'RUNNING' }, live: true })
    expect(await getMatchInfo('m1', 'tok', 'it')).toEqual({ match: { status: 'RUNNING' }, live: true })
    expect(fetchMatchInfo).toHaveBeenCalledWith('m1', 'tok', 'it')
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

  it('returns null when there is no match uuid', async () => {
    expect(await getMatchInfo()).toBeNull()
    expect(fetchMatchInfo).not.toHaveBeenCalled()
  })

  it('returns null when fetchMatchInfo returns no data', async () => {
    fetchMatchInfo.mockResolvedValue(null)
    expect(await getMatchInfo('m1')).toBeNull()
  })

  it('propagates the error when fetchMatchInfo throws (network error)', async () => {
    fetchMatchInfo.mockRejectedValue(new Error('network'))
    await expect(getMatchInfo('m1', 'tok')).rejects.toThrow('network')
  })
})
