// v0.41.6 — userApi: the owner-move preview, identifier trimmed and URL-encoded.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import { getAdminUser } from '../../api/userApi'

vi.mock('../../api/client', () => ({ apiClient: vi.fn() }))

describe('userApi', () => {
  const get = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({ get })
    get.mockResolvedValue({ data: { uuid: 'u1' } })
  })

  it('encodes an email and answers the body', async () => {
    expect(await getAdminUser(' a b@x.it ')).toEqual({ uuid: 'u1' })
    expect(get).toHaveBeenCalledWith('/api/admin/users/a%20b%40x.it')
  })

  it('tolerates a missing identifier', async () => {
    await getAdminUser(undefined)
    expect(get).toHaveBeenCalledWith('/api/admin/users/')
  })
})
