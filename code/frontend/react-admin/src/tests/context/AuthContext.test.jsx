import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext'

// Helper component that exposes context values
function Probe() {
  const ctx = useAuth()
  return (
    <div>
      <span data-testid="token">{ctx.token}</span>
      <span data-testid="server">{ctx.server}</span>
      <span data-testid="loggedIn">{String(ctx.isLoggedIn)}</span>
      <button onClick={() => ctx.login('eyJtest')}>login</button>
      <button onClick={ctx.logout}>logout</button>
      <button onClick={() => ctx.changeServer('http://localhost:9000')}>changeServer</button>
      <button onClick={() => ctx.changeServer('javascript:alert(1)')}>poisonServer</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('starts with empty token and isLoggedIn=false', () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('token').textContent).toBe('')
    expect(screen.getByTestId('loggedIn').textContent).toBe('false')
  })

  it('login() sets token and isLoggedIn=true', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await userEvent.click(screen.getByText('login'))
    expect(screen.getByTestId('token').textContent).toBe('eyJtest')
    expect(screen.getByTestId('loggedIn').textContent).toBe('true')
    expect(localStorage.getItem('pg_admin_token')).toBe('eyJtest')
  })

  it('logout() clears token', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await userEvent.click(screen.getByText('login'))
    await userEvent.click(screen.getByText('logout'))
    expect(screen.getByTestId('token').textContent).toBe('')
    expect(screen.getByTestId('loggedIn').textContent).toBe('false')
    expect(localStorage.getItem('pg_admin_token')).toBeNull()
  })

  it('persists token from localStorage on mount', () => {
    localStorage.setItem('pg_admin_token', 'eyJpersisted')
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('token').textContent).toBe('eyJpersisted')
    expect(screen.getByTestId('loggedIn').textContent).toBe('true')
  })

  it('changeServer() updates server state and localStorage', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await userEvent.click(screen.getByText('changeServer'))
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:9000')
    expect(localStorage.getItem('pg_admin_server')).toBe('http://localhost:9000')
  })

  it('changeServer() ignores invalid URLs', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    const initialServer = screen.getByTestId('server').textContent
    await userEvent.click(screen.getByText('poisonServer'))
    // Should remain initial
    expect(screen.getByTestId('server').textContent).toBe(initialServer)
    expect(localStorage.getItem('pg_admin_server')).toBeNull() // default was set in state but not yet in localStorage in this test flow if it started empty
  })

  it('defaults server to first preset', () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:8042')
  })
})
