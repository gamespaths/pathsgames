import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import * as echoApi from '../../api/echoApi'

vi.mock('../../api/client', () => ({
  apiClient: vi.fn()
}))

describe('echoApi', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({
      get: mockGet
    })
  })

  it('getServerStatus calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: { status: 'ok' } })
    await echoApi.getServerStatus()
    expect(mockGet).toHaveBeenCalledWith('/api/echo/status')
  })
})
