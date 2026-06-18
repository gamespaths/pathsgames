import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ __instance: true })),
    get: vi.fn(),
  },
}))

import axios from 'axios'
import { apiClient, fetchWithFallback, MOCK_SERVER } from '../api/client'

const STORAGE_KEY = 'pg_game_server'

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('apiClient', () => {
    it('returns null in mock mode (default / explicit mock)', () => {
      expect(apiClient()).toBeNull()
      localStorage.setItem(STORAGE_KEY, MOCK_SERVER)
      expect(apiClient()).toBeNull()
    })

    it('returns null when the stored server is an invalid URL', () => {
      localStorage.setItem(STORAGE_KEY, 'not a url')
      expect(apiClient()).toBeNull()
    })

    it('returns null when the protocol is not http(s)', () => {
      localStorage.setItem(STORAGE_KEY, 'ftp://example.com')
      expect(apiClient()).toBeNull()
    })

    it('creates an axios instance for a valid http server (trailing slash trimmed)', () => {
      localStorage.setItem(STORAGE_KEY, 'http://localhost:8042/')
      const client = apiClient()
      expect(client).toEqual({ __instance: true })
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'http://localhost:8042', timeout: 5000 }),
      )
    })
  })

  describe('fetchWithFallback', () => {
    it('returns the mock data in mock mode without hitting the network', async () => {
      const mock = [{ id: 1 }]
      expect(await fetchWithFallback('/api/stories', mock)).toBe(mock)
      expect(axios.get).not.toHaveBeenCalled()
    })

    it('returns response data when the request succeeds', async () => {
      localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
      axios.get.mockResolvedValue({ data: { ok: true } })
      const out = await fetchWithFallback('/api/stories', { fallback: true })
      expect(out).toEqual({ ok: true })
      expect(axios.get).toHaveBeenCalledWith('http://localhost:8042/api/stories', { timeout: 5000 })
    })

    it('falls back to the mock data when the request fails', async () => {
      localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
      axios.get.mockRejectedValue(new Error('boom'))
      const mock = { fallback: true }
      expect(await fetchWithFallback('/api/stories', mock)).toBe(mock)
    })
  })
})
