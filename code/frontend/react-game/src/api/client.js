import axios from 'axios'

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

export function apiClient() {
  const server = getServer()
  return axios.create({ baseURL: server, timeout: 5000 })
}

/** GET `url` against the configured server and return the JSON body. Throws on error. */
export async function fetchJson(url) {
  const server = getServer()
  const res = await axios.get(`${server}${url}`, { timeout: 5000 })
  return res.data
}

export default { fetchJson, apiClient }
