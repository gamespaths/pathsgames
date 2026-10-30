// v0.41.6 — userApi: the owner-move preview; v1.7.0 the users list and the admin user actions.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api/client'
import {
  getAdminUser, listAdminUsers, banUser, suspendUser, unblockUser, relinkSubject, deleteOldUser,
} from '../../api/userApi'

vi.mock('../../api/client', () => ({ apiClient: vi.fn() }))

describe('userApi', () => {
  const get = vi.fn()
  const post = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.mockReturnValue({ get, post })
    get.mockResolvedValue({ data: { uuid: 'u1' } })
    post.mockResolvedValue({ data: { uuid: 'u1', action: 'BAN' } })
  })

  it('encodes an email and answers the body', async () => {
    expect(await getAdminUser(' a b@x.it ')).toEqual({ uuid: 'u1' })
    expect(get).toHaveBeenCalledWith('/api/admin/users/a%20b%40x.it')
  })

  it('tolerates a missing identifier', async () => {
    await getAdminUser(undefined)
    expect(get).toHaveBeenCalledWith('/api/admin/users/')
  })

  it('lists users sending only the filters that are set', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null, limit: 50 } })
    expect(await listAdminUsers({ limit: 50, cursor: '', email: undefined, nickname: 'ann', state: null }))
      .toEqual({ items: [], nextCursor: null, limit: 50 })
    expect(get).toHaveBeenCalledWith('/api/admin/users', { params: { limit: 50, nickname: 'ann' } })
  })

  it('lists users with no argument', async () => {
    await listAdminUsers()
    expect(get).toHaveBeenCalledWith('/api/admin/users', { params: {} })
  })

  it('posts every action with its reason', async () => {
    expect(await banUser('u1', 'Spam: too many posts')).toEqual({ uuid: 'u1', action: 'BAN' })
    expect(post).toHaveBeenCalledWith('/api/admin/users/u1/ban', { reason: 'Spam: too many posts' })
    await suspendUser(' u1 ', '2026-11-01', 'Abuse: rude words')
    expect(post).toHaveBeenCalledWith('/api/admin/users/u1/suspend', { until: '2026-11-01', reason: 'Abuse: rude words' })
    await unblockUser('u1', 'Other: appeal ok')
    expect(post).toHaveBeenCalledWith('/api/admin/users/u1/unblock', { reason: 'Other: appeal ok' })
    await relinkSubject('u1', 'Support request: new account')
    expect(post).toHaveBeenCalledWith('/api/admin/users/u1/relink-subject', { reason: 'Support request: new account' })
    await deleteOldUser(undefined, 'Other: old user')
    expect(post).toHaveBeenCalledWith('/api/admin/users//deletion', { reason: 'Other: old user' })
  })
})
