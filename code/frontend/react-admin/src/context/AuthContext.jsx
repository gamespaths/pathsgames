import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'pg_admin_token'
const SERVER_KEY = 'pg_admin_server'

const getServers = () => {
  const envServers = import.meta.env.VITE_DEFAULT_SERVERS
  if (envServers) {
    try {
      return JSON.parse(envServers)
    } catch (e) {
      console.error('Error parsing VITE_DEFAULT_SERVERS from .env', e)
    }
  }
  return [
    { label: 'Local (8042)', url: 'http://localhost:8042' },
    { label: 'Local (8080)', url: 'http://localhost:8080' },
  ]
}

const DEFAULT_SERVERS = getServers()

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [server, setServerState] = useState(() => localStorage.getItem(SERVER_KEY) || DEFAULT_SERVERS[0].url)

  const login = useCallback((jwt) => {
    // Sanitize token: ensure it's a string and remove any characters that shouldn't be in a JWT/token
    // to prevent browser storage poisoning.
    if (typeof jwt === 'string') {
      const sanitized = jwt.replace(/[^\w\.\-\_\/]/g, '').trim()
      if (sanitized) {
        setTokenState(sanitized)
        localStorage.setItem(STORAGE_KEY, sanitized)
      }
    }
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
