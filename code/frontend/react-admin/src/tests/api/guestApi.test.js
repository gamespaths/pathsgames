import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import * as guestApi from '../../api/guestApi'

vi.mock('../../api/client', () => ({
  apiClient: vi.fn()
}))

describe('guestApi', () => {
  const mockGet = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    })
  })

  it('listGuests calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await guestApi.listGuests()
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests', { params: {} })
  })

  it('getGuestStats calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await guestApi.getGuestStats()
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests/stats')
  })

  it('getGuest calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await guestApi.getGuest('g1')
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests/g1')
  })

  it('deleteGuest calls correct endpoint', async () => {
    mockDelete.mockResolvedValue({ data: {} })
    await guestApi.deleteGuest('g1')
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/guests/g1')
  })

  it('deleteExpiredGuests calls correct endpoint', async () => {
    mockDelete.mockResolvedValue({ data: {} })
    await guestApi.deleteExpiredGuests()
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/guests/expired')
  })

  // v0.41.0 — withoutMatches travels only when true, so the old purge keeps its exact query.
  it('previewStaleGuests sends olderThanDays alone by default', async () => {
    mockGet.mockResolvedValue({ data: { guests: 1, matches: 2 } })
    expect(await guestApi.previewStaleGuests(30)).toEqual({ guests: 1, matches: 2 })
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests/stale', { params: { olderThanDays: 30 } })
  })

  it('previewStaleGuests adds withoutMatches=true when asked', async () => {
    mockGet.mockResolvedValue({ data: { guests: 1, matches: 0 } })
    await guestApi.previewStaleGuests(400, true)
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests/stale', { params: { olderThanDays: 400, withoutMatches: true } })
  })

  it('deleteStaleGuests omits withoutMatches when false', async () => {
    mockDelete.mockResolvedValue({ data: { guests: 1, matches: 2 } })
    await guestApi.deleteStaleGuests(30, false)
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/guests/stale', { params: { olderThanDays: 30 } })
  })

  it('deleteStaleGuests adds withoutMatches=true when asked', async () => {
    mockDelete.mockResolvedValue({ data: { guests: 1, matches: 0 } })
    expect(await guestApi.deleteStaleGuests(400, true)).toEqual({ guests: 1, matches: 0 })
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/guests/stale', { params: { olderThanDays: 400, withoutMatches: true } })
  })
})
