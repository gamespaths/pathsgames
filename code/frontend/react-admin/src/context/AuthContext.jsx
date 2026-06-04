import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'pg_admin_token'
const SERVER_KEY = 'pg_admin_server'

const normalizeUrl = (url) => (typeof url === 'string' && url.endsWith('/') ? url.slice(0, -1) : url)

const getServers = () => {
  const envServers = import.meta.env.VITE_DEFAULT_SERVERS
  if (envServers) {
    try {
      return JSON.parse(envServers).map(s => ({ ...s, url: normalizeUrl(s.url) }))
    } catch (e) {
      console.error('Error parsing VITE_DEFAULT_SERVERS from .env', e)
    }
  }
  return [
    { label: 'Local Admin (8044)', url: 'http://localhost:8044' },
    { label: 'Local Player (8042)', url: 'http://localhost:8042' },
  ]
}

const DEFAULT_SERVERS = getServers()

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [server, setServerState] = useState(() => normalizeUrl(localStorage.getItem(SERVER_KEY)) || DEFAULT_SERVERS[0].url)

  const login = useCallback((rawJwt) => {
    // Validate the token as three base64url segments and rebuild it from the
    // matched groups, so only sanitized data is written to browser storage —
    // prevents storage poisoning (jssecurity:S8475), mirroring changeServer().
    if (typeof rawJwt !== 'string') return
    const match = rawJwt.trim().match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/)
    if (!match) return
    const safeToken = `${match[1]}.${match[2]}.${match[3]}`
    setTokenState(safeToken)
    localStorage.setItem(STORAGE_KEY, safeToken)
  }, [])

  const logout = useCallback(() => {
    setTokenState('')
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const changeServer = useCallback((url) => {
    try {
      const parsedUrl = new URL(url)
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        // Reconstruct the URL from parsed components to sanitize it and avoid storage poisoning
        const sanitized = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`
        const finalUrl = sanitized.endsWith('/') ? sanitized.slice(0, -1) : sanitized

        setServerState(finalUrl)
        localStorage.setItem(SERVER_KEY, finalUrl)
      } else {
        console.warn('Blocked attempt to set insecure server URL:', url)
      }
    } catch (e) {
      console.warn('Blocked attempt to set invalid server URL:', url)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ token, server, servers: DEFAULT_SERVERS, login, logout, changeServer, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
