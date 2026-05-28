import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const ServerContext = createContext(null)

const STORAGE_KEY = 'pg_game_server'
export const MOCK_SERVER = 'mock'
// Note: client.js also defines MOCK_SERVER to avoid circular dependency

const normalizeUrl = (url) =>
  (typeof url === 'string' && url !== MOCK_SERVER && url.endsWith('/') ? url.slice(0, -1) : url)

const getServers = () => {
  const envServers = import.meta.env.VITE_DEFAULT_SERVERS
  let list = []
  if (envServers) {
    try {
      const parsed = JSON.parse(envServers)
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed.map(s => ({ ...s, url: normalizeUrl(s.url) }))
      }
    } catch (e) {
      console.error('Error parsing VITE_DEFAULT_SERVERS from .env', e)
    }
  }
  if (list.length === 0) {
    const apiUrl = normalizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8042')
    list = [{ label: 'Local', url: apiUrl }]
  }
  // Always ensure Mock is first
  if (!list.some(s => s.url === MOCK_SERVER)) {
    list = [{ label: 'Mock (offline)', url: MOCK_SERVER }, ...list]
  }
  return list
}

const SERVERS = getServers()

async function probeServer(url) {
  try {
    await axios.get(`${url}/api/echo/status`, { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export function ServerProvider({ children }) {
  const [server, setServerState] = useState(() => normalizeUrl(localStorage.getItem(STORAGE_KEY)) || MOCK_SERVER)
  const [probing, setProbing] = useState(false)

  // On mount: auto-detect first available real server (only if stored is mock or stale)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored !== MOCK_SERVER) {
      // Already have a real server preference — keep it
      return
    }
    setProbing(true)
    const realServers = SERVERS.filter(s => s.url !== MOCK_SERVER)
    let cancelled = false

    ;(async () => {
      for (const srv of realServers) {
        if (cancelled) break
        const ok = await probeServer(srv.url)
        if (ok && !cancelled) {
          setServerState(srv.url)
          localStorage.setItem(STORAGE_KEY, srv.url)
          break
        }
      }
      if (!cancelled) setProbing(false)
    })()

    return () => { cancelled = true }
  }, [])

  const changeServer = useCallback((url) => {
    if (url === MOCK_SERVER) {
      setServerState(MOCK_SERVER)
      localStorage.setItem(STORAGE_KEY, MOCK_SERVER)
      return
    }
    try {
      const parsed = new URL(url)
      if (['http:', 'https:'].includes(parsed.protocol)) {
        const clean = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
        setServerState(clean)
        localStorage.setItem(STORAGE_KEY, clean)
      }
    } catch {
      // ignore invalid
    }
  }, [])

  return (
    <ServerContext.Provider value={{ server, servers: SERVERS, probing, changeServer }}>
      <div key={server}>
        {children}
      </div>
    </ServerContext.Provider>
  )
}

export function useServer() {
  return useContext(ServerContext)
}
