import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'pg_admin_token'
const SERVER_KEY  = 'pg_admin_server'

const DEFAULT_SERVERS = [
  { label: 'Local (8042)',  url: 'http://localhost:8042' },
  { label: 'Local (8080)',  url: 'http://localhost:8080' },
  { label: 'AWS',  url: ' https://4zepmifep6.execute-api.us-east-2.amazonaws.com/dev/' },
]

export function AuthProvider({ children }) {
  const [token,  setTokenState]  = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [server, setServerState] = useState(() => localStorage.getItem(SERVER_KEY) || DEFAULT_SERVERS[0].url)

  const login = useCallback((jwt) => {
    setTokenState(jwt)
    localStorage.setItem(STORAGE_KEY, jwt)
  }, [])

  const logout = useCallback(() => {
    setTokenState('')
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const changeServer = useCallback((url) => {
    try {
      const parsedUrl = new URL(url)
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        setServerState(url)
        localStorage.setItem(SERVER_KEY, url)
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
