import { createContext, useContext, useEffect, useMemo, useRef } from 'react'

/**
 * HomeButtonContext — v1.13.0: the home tab and the navbar brand run the mounted page's handler, else go home.
 * The handler is held in a ref: registering it causes no re-render.
 */
const HomeButtonContext = createContext(null)

export function HomeButtonProvider({ children }) {
  const handlerRef = useRef(null)
  const value = useMemo(() => ({
    register(fn) {
      handlerRef.current = fn
      return () => { if (handlerRef.current === fn) handlerRef.current = null }
    },
    hasHandler: () => typeof handlerRef.current === 'function',
    run() {
      if (typeof handlerRef.current !== 'function') return false
      handlerRef.current()
      return true
    },
  }), [])
  return <HomeButtonContext.Provider value={value}>{children}</HomeButtonContext.Provider>
}

// Outside a provider (isolated renders) nothing is registered: the callers go home.
const NOOP = { register: () => () => {}, hasHandler: () => false, run: () => false }

/** Registers `fn` as the home override while the caller is mounted; a falsy `fn` registers nothing. */
export function useHomeButtonHandler(fn) {
  const ctx = useContext(HomeButtonContext) ?? NOOP
  const fnRef = useRef(fn)
  fnRef.current = fn
  const active = typeof fn === 'function'
  useEffect(() => {
    if (!active) return undefined
    return ctx.register(() => fnRef.current?.())
  }, [ctx, active])
}

/** `{ run, hasHandler }`: `run()` answers false when no handler is registered (the caller goes home). */
export function useHomeButton() {
  return useContext(HomeButtonContext) ?? NOOP
}
