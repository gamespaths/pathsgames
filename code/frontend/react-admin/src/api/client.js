import axios from 'axios'

// Max admin requests in flight: keeps page bursts (and their CORS preflights) under the API Gateway admin throttle.
export const MAX_IN_FLIGHT = 4
let inFlight = 0
const waiting = []

/** Resolves when a request slot is free; callers past MAX_IN_FLIGHT wait in FIFO order. */
export function acquireSlot() {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}

/** Frees a slot, handing it straight to the oldest waiting request if any. */
export function releaseSlot() {
  const next = waiting.shift()
  if (next) next()
  else inFlight = Math.max(0, inFlight - 1)
}

/** Current limiter state, for tests. */
export function limiterState() {
  return { inFlight, waiting: waiting.length }
}

/** Empties the limiter, for tests. */
export function resetLimiter() {
  inFlight = 0
  waiting.length = 0
}

function releaseFor(config) {
  if (config?.pgSlot) {
    config.pgSlot = false
    releaseSlot()
  }
}

/**
 * Build an axios instance dynamically for each call so we always use
 * the latest server URL and token from localStorage.
 */
export function apiClient() {
  const token  = localStorage.getItem('pg_admin_token') || ''
  // The admin console talks ONLY to /api/admin/** endpoints, which are served on the
  // dedicated admin port 8044 (not the public 8042 player API).
  const rawServer = localStorage.getItem('pg_admin_server') || 'http://localhost:8044'

  let server = 'http://localhost:8044'
  try {
    const parsedUrl = new URL(rawServer)
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      // Reconstruct the URL from parsed components to sanitize it and avoid using the raw tainted string
      server = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`
      if (server.endsWith('/')) {
        server = server.slice(0, -1)
      }
    }
  } catch (e) {
    // Keep default if invalid
  }

  const instance = axios.create({
    baseURL: server,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    withCredentials: true,
  })

  instance.interceptors.request.use(async (config) => {
    await acquireSlot()
    config.pgSlot = true
    return config
  })

  instance.interceptors.response.use(
    (res) => {
      releaseFor(res.config)
      return res
    },
    (err) => {
      releaseFor(err.config)
      const msg = err.response?.data?.message || err.response?.data?.error || err.message
      return Promise.reject(new Error(msg))
    }
  )

  return instance
}
