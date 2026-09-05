import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const SERVER_KEY = 'pg_admin_server'

/**
 * The admin server list is read from the environment ONCE, at module load, so each
 * shape the .env can take needs its own fresh import of the module.
 */
async function loadWith(env) {
  vi.resetModules()
  const previous = { ...import.meta.env }
  delete import.meta.env.VITE_DEFAULT_SERVERS
  Object.assign(import.meta.env, env)
  const mod = await import('../../context/AuthContext')
  Object.assign(import.meta.env, previous)
  return mod
}

function Probe({ useAuth }) {
  const ctx = useAuth()
  return (
    <div>
      <span data-testid="server">{ctx.server}</span>
      <span data-testid="count">{ctx.servers?.length ?? 0}</span>
      <button onClick={() => ctx.login(null)}>login-null</button>
      <button onClick={() => ctx.changeServer('http://localhost:9000/')}>trailing-slash</button>
    </div>
  )
}

describe('AuthContext — the server list the environment names', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('uses the configured list, with every trailing slash stripped', async () => {
    const { AuthProvider, useAuth } = await loadWith({
      VITE_DEFAULT_SERVERS: JSON.stringify([{ label: 'Prod', url: 'https://admin.example/' }]),
    })
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    expect(screen.getByTestId('server')).toHaveTextContent('https://admin.example')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('falls back to the two local servers when the list is not valid JSON', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { AuthProvider, useAuth } = await loadWith({ VITE_DEFAULT_SERVERS: '{not json' })
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    expect(screen.getByTestId('count')).toHaveTextContent('2')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('falls back to the two local servers when nothing is configured', async () => {
    const { AuthProvider, useAuth } = await loadWith({})
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    expect(screen.getByTestId('server')).toHaveTextContent('http://localhost:8044')
  })

  it('a stored server keeps its normalized form', async () => {
    localStorage.setItem(SERVER_KEY, 'http://stored.example/')
    const { AuthProvider, useAuth } = await loadWith({})
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    expect(screen.getByTestId('server')).toHaveTextContent('http://stored.example')
  })

  it('a login with something that is not a string is ignored', async () => {
    const { AuthProvider, useAuth } = await loadWith({})
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    await userEvent.click(screen.getByText('login-null'))

    expect(localStorage.getItem('pg_admin_token')).toBeNull()
  })

  it('a server URL with a trailing slash is stored without it', async () => {
    const { AuthProvider, useAuth } = await loadWith({})
    render(<AuthProvider><Probe useAuth={useAuth} /></AuthProvider>)

    await userEvent.click(screen.getByText('trailing-slash'))

    expect(localStorage.getItem(SERVER_KEY)).toBe('http://localhost:9000')
  })
})
