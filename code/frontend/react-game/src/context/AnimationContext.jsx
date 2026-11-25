import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { applyAnimationTimings, resolveAnimations } from '@/constants/animations'

/**
 * Step 14 — the animation settings of the whole app: env defaults, overrides (step 16 preferences)
 * and the OS reduced motion, followed live; the timings are written on <html> at every change.
 */
export const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)'

const AnimationContext = createContext(null)
const NOOP = () => {}

function reducedMotionQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(REDUCED_MOTION_MQ) ?? null
}

/** Step 16 — the OS reduced motion, followed live (addEventListener, else the old addListener); off: not followed. */
export function useReducedMotion(active = true) {
  const [reduced, setReduced] = useState(() => active && !!reducedMotionQuery()?.matches)
  useEffect(() => {
    if (!active) return undefined
    const mq = reducedMotionQuery()
    const onChange = e => setReduced(!!e.matches)
    // Several suites mock matchMedia as a bare { matches }: nothing to follow then.
    if (typeof mq?.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    if (typeof mq?.addListener === 'function') {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
    return undefined
  }, [active])
  return reduced
}

/** Step 16: `overrides` and `reducedMotion` come from the preferences; without them the provider follows the OS itself. */
export function AnimationProvider({ children, env = undefined, overrides: given = null, reducedMotion: forced = undefined }) {
  const followed = useReducedMotion(forced === undefined)
  const reducedMotion = forced ?? followed
  const [own, setAnimationOverrides] = useState(null)
  const overrides = useMemo(() => (given || own ? { ...given, ...own } : null), [given, own])

  const settings = useMemo(() => resolveAnimations({ env, overrides, reducedMotion }), [env, overrides, reducedMotion])
  useLayoutEffect(() => { applyAnimationTimings(settings) }, [settings])

  const value = useMemo(() => ({ ...settings, setAnimationOverrides }), [settings])
  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
}

/** The single accessor of the settings; without a provider (unit tests) the env defaults. */
export function useAnimationSettings() {
  const ctx = useContext(AnimationContext)
  return ctx ?? { ...resolveAnimations(), setAnimationOverrides: NOOP }
}
