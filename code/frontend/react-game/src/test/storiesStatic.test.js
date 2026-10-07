import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// v0.37.6 — the static catalog file (/data/stories-{lang}.json) is read with fetch on
// the site origin; only the API fallback goes through fetchJson.
vi.mock('../api/client', () => ({
  fetchJson: vi.fn(() => Promise.resolve([{ uuid: 'from-api' }])),
}))

import { fetchJson } from '../api/client'
import { getStoriesStatic, getStoriesCatalog, getStoryDetail, getStory, staticCatalogUrl, clearStoryCache } from '../api/stories'

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
    clearStoryCache()
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

  // ── v0.37.6 cache ──────────────────────────────────────────────────────────

  it('getStoriesCatalog is memoised per language for the page load', async () => {
    fetch.mockResolvedValue(response({ body: [{ uuid: 'a' }] }))
    await Promise.all([getStoriesCatalog('en'), getStoriesCatalog('en')])
    await getStoriesCatalog('en')
    expect(fetch).toHaveBeenCalledTimes(1)
    await getStoriesCatalog('it')
    expect(fetch).toHaveBeenCalledTimes(2)
    // getStory reads the same memo: no third request
    expect((await getStory('a', 'en')).uuid).toBe('a')
    expect(await getStory('zzz', 'en')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('a failed catalog load is not memoised: the next call retries', async () => {
    fetch.mockResolvedValue(response({ ok: false, status: 500 }))
    fetchJson.mockRejectedValueOnce(new Error('Network Error'))
    await expect(getStoriesCatalog('en')).rejects.toThrow('Network Error')
    fetchJson.mockResolvedValueOnce([{ uuid: 'later' }])
    expect(await getStoriesCatalog('en')).toEqual([{ uuid: 'later' }])
  })
})

describe('api/stories — story detail session cache (v0.37.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearStoryCache()
    sessionStorage.clear()
  })

  it('two concurrent callers (StrictMode, modal + page) share one request', async () => {
    fetchJson.mockResolvedValue({ uuid: 's1', title: 'T' })
    const [a, b] = await Promise.all([getStoryDetail('s1', 'en'), getStoryDetail('s1', 'en')])
    expect(a).toEqual(b)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1?lang=en')
  })

  it('keeps the detail in sessionStorage, so a fresh page load costs no request', async () => {
    fetchJson.mockResolvedValue({ uuid: 's1', title: 'T' })
    await getStoryDetail('s1', 'it')
    expect(JSON.parse(sessionStorage.getItem('pg_story:detail:s1:it'))).toEqual({ uuid: 's1', title: 'T' })
    // simulate a reload: a fresh module (memory gone), same sessionStorage
    vi.resetModules()
    const fresh = await import('../api/stories')
    const freshClient = await import('../api/client')
    freshClient.fetchJson.mockClear()
    expect(await fresh.getStoryDetail('s1', 'it')).toEqual({ uuid: 's1', title: 'T' })
    expect(freshClient.fetchJson).not.toHaveBeenCalled()
  })

  it('caches per uuid AND language, defaulting to en', async () => {
    fetchJson.mockResolvedValue({ uuid: 's1' })
    await getStoryDetail('s1')
    await getStoryDetail('s1', 'it')
    await getStoryDetail('s2')
    expect(fetchJson).toHaveBeenCalledTimes(3)
    expect(fetchJson).toHaveBeenCalledWith('/api/stories/s1?lang=en')
  })

  it('a failed detail request is retried next time and nothing is stored', async () => {
    fetchJson.mockRejectedValueOnce(new Error('boom'))
    await expect(getStoryDetail('s1', 'en')).rejects.toThrow('boom')
    expect(sessionStorage.getItem('pg_story:detail:s1:en')).toBeNull()
    fetchJson.mockResolvedValueOnce({ uuid: 's1' })
    expect(await getStoryDetail('s1', 'en')).toEqual({ uuid: 's1' })
  })

  it('survives a sessionStorage that throws (private mode / quota) and clears its own keys only', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('nope') })
    fetchJson.mockResolvedValue({ uuid: 's1' })
    expect(await getStoryDetail('s1', 'en')).toEqual({ uuid: 's1' })
    setItem.mockRestore()
    getItem.mockRestore()

    sessionStorage.setItem('other', '1')
    sessionStorage.setItem('pg_story:detail:x:en', '{}')
    clearStoryCache()
    expect(sessionStorage.getItem('other')).toBe('1')
    expect(sessionStorage.getItem('pg_story:detail:x:en')).toBeNull()
  })
})
