import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import * as matchApi from '../../api/matchApi'

vi.mock('../../api/client', () => ({
  apiClient: vi.fn(),
}))

describe('matchApi', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({ get: mockGet })
  })

  it('listMatches calls the admin endpoint', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await matchApi.listMatches()
    expect(mockGet).toHaveBeenCalledWith('/api/admin/matches')
  })

  it('listMatches returns response data', async () => {
    mockGet.mockResolvedValue({ data: [{ uuid: 'm1' }] })
    expect(await matchApi.listMatches()).toEqual([{ uuid: 'm1' }])
  })

  it('getMatchInfo calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await matchApi.getMatchInfo('m1')
    expect(mockGet).toHaveBeenCalledWith('/api/match/m1/info')
  })

  it('getMatchInfo returns response data', async () => {
    mockGet.mockResolvedValue({ data: { match: { uuid: 'm1' } } })
    expect(await matchApi.getMatchInfo('m1')).toEqual({ match: { uuid: 'm1' } })
  })
})
