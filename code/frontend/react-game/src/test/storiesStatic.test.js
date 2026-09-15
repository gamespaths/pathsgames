import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// v0.37.6 — the static catalog file (/data/stories-{lang}.json) is read with fetch on
// the site origin; only the API fallback goes through fetchJson.
vi.mock('../api/client', () => ({
  fetchJson: vi.fn(() => Promise.resolve([{ uuid: 'from-api' }])),
}))

import { fetchJson } from '../api/client'
import { getStoriesStatic, getStoriesCatalog, staticCatalogUrl } from '../api/stories'

function response({ ok = true, status = 200, type = 'application/json', body = [] } = {}) {
  return {
    ok, status,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) },
    json: async () => body,
  }
}

describe('api/stories — static catalog (v0.37.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })
  afterEach(() => { delete global.fetch })

  it('builds the site-relative path per language, en by default', () => {
    expect(staticCatalogUrl('it')).toBe('/data/stories-it.json')
    expect(staticCatalogUrl()).toBe('/data/stories-en.json')
  })

  it('getStoriesStatic returns the JSON array and bypasses the HTTP cache', async () => {
    fetch.mockResolvedValue(response({ body: [{ uuid: 's1' }] }))
    expect(await getStoriesStatic('it')).toEqual([{ uuid: 's1' }])
    expect(fetch).toHaveBeenCalledWith('/data/stories-it.json', { cache: 'no-cache' })
  })

  it('getStoriesStatic rejects on a non-2xx status', async () => {
    fetch.mockResolvedValue(response({ ok: false, status: 404 }))
    await expect(getStoriesStatic('en')).rejects.toThrow('404')
  })

  it('getStoriesStatic rejects the SPA fallback (200 + text/html)', async () => {
    fetch.mockResolvedValue(response({ type: 'text/html; charset=utf-8', body: '<html/>' }))
    await expect(getStoriesStatic('en')).rejects.toThrow('not JSON')
  })

  it('getStoriesStatic rejects a JSON body that is not a list, or missing headers', async () => {
    fetch.mockResolvedValue(response({ body: { error: 'x' } }))
    await expect(getStoriesStatic('en')).rejects.toThrow('not a list')
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    await expect(getStoriesStatic('en')).rejects.toThrow('not JSON')
  })

  it('getStoriesCatalog prefers the static file and never calls the API when it is good', async () => {
    fetch.mockResolvedValue(response({ body: [{ uuid: 'static' }] }))
    expect(await getStoriesCatalog('en')).toEqual([{ uuid: 'static' }])
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('getStoriesCatalog falls back to GET /api/stories when the file is missing or broken', async () => {
    fetch.mockResolvedValue(response({ ok: false, status: 404 }))
    expect(await getStoriesCatalog('it')).toEqual([{ uuid: 'from-api' }])
    expect(fetchJson).toHaveBeenCalledWith('/api/stories?lang=it')

    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await getStoriesCatalog('en')).toEqual([{ uuid: 'from-api' }])
  })

  it('getStoriesCatalog surfaces the API error when both fail', async () => {
    fetch.mockResolvedValue(response({ ok: false, status: 500 }))
    fetchJson.mockRejectedValueOnce(new Error('Network Error'))
    await expect(getStoriesCatalog('en')).rejects.toThrow('Network Error')
  })
})
