import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import * as matchApi from '../../api/matchApi'

vi.mock('../../api/client', () => ({
  apiClient: vi.fn(),
}))

describe('matchApi', () => {
  const mockGet = vi.fn()
  const mockPut = vi.fn()
  const mockPost = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({
      get: mockGet, put: mockPut, post: mockPost, delete: mockDelete,
    })
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

  it('getMatchInfo calls the admin detail endpoint', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await matchApi.getMatchInfo('m1')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/matches/m1/info')
  })

  it('getMatchInfo returns response data', async () => {
    mockGet.mockResolvedValue({ data: { match: { uuid: 'm1' } } })
    expect(await matchApi.getMatchInfo('m1')).toEqual({ match: { uuid: 'm1' } })
  })

  it('listMatchStatuses calls the statuses endpoint', async () => {
    mockGet.mockResolvedValue({ data: [{ value: 'CREATED', terminal: false }] })
    expect(await matchApi.listMatchStatuses()).toEqual([{ value: 'CREATED', terminal: false }])
    expect(mockGet).toHaveBeenCalledWith('/api/admin/matches/statuses')
  })

  it('updateMatch sends a PUT with the body', async () => {
    mockPut.mockResolvedValue({ data: { status: 'UPDATED' } })
    const res = await matchApi.updateMatch('m1', { status: 'ENDED', name: 'x' })
    expect(mockPut).toHaveBeenCalledWith('/api/admin/matches/m1', { status: 'ENDED', name: 'x' })
    expect(res).toEqual({ status: 'UPDATED' })
  })

  it('stopMatch posts to the stop action', async () => {
    mockPost.mockResolvedValue({ data: { status: 'UPDATED' } })
    await matchApi.stopMatch('m1')
    expect(mockPost).toHaveBeenCalledWith('/api/admin/matches/m1/stop')
  })

  it('pauseMatch posts to the pause action', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await matchApi.pauseMatch('m1')
    expect(mockPost).toHaveBeenCalledWith('/api/admin/matches/m1/pause')
  })

  it('resumeMatch posts to the resume action', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await matchApi.resumeMatch('m1')
    expect(mockPost).toHaveBeenCalledWith('/api/admin/matches/m1/resume')
  })

  it('deleteMatch sends a DELETE', async () => {
    mockDelete.mockResolvedValue({ data: { status: 'DELETED' } })
    const res = await matchApi.deleteMatch('m1')
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/matches/m1')
    expect(res).toEqual({ status: 'DELETED' })
  })

  it('listMatchStatuses calls statuses endpoint', async () => {
    mockGet.mockResolvedValue({ data: [{ value: 'RUNNING', terminal: false }] })
    const res = await matchApi.listMatchStatuses()
    expect(mockGet).toHaveBeenCalledWith('/api/admin/matches/statuses')
    expect(res).toEqual([{ value: 'RUNNING', terminal: false }])
  })

  it('changePlayerStatistics posts to the changeStatistics endpoint', async () => {
    mockPost.mockResolvedValue({ data: { status: 'UPDATED' } })
    const res = await matchApi.changePlayerStatistics('m1', 'p1', { life: 100 })
    expect(mockPost).toHaveBeenCalledWith('/api/admin/matches/m1/player/p1/changeStatistics', { life: 100 })
    expect(res).toEqual({ status: 'UPDATED' })
  })
})
