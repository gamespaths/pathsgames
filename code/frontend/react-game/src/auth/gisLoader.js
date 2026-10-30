/**
 * v1.2.0 Google Identity Services, loaded only when the player clicks "Sign in" (never at boot),
 * and the login nonce kept in sessionStorage until the backend checks it.
 */
export const GIS_SRC = 'https://accounts.google.com/gsi/client'
export const NONCE_KEY = 'pathsgames.googleNonce'

let loading = null

/** Resolves with `window.google.accounts.id`, injecting the script once. */
export function loadGis(doc = document) {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id)
  }
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else { loading = null; reject(new Error('gis-unavailable')) }
    }
    script.onerror = () => { loading = null; reject(new Error('gis-unavailable')) }
    doc.head.appendChild(script)
  })
  return loading
}

/** Test seam: forget the in-flight load. */
export function resetGisLoader() {
  loading = null
}

/** A fresh random nonce, stored for the login that follows. */
export function newNonce() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const nonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  try { sessionStorage.setItem(NONCE_KEY, nonce) } catch { /* private mode: the value is still returned */ }
  return nonce
}

/** The nonce of the pending login (and it is consumed). */
export function takeNonce(fallback = null) {
  try {
    const nonce = sessionStorage.getItem(NONCE_KEY)
    sessionStorage.removeItem(NONCE_KEY)
    return nonce ?? fallback
  } catch {
    return fallback
  }
}
