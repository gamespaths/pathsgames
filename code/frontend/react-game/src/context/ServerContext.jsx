import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getServerStatus } from '@/api/echoApi'

const ServerContext = createContext(null)

const STORAGE_KEY = 'pg_game_server'

const normalizeUrl = (url) =>
  (typeof url === 'string' && url.endsWith('/') ? url.slice(0, -1) : url)

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
  return list
}

const SERVERS = getServers()
const DEFAULT_SERVER = SERVERS[0].url

// v0.37.6 — one GET /api/echo/status per server URL per page load, shared by the
// mount-time probe and the footer's status/version: the map holds the in-flight
// promise (a failed one is dropped, so a later switch back to that server retries).
const statusRequests = new Map()
function fetchStatus(url) {
  if (!statusRequests.has(url)) {
    const p = getServerStatus(url).catch(e => { statusRequests.delete(url); throw e })
    statusRequests.set(url, p)
  }
  return statusRequests.get(url)
}
/** Test hook: forget every cached status request. */
export function resetStatusRequests() { statusRequests.clear() }

export function ServerProvider({ children }) {
  const [server, setServerState] = useState(() => normalizeUrl(localStorage.getItem(STORAGE_KEY)) || DEFAULT_SERVER)
  const [probing, setProbing] = useState(false)
  // 'loading' | 'online' | 'offline' plus the backend version, for the footer.
  const [status, setStatus] = useState('loading')
  const [version, setVersion] = useState('')

  // v0.37.6 — one probe per page load: StrictMode (dev) mounts twice, and the first
  // run's request cannot be recalled, so the second run just lets it finish. `mounted`
  // is what a real unmount flips, so a late answer never touches state.
  const probeStarted = useRef(false)
  const mounted = useRef(false)

  // On mount: when no server is stored yet, auto-detect the first available one.
  useEffect(() => {
    mounted.current = true
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored || probeStarted.current) {
      // Already have a server preference, or the probe is already running — keep it
      return () => { mounted.current = false }
    }
    probeStarted.current = true
    setProbing(true)

    ;(async () => {
      for (const srv of SERVERS) {
        if (!mounted.current) break
        // The same request the status effect below makes for the current server.
        const ok = await fetchStatus(srv.url).then(() => true, () => false)
        if (ok && mounted.current) {
          setServerState(srv.url)
          localStorage.setItem(STORAGE_KEY, srv.url)
          break
        }
      }
      if (mounted.current) setProbing(false)
    })()

    return () => { mounted.current = false }
  }, [])

  // Status + version of the current server (was in Footer): joins the probe's request
  // for the same URL instead of firing its own.
  useEffect(() => {
    let active = true
    setStatus('loading')
    setVersion('')
    fetchStatus(server)
      .then(data => {
        if (!active) return
        setStatus('online')
        setVersion(data?.properties?.version || '')
      })
      .catch(() => { if (active) setStatus('offline') })
    return () => { active = false }
  }, [server])

  const changeServer = useCallback((url) => {
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
    <ServerContext.Provider value={{ server, servers: SERVERS, probing, status, version, changeServer }}>
      <div key={server}>
        {children}
      </div>
    </ServerContext.Provider>
  )
}

export function useServer() {
  return useContext(ServerContext)
}
