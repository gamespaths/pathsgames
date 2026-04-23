import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { apiClient } from '../../api/client'

describe('apiClient', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('uses default server when nothing in localStorage', () => {
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:8042')
  })

  it('uses server from localStorage', () => {
    localStorage.setItem('pg_admin_server', 'http://localhost:9999')
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:9999')
  })

  it('sets Authorization header when token is present', () => {
    localStorage.setItem('pg_admin_token', 'eyJtest.token')
    const client = apiClient()
    expect(client.defaults.headers['Authorization']).toBe('Bearer eyJtest.token')
  })

  it('omits Authorization header when no token', () => {
    const client = apiClient()
    expect(client.defaults.headers['Authorization']).toBeUndefined()
  })

  it('sets Content-Type to application/json', () => {
    const client = apiClient()
    expect(client.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('sets withCredentials true', () => {
    const client = apiClient()
    expect(client.defaults.withCredentials).toBe(true)
  })

  it('has 15s timeout', () => {
    const client = apiClient()
    expect(client.defaults.timeout).toBe(15000)
  })
})
