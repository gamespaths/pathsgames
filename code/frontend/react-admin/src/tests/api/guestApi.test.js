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
    expect(mockGet).toHaveBeenCalledWith('/api/admin/guests')
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
})
