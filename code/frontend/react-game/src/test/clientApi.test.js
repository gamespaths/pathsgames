import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ __instance: true })),
    get: vi.fn(),
  },
}))

import axios from 'axios'
import { apiClient, fetchJson } from '../api/client'

const STORAGE_KEY = 'pg_game_server'
// Default server is stubbed here so the test does not depend on any .env file
// (e.g. the gitignored .env.test, which is absent in CI). client.js reads
// VITE_DEFAULT_SERVERS at call time, so a stub in beforeEach is enough.
const DEFAULT_SERVER = 'https://api-test-server2.paths.games'
const TEST_SERVERS = JSON.stringify([
  { label: 'Server test 2', url: DEFAULT_SERVER },
  { label: 'Server test', url: 'https://api-test.paths.games' },
])

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubEnv('VITE_DEFAULT_SERVERS', TEST_SERVERS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('apiClient', () => {
    it('uses the default server when nothing is stored', () => {
      apiClient()
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: DEFAULT_SERVER, timeout: 5000 }),
      )
    })

    it('falls back to the default server when the stored server is an invalid URL', () => {
      localStorage.setItem(STORAGE_KEY, 'not a url')
      apiClient()
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: DEFAULT_SERVER, timeout: 5000 }),
      )
    })

    it('falls back to the default server when the protocol is not http(s)', () => {
      localStorage.setItem(STORAGE_KEY, 'ftp://example.com')
      apiClient()
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: DEFAULT_SERVER, timeout: 5000 }),
      )
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

  describe('fetchJson', () => {
    it('returns response data when the request succeeds', async () => {
      localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
      axios.get.mockResolvedValue({ data: { ok: true } })
      const out = await fetchJson('/api/stories')
      expect(out).toEqual({ ok: true })
      expect(axios.get).toHaveBeenCalledWith('http://localhost:8042/api/stories', { timeout: 5000 })
    })

    it('hits the default server when nothing is stored', async () => {
      axios.get.mockResolvedValue({ data: [] })
      await fetchJson('/api/stories')
      expect(axios.get).toHaveBeenCalledWith(`${DEFAULT_SERVER}/api/stories`, { timeout: 5000 })
    })

    it('propagates the error when the request fails', async () => {
      localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
      axios.get.mockRejectedValue(new Error('boom'))
      await expect(fetchJson('/api/stories')).rejects.toThrow('boom')
    })
  })
})
