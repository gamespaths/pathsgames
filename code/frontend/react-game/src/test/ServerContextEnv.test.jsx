import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
import axios from 'axios'

const STORAGE_KEY = 'pg_game_server'

/**
 * The server list is read from the environment ONCE, at module load, so each shape the
 * .env can take needs its own fresh import of the module.
 */
async function loadWith(env) {
  vi.resetModules()
  const previous = { ...import.meta.env }
  delete import.meta.env.VITE_DEFAULT_SERVERS
  delete import.meta.env.VITE_API_URL
  Object.assign(import.meta.env, env)
  const mod = await import('../context/ServerContext')
  Object.assign(import.meta.env, previous)
  return mod
}

function Probe({ useServer }) {
  const { server, servers, probing } = useServer()
  return (
    <div>
      <span data-testid="server">{server}</span>
      <span data-testid="count">{servers.length}</span>
      <span data-testid="probing">{probing ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('ServerContext — the server list the environment names', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    axios.get.mockResolvedValue({ data: {} })
  })

  afterEach(() => localStorage.clear())

  it('falls back to VITE_API_URL when no server list is configured', async () => {
    const { ServerProvider, useServer } = await loadWith({ VITE_API_URL: 'http://api.example/' })
    render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    expect(screen.getByTestId('count')).toHaveTextContent('1')
    // The trailing slash is stripped: every request appends its own path.
    await waitFor(() => expect(screen.getByTestId('server')).toHaveTextContent('http://api.example'))
  })

  it('falls back to localhost when the environment names nothing at all', async () => {
    const { ServerProvider, useServer } = await loadWith({})
    render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    await waitFor(() => expect(screen.getByTestId('server')).toHaveTextContent('http://localhost:8042'))
  })

  it('falls back when the configured list is empty', async () => {
    const { ServerProvider, useServer } = await loadWith({
      VITE_DEFAULT_SERVERS: '[]', VITE_API_URL: 'http://api.example',
    })
    render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('falls back when the configured list is not valid JSON', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ServerProvider, useServer } = await loadWith({
      VITE_DEFAULT_SERVERS: '{not json', VITE_API_URL: 'http://api.example',
    })
    render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('a stored preference is kept and nothing is probed', async () => {
    localStorage.setItem(STORAGE_KEY, 'http://stored.example')
    const { ServerProvider, useServer } = await loadWith({ VITE_API_URL: 'http://api.example' })
    render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    expect(screen.getByTestId('server')).toHaveTextContent('http://stored.example')
    expect(screen.getByTestId('probing')).toHaveTextContent('no')
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('unmounting mid-probe leaves the stored preference untouched', async () => {
    let resolve
    axios.get.mockImplementation(() => new Promise(r => { resolve = r }))
    const { ServerProvider, useServer } = await loadWith({
      VITE_DEFAULT_SERVERS: JSON.stringify([
        { label: 'A', url: 'http://a.example' }, { label: 'B', url: 'http://b.example' },
      ]),
    })
    const { unmount } = render(<ServerProvider><Probe useServer={useServer} /></ServerProvider>)

    unmount()
    resolve({ data: {} })
    await Promise.resolve()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
