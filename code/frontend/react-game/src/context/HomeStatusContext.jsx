import { createContext, useContext, useState, useMemo } from 'react'

/**
 * v0.37.6 — HomeStatusContext: the home page's load failures, read by the Navbar
 * so it can show the error and a refresh button. `error` is null or one of
 * 'antibot' | 'matches' | 'stories'.
 */
const HomeStatusContext = createContext({ error: null, setError: () => {} })

export function HomeStatusProvider({ children }) {
  const [error, setError] = useState(null)
  const value = useMemo(() => ({ error, setError }), [error])
  return <HomeStatusContext.Provider value={value}>{children}</HomeStatusContext.Provider>
}

export function useHomeStatus() {
  return useContext(HomeStatusContext)
}
