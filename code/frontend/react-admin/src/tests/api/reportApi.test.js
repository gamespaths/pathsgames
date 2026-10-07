import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import { getKpiReport } from '../../api/reportApi'

vi.mock('../../api/client', () => ({ apiClient: vi.fn() }))

describe('reportApi (v0.41.2)', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({ get: mockGet })
  })

  it('getKpiReport calls the admin endpoint with the query params', async () => {
    mockGet.mockResolvedValue({ data: { rows: [] } })
    const body = await getKpiReport({ storyUuid: 's1', groupBy: 'total' })
    expect(mockGet).toHaveBeenCalledWith('/api/admin/reports/kpi', { params: { storyUuid: 's1', groupBy: 'total' } })
    expect(body).toEqual({ rows: [] })
  })

  it('getKpiReport defaults to no params', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await getKpiReport()
    expect(mockGet).toHaveBeenCalledWith('/api/admin/reports/kpi', { params: {} })
  })
})
