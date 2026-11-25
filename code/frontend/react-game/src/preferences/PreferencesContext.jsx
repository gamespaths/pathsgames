import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimationProvider, useReducedMotion } from '@/context/AnimationContext'
import { readAnimationEnv } from '@/constants/animations'
import {
  PREFERENCES_KEY, clearDevicePreferences, devicePreferences, setDevicePreferences,
} from '@/auth/devicePreferences'
import { columnsLayout, effectiveSettings, withPreference } from './settings'

/* PreferencesContext — step 16: the display choices of this device (localStorage), applied live: data attributes on
   <html> (theme, size, columns; step 14 writes data-pg-reduced) and the animation overrides of AnimationProvider. */

const PreferencesContext = createContext(null)
const NOOP = () => {}

/** Writes `data-pg-theme`, `data-pg-size` and `data-pg-cols` (absent when auto) on the root: no inline style. */
export function applyPreferenceAttributes(effective, root = globalThis.document?.documentElement) {
  if (!root || !effective) return
  root.setAttribute('data-pg-theme', effective.theme)
  root.setAttribute('data-pg-size', effective.size)
  if (effective.columns === 'auto') root.removeAttribute('data-pg-cols')
  else root.setAttribute('data-pg-cols', String(effective.columns))
}

/** The columns layout, followed on resize and rotation. */
function useColumnsLayout() {
  const [layout, setLayout] = useState(() => columnsLayout())
  useEffect(() => {
    const onResize = () => setLayout(columnsLayout())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return layout
}

export function PreferencesProvider({ children, env = undefined }) {
  const [prefs, setPrefs] = useState(() => devicePreferences())
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const reducedMotion = useReducedMotion()
  const layout = useColumnsLayout()
  const animDefaults = useMemo(() => readAnimationEnv(env), [env])
  const effective = useMemo(() => effectiveSettings({ prefs, animDefaults, reducedMotion, layout }),
    [prefs, animDefaults, reducedMotion, layout])

  useLayoutEffect(() => { applyPreferenceAttributes(effective) }, [effective])

  // Another tab changed (or cleared) the choices: this one follows.
  useEffect(() => {
    const onStorage = e => { if (e.key === PREFERENCES_KEY || e.key === null) setPrefs(devicePreferences()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Written at once (no Save button); in private mode the choice lasts for this page only.
  const setPreference = useCallback((path, value) => {
    const next = withPreference(prefsRef.current, path, value)
    prefsRef.current = next
    setDevicePreferences(next)
    setPrefs(next)
  }, [])

  const reset = useCallback(() => {
    prefsRef.current = {}
    clearDevicePreferences()
    setPrefs({})
  }, [])

  const value = useMemo(() => ({ prefs, effective, animDefaults, layout, setPreference, reset }),
    [prefs, effective, animDefaults, layout, setPreference, reset])
  return (
    <PreferencesContext.Provider value={value}>
      <AnimationProvider env={env} overrides={prefs.anim ?? null} reducedMotion={reducedMotion}>
        {children}
      </AnimationProvider>
    </PreferencesContext.Provider>
  )
}

/** `{ prefs, effective, animDefaults, layout, setPreference, reset }`; without a provider the defaults, read-only. */
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (ctx) return ctx
  const layout = columnsLayout()
  const animDefaults = readAnimationEnv()
  return { prefs: {}, effective: effectiveSettings({ animDefaults, layout }), animDefaults, layout,
    setPreference: NOOP, reset: NOOP }
}
