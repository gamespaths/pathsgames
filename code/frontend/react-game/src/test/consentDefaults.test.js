import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// v0.41.0 — Consent Mode defaults moved from an inline <script> to public/consent-defaults.js (CSP).
const ROOT = resolve(__dirname, '../..')
const script = readFileSync(resolve(ROOT, 'public/consent-defaults.js'), 'utf8')
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8')

describe('public/consent-defaults.js', () => {
  beforeEach(() => {
    delete window.dataLayer
    delete window.gtag
  })

  it('defines gtag and pushes the denied-by-default consent', () => {
    // Same global scope as a classic <script>: indirect eval.
    (0, eval)(script)
    expect(typeof window.gtag).toBe('function')
    expect(window.dataLayer).toHaveLength(1)
    const [cmd, kind, defaults] = Array.from(window.dataLayer[0])
    expect([cmd, kind]).toEqual(['consent', 'default'])
    expect(defaults).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500,
    })
  })

  it('keeps a dataLayer that already exists', () => {
    window.dataLayer = [{ event: 'early' }]
    ;(0, eval)(script)
    expect(window.dataLayer).toHaveLength(2)
    expect(window.dataLayer[0]).toEqual({ event: 'early' })
  })

  it('is loaded by index.html before the app module, and no inline script is left', () => {
    const external = html.indexOf('<script src="/consent-defaults.js"></script>')
    expect(external).toBeGreaterThan(-1)
    expect(external).toBeLessThan(html.indexOf('/src/main.jsx'))
    expect(html).not.toMatch(/<script>/)
  })
})
