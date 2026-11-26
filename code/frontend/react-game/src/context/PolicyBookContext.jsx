import { createContext, useContext, useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { readPolicyDeepLink, clearPolicyDeepLink } from '@/utils/policyDeepLink'

/**
 * PolicyBookContext — the open policy chapter ('privacy' | 'terms' | 'cookies' | 'credits' | 'roadmap') or null.
 * v1.13.0 — the current page's Book shows it (PolicyChapter); opening stores the scroll, closing restores it.
 */
const PolicyBookContext = createContext(null)

export const POLICY_KINDS = ['privacy', 'terms', 'cookies', 'credits', 'roadmap']

/** The document scroll, 0 when unknown. */
function currentScrollY() {
  return typeof window === 'undefined' ? 0 : (window.scrollY ?? window.pageYOffset ?? 0)
}

/** Scrolls the document; guarded, since jsdom has no real scroll. */
function scrollWindowTo(y) {
  try {
    if (typeof window?.scrollTo === 'function') window.scrollTo(0, y)
  } catch {
    // no scrolling available: nothing to restore
  }
}

export function PolicyBookProvider({ children }) {
  // Step 42 — `?policy=` opens its chapter on load; closing any chapter drops the parameter.
  const [policyBook, setPolicyBook] = useState(() => readPolicyDeepLink())
  // Step 15 — the shown pathname the chapter belongs to (null: any, the deep link until a page adopts it).
  const [openedOn, setOpenedOn] = useState(null)
  const openRef = useRef(policyBook)
  const pathRef = useRef(null)
  const savedScroll = useRef(null)
  const pendingRestore = useRef(null)

  const openPolicyBook = useCallback(kind => {
    const next = POLICY_KINDS.includes(kind) ? kind : null
    // A chapter opened from another one (Devlog → credits) keeps the first position.
    if (next && !openRef.current) {
      savedScroll.current = currentScrollY()
      scrollWindowTo(0)
      setOpenedOn(pathRef.current)
    }
    if (!next) setOpenedOn(null)
    openRef.current = next
    setPolicyBook(next)
  }, [])

  // Step 15 — the routes tell the shown pathname; `adopt` ties an open chapter to it (deep link, redirect).
  const notePath = useCallback((pathname, adopt = false) => {
    pathRef.current = pathname
    if (adopt && openRef.current) setOpenedOn(pathname)
  }, [])

  // `{ restoreScroll: false }` (a route change) closes without going back to the old position.
  const closePolicyBook = useCallback(options => {
    const restore = Boolean(openRef.current) && savedScroll.current !== null && options?.restoreScroll !== false
    pendingRestore.current = restore ? savedScroll.current : null
    savedScroll.current = null
    openRef.current = null
    setOpenedOn(null)
    setPolicyBook(null)
    clearPolicyDeepLink()
  }, [])

  // After the page's own content is back: a scroll into view queued by the same click still wins.
  useLayoutEffect(() => {
    if (policyBook || pendingRestore.current === null) return
    const y = pendingRestore.current
    pendingRestore.current = null
    scrollWindowTo(y)
  }, [policyBook])

  const value = useMemo(() => ({ policyBook, openedOn, openPolicyBook, closePolicyBook, notePath }),
    [policyBook, openedOn, openPolicyBook, closePolicyBook, notePath])
  return <PolicyBookContext.Provider value={value}>{children}</PolicyBookContext.Provider>
}

// Outside a provider (isolated renders) the hook is inert: nothing opens, nothing breaks.
const NOOP = { policyBook: null, openedOn: null, openPolicyBook: () => {}, closePolicyBook: () => {}, notePath: () => {} }

export function usePolicyBook() {
  return useContext(PolicyBookContext) ?? NOOP
}
