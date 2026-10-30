import axios from 'axios'
import { beginRequest, endRequest } from './inFlight'

const STORAGE_KEY = 'pg_game_server'

const normalizeUrl = (url) =>
  (typeof url === 'string' && url.endsWith('/') ? url.slice(0, -1) : url)

/** First configured server, used when nothing is stored in localStorage yet. */
function defaultServer() {
  const envServers = import.meta.env.VITE_DEFAULT_SERVERS
  if (envServers) {
    try {
      const parsed = JSON.parse(envServers)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.url) {
        return normalizeUrl(parsed[0].url)
      }
    } catch {
      // ignore invalid env, fall through to VITE_API_URL
    }
  }
  return normalizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8042')
}

function getServer() {
  const raw = localStorage.getItem(STORAGE_KEY) || defaultServer()
  try {
    const parsed = new URL(raw)
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
    }
  } catch {
    // ignore invalid
  }
  return defaultServer()
}

/** v1.2.0 called on a 401: refreshes (or resumes the guest) and answers the new bearer, or null. */
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

/** v1.2.0 a 401 outside /api/auth tries one refresh, then repeats the request with the new token. */
export async function retryOn401(instance, error) {
  const config = error?.config
  const url = String(config?.url ?? '')
  if (error?.response?.status !== 401 || !unauthorizedHandler || !config || config._pgRetried
      || url.includes('/api/auth/')) {
    throw error
  }
  const token = await unauthorizedHandler()
  if (!token) throw error
  config._pgRetried = true
  config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${token}` }
  return instance.request(config)
}

export function apiClient() {
  const server = getServer()
  const instance = axios.create({ baseURL: server, timeout: 5000 })
  // v1.7.0 counts the requests in flight (a retried request counts again)
  instance?.interceptors?.request?.use((config) => { beginRequest(); return config })
  instance?.interceptors?.response?.use((response) => { endRequest(); return response },
    (error) => { endRequest(); return Promise.reject(error) })
  instance?.interceptors?.response?.use((response) => response, (error) => retryOn401(instance, error))
  return instance
}

/** GET `url` against the configured server and return the JSON body. Throws on error. */
export async function fetchJson(url) {
  const server = getServer()
  const res = await axios.get(`${server}${url}`, { timeout: 5000 })
  return res.data
}

export default { fetchJson, apiClient }
