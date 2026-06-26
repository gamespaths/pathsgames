import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))

import axios from 'axios'
import { createGuestSession, resumeGuestSession } from '../api/auth'

describe('api/auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createGuestSession returns null without a server', async () => {
    expect(await createGuestSession()).toBeNull()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('createGuestSession posts to /api/auth/guest with credentials', async () => {
    axios.post.mockResolvedValue({ data: { userUuid: 'u1', accessToken: 'tok' } })
    const out = await createGuestSession('http://localhost:8042')
    expect(out).toEqual({ userUuid: 'u1', accessToken: 'tok' })
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8042/api/auth/guest',
      null,
      expect.objectContaining({ withCredentials: true, timeout: 5000 }),
    )
  })

  it('resumeGuestSession returns null without a server', async () => {
    expect(await resumeGuestSession()).toBeNull()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('resumeGuestSession posts to /api/auth/guest/resume', async () => {
    axios.post.mockResolvedValue({ data: { userUuid: 'u2' } })
    const out = await resumeGuestSession('http://localhost:8042')
    expect(out).toEqual({ userUuid: 'u2' })
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8042/api/auth/guest/resume',
      null,
      expect.objectContaining({ withCredentials: true }),
    )
  })
})
