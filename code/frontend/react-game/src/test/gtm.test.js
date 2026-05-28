import { describe, it, expect, beforeEach } from 'vitest'
import { loadGtm } from '../consent/gtm'

const GTM_SRC = 'script[src*="googletagmanager.com/gtm.js"]'

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  // loadGtm inserts before the first existing <script>, so one must be present.
  document.body.appendChild(document.createElement('script'))
  delete window.__pgGtmLoaded
  window.dataLayer = []
})

describe('loadGtm', () => {
  it('does nothing without a container id', () => {
    loadGtm()
    expect(document.querySelector(GTM_SRC)).toBeNull()
  })

  it('injects the GTM container script with the given id', () => {
    loadGtm('GTM-TEST123')
    const el = document.querySelector(GTM_SRC)
    expect(el).not.toBeNull()
    expect(el.src).toContain('id=GTM-TEST123')
    expect(window.dataLayer.some((e) => e && e.event === 'gtm.js')).toBe(true)
  })

  it('is idempotent (loads the container at most once)', () => {
    loadGtm('GTM-TEST123')
    loadGtm('GTM-TEST123')
    expect(document.querySelectorAll(GTM_SRC).length).toBe(1)
  })
})
