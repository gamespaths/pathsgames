import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  apiClient, acquireSlot, releaseSlot, limiterState, resetLimiter, MAX_IN_FLIGHT,
} from '../../api/client'

describe('apiClient', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('uses default server when nothing in localStorage', () => {
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:8044')
  })

  it('uses server from localStorage', () => {
    localStorage.setItem('pg_admin_server', 'http://localhost:9999')
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:9999')
  })

  it('falls back to default if server in localStorage is invalid', () => {
    localStorage.setItem('pg_admin_server', 'not-a-url')
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:8044')
  })

  it('falls back to default if server in localStorage uses unsupported protocol', () => {
    localStorage.setItem('pg_admin_server', 'ftp://malicious.com')
    const client = apiClient()
    expect(client.defaults.baseURL).toBe('http://localhost:8044')
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

  it('interceptor handles error with message from response', async () => {
    const client = apiClient()
    const mockError = {
      response: {
        data: { message: 'Custom error message' }
      }
    }
    
    // We need to access the interceptor's error handler.
    // apiClient() returns a new instance, so we can check its interceptors.
    const errorHandler = client.interceptors.response.handlers[0].rejected
    await expect(errorHandler(mockError)).rejects.toThrow('Custom error message')
  })

  it('interceptor handles error with fallback to err.message', async () => {
    const client = apiClient()
    const mockError = {
      message: 'Network Error'
    }
    const errorHandler = client.interceptors.response.handlers[0].rejected
    await expect(errorHandler(mockError)).rejects.toThrow('Network Error')
  })

  it('interceptor releases the slot of a failed request', async () => {
    resetLimiter()
    await acquireSlot()
    const client = apiClient()
    const errorHandler = client.interceptors.response.handlers[0].rejected
    await expect(errorHandler({ message: 'boom', config: { pgSlot: true } })).rejects.toThrow('boom')
    expect(limiterState().inFlight).toBe(0)
  })
})

describe('admin request limiter', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLimiter()
  })
  afterEach(() => resetLimiter())

  it('grants slots up to MAX_IN_FLIGHT, then queues', async () => {
    for (let i = 0; i < MAX_IN_FLIGHT; i++) await acquireSlot()
    let granted = false
    const pending = acquireSlot().then(() => { granted = true })
    await Promise.resolve()
    expect(granted).toBe(false)
    expect(limiterState()).toEqual({ inFlight: MAX_IN_FLIGHT, waiting: 1 })
    releaseSlot()
    await pending
    expect(granted).toBe(true)
    expect(limiterState()).toEqual({ inFlight: MAX_IN_FLIGHT, waiting: 0 })
  })

  it('serves waiting requests in FIFO order', async () => {
    for (let i = 0; i < MAX_IN_FLIGHT; i++) await acquireSlot()
    const order = []
    const a = acquireSlot().then(() => order.push('a'))
    const b = acquireSlot().then(() => order.push('b'))
    releaseSlot()
    releaseSlot()
    await Promise.all([a, b])
    expect(order).toEqual(['a', 'b'])
  })

  it('releaseSlot never drops inFlight below zero', () => {
    releaseSlot()
    expect(limiterState().inFlight).toBe(0)
  })

  it('response interceptor ignores configs without a slot', () => {
    const client = apiClient()
    const okHandler = client.interceptors.response.handlers[0].fulfilled
    const res = { config: {}, data: 1 }
    expect(okHandler(res)).toBe(res)
    expect(okHandler({ data: 2 }).data).toBe(2)
    expect(limiterState().inFlight).toBe(0)
  })

  it('a slot is released only once per request', async () => {
    await acquireSlot()
    await acquireSlot()
    const client = apiClient()
    const okHandler = client.interceptors.response.handlers[0].fulfilled
    const config = { pgSlot: true }
    okHandler({ config })
    okHandler({ config })
    expect(limiterState().inFlight).toBe(1)
  })

  it('keeps at most MAX_IN_FLIGHT real requests running at once', async () => {
    const client = apiClient()
    let running = 0
    let peak = 0
    const finishers = []
    client.defaults.adapter = (config) => {
      running++
      peak = Math.max(peak, running)
      return new Promise((resolve) => finishers.push(() => {
        running--
        resolve({ data: config.url, status: 200, statusText: 'OK', headers: {}, config })
      }))
    }
    const calls = Array.from({ length: MAX_IN_FLIGHT + 3 }, (_, i) => client.get(`/r${i}`))
    const flush = () => new Promise((r) => setTimeout(r, 0))
    await flush()
    expect(running).toBe(MAX_IN_FLIGHT)
    while (finishers.length) {
      finishers.shift()()
      await flush()
    }
    const results = await Promise.all(calls)
    expect(results.map((r) => r.data)).toEqual(calls.map((_, i) => `/r${i}`))
    expect(peak).toBe(MAX_IN_FLIGHT)
    expect(limiterState()).toEqual({ inFlight: 0, waiting: 0 })
  })

  it('frees the slot when the real request fails', async () => {
    const client = apiClient()
    client.defaults.adapter = (config) => Promise.reject(Object.assign(new Error('Network Error'), { config }))
    await expect(client.get('/x')).rejects.toThrow('Network Error')
    expect(limiterState().inFlight).toBe(0)
  })
})
