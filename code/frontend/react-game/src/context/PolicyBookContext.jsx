import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { readPolicyDeepLink, clearPolicyDeepLink } from '@/utils/policyDeepLink'

/**
 * PolicyBookContext — which policy book is open ('privacy' | 'terms' | 'cookies' | 'credits'
 * | 'roadmap', Step 40), or null. The footer links and the terms (i) lens open it; PolicyBook renders it.
 */
const PolicyBookContext = createContext(null)

export const POLICY_KINDS = ['privacy', 'terms', 'cookies', 'credits', 'roadmap']

export function PolicyBookProvider({ children }) {
  // Step 42 — `?policy=` opens its book on load; closing any book drops the parameter.
  const [policyBook, setPolicyBook] = useState(() => readPolicyDeepLink())
  const openPolicyBook  = useCallback(kind => setPolicyBook(POLICY_KINDS.includes(kind) ? kind : null), [])
  const closePolicyBook = useCallback(() => { setPolicyBook(null); clearPolicyDeepLink() }, [])
  const value = useMemo(() => ({ policyBook, openPolicyBook, closePolicyBook }),
    [policyBook, openPolicyBook, closePolicyBook])
  return <PolicyBookContext.Provider value={value}>{children}</PolicyBookContext.Provider>
}

// Outside a provider (isolated renders) the hook is inert: nothing opens, nothing breaks.
const NOOP = { policyBook: null, openPolicyBook: () => {}, closePolicyBook: () => {} }

export function usePolicyBook() {
  return useContext(PolicyBookContext) ?? NOOP
}
