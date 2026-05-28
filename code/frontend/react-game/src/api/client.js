import axios from 'axios'

export const MOCK_SERVER = 'mock'
const STORAGE_KEY = 'pg_game_server'

function getServer() {
  const raw = localStorage.getItem(STORAGE_KEY) || MOCK_SERVER
  if (raw === MOCK_SERVER) return MOCK_SERVER
  try {
    const parsed = new URL(raw)
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
    }
  } catch {
    // ignore invalid
  }
  return MOCK_SERVER
}

export function apiClient() {
  const server = getServer()
  if (server === MOCK_SERVER) return null
  return axios.create({ baseURL: server, timeout: 5000 })
}

export async function fetchWithFallback(url, mockData) {
  const server = getServer()
  if (server === MOCK_SERVER) return mockData
  try {
    const res = await axios.get(`${server}${url}`, { timeout: 5000 })
    return res.data
  } catch {
    return mockData
  }
}

export default { fetchWithFallback, apiClient }
