import { describe, it, expect, vi, afterEach } from 'vitest'
import { reloadHome } from '@/auth/reloadHome'

describe('reloadHome (v1.2.0)', () => {
  const original = window.location
  afterEach(() => { Object.defineProperty(window, 'location', { configurable: true, value: original }) })

  it('loads the home of the app base', () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } })
    reloadHome()
    expect(assign).toHaveBeenCalledWith(import.meta.env.BASE_URL)
  })
})
