import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HomeButtonProvider, useHomeButton } from '../context/HomeButtonContext'

const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
vi.mock('@/features/guest-user/PlayerBook', () => ({ default: () => <div data-testid="player-book" /> }))
const reload = vi.hoisted(() => vi.fn())
vi.mock('@/auth/reloadHome', () => ({ reloadHome: reload }))

import PlayerPage from '../pages/PlayerPage'

/** Stands for the book's home tab: the registered handler, else home. */
function HomeTab() {
  const home = useHomeButton()
  return <button onClick={() => home.run()} data-testid="home-tab">home</button>
}

function renderPage() {
  return render(
    <HomeButtonProvider>
      <MemoryRouter initialEntries={['/player']}>
        <HomeTab />
        <Routes>
          <Route path="/" element={<div data-testid="home-page" />} />
          <Route path="/player" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    </HomeButtonProvider>,
  )
}

describe('PlayerPage (/player, v1.13.0)', () => {
  beforeEach(() => {
    reload.mockClear()
    ctx.value = { setMatches: vi.fn(), accountDeleted: false }
  })

  it('renders the player book', () => {
    renderPage()
    expect(screen.getByTestId('player-book')).toBeInTheDocument()
  })

  it('the home tab runs closePlayerPage: home, and the preloaded matches cleared on unmount', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('home-tab'))
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(ctx.value.setMatches).toHaveBeenCalledWith(null)
    expect(reload).not.toHaveBeenCalled()
  })

  it('after an account deletion the home tab reloads the home', () => {
    ctx.value = { setMatches: vi.fn(), accountDeleted: true }
    renderPage()
    fireEvent.click(screen.getByTestId('home-tab'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('leaves no handler behind once unmounted', () => {
    const { unmount } = renderPage()
    unmount()
    expect(ctx.value.setMatches).toHaveBeenCalledWith(null)
  })

  it('outside a guest provider it still renders and unmounts cleanly', () => {
    ctx.value = undefined
    const { unmount } = renderPage()
    expect(screen.getByTestId('player-book')).toBeInTheDocument()
    expect(() => unmount()).not.toThrow()
  })
})
