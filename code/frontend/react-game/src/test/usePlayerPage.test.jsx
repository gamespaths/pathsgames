import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const reload = vi.hoisted(() => vi.fn())
vi.mock('@/auth/reloadHome', () => ({ reloadHome: reload }))

import usePlayerPage from '@/features/guest-user/usePlayerPage'

function hook(initial = '/') {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  return renderHook(() => ({ ...usePlayerPage(), location: useLocation() }), { wrapper })
}

describe('usePlayerPage (v1.13.0)', () => {
  beforeEach(() => {
    reload.mockClear()
    ctx.value = { setMatches: vi.fn(), accountDeleted: false }
  })

  it('openPlayerPage(list) stores the preloaded matches, then goes to /player', () => {
    const { result } = hook('/')
    const list = [{ uuid: 'm1' }]
    act(() => result.current.openPlayerPage(list))
    expect(ctx.value.setMatches).toHaveBeenCalledWith(list)
    expect(result.current.location.pathname).toBe('/player')
  })

  it('openPlayerPage() (navbar) leaves the matches to be fetched', () => {
    const { result } = hook('/play/s1')
    act(() => result.current.openPlayerPage())
    expect(ctx.value.setMatches).toHaveBeenCalledWith(null)
    expect(result.current.location.pathname).toBe('/player')
  })

  it('closePlayerPage goes to the Home', () => {
    const { result } = hook('/player')
    act(() => result.current.closePlayerPage())
    expect(result.current.location.pathname).toBe('/')
    expect(reload).not.toHaveBeenCalled()
  })

  it('after an account deletion closePlayerPage reloads the home instead', () => {
    ctx.value = { setMatches: vi.fn(), accountDeleted: true }
    const { result } = hook('/player')
    act(() => result.current.closePlayerPage())
    expect(reload).toHaveBeenCalledOnce()
    expect(result.current.location.pathname).toBe('/player')
  })

  it('outside a guest provider it still navigates', () => {
    ctx.value = undefined
    const { result } = hook('/')
    act(() => result.current.openPlayerPage([]))
    expect(result.current.location.pathname).toBe('/player')
  })
})
