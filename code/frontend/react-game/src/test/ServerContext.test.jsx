import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import axios from 'axios'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))

const STORAGE_KEY = 'pg_game_server'
// ServerContext reads VITE_DEFAULT_SERVERS once at module load, so the env must
// be stubbed BEFORE the module is imported. vi.hoisted runs above all imports,
// making the test independent of any .env file (e.g. the gitignored .env.test,
// which is absent in CI).
const DEFAULT_SERVER = 'https://api-test-server2.paths.games'
vi.hoisted(() => {
  import.meta.env.VITE_DEFAULT_SERVERS = JSON.stringify([
    { label: 'Server test 2', url: 'https://api-test-server2.paths.games' },
    { label: 'Server test', url: 'https://api-test.paths.games' },
  ])
})

const { ServerProvider, useServer, resetStatusRequests } = await import('../context/ServerContext')

function Probe() {
  const { server, servers, probing, status, version, changeServer } = useServer()
  return (
    <div>
      <span data-testid="server">{server}</span>
      <span data-testid="probing">{probing ? 'yes' : 'no'}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="version">{version}</span>
      <span data-testid="count">{servers.length}</span>
      <button onClick={() => changeServer('http://localhost:9000/')}>to-real</button>
      <button onClick={() => changeServer('ftp://nope')}>bad-proto</button>
      <button onClick={() => changeServer('not a url')}>invalid</button>
    </div>
  )
}

describe('ServerContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    resetStatusRequests()
  })
  afterEach(() => localStorage.clear())

  it('keeps a stored server and does not probe: one status call, for that server', async () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    axios.get.mockResolvedValue({ data: { properties: { version: '0.37.6' } } })
    render(<ServerProvider><Probe /></ServerProvider>)
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:8042')
    expect(screen.getByTestId('probing').textContent).toBe('no')
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('online'))
    expect(screen.getByTestId('version').textContent).toBe('0.37.6')
    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(axios.get.mock.calls[0][0]).toBe('http://localhost:8042/api/echo/status')
  })

  it('a stored server that does not answer is marked offline (v0.37.6)', async () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    axios.get.mockRejectedValue(new Error('down'))
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('offline'))
    expect(screen.getByTestId('version').textContent).toBe('')
  })

  it('starts on the default server, then probes and adopts the first reachable one', async () => {
    axios.get.mockResolvedValue({ data: {} })
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('probing').textContent).toBe('no'))
    const adopted = screen.getByTestId('server').textContent
    expect(adopted).toBe(DEFAULT_SERVER)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(adopted)
    // The probe and the footer status share ONE request for the same server.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('online'))
    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  it('probes the next server when the first is down, then reports that one online', async () => {
    axios.get.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: {} })
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(screen.getByTestId('server').textContent).toBe('https://api-test.paths.games'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('online'))
    // default server (failed, dropped from the cache) + second server: 2 requests in all
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('changeServer to a server whose earlier probe failed retries it (v0.37.6)', async () => {
    axios.get.mockRejectedValue(new Error('down'))
    localStorage.setItem(STORAGE_KEY, 'https://api-test.paths.games')
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('offline'))
    axios.get.mockResolvedValue({ data: {} })
    fireEvent.click(screen.getByText('to-real'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('online'))
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('probes once under StrictMode double mount and still adopts the answer (v0.37.6)', async () => {
    const { StrictMode } = await import('react')
    let resolveProbe
    axios.get.mockReturnValue(new Promise(res => { resolveProbe = res }))
    render(<StrictMode><ServerProvider><Probe /></ServerProvider></StrictMode>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    expect(axios.get).toHaveBeenCalledTimes(1)
    resolveProbe({ data: {} })
    await waitFor(() => expect(screen.getByTestId('probing').textContent).toBe('no'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(DEFAULT_SERVER)
    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  it('stays on the default server when no server responds', async () => {
    axios.get.mockRejectedValue(new Error('down'))
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(screen.getByTestId('probing').textContent).toBe('no'))
    expect(screen.getByTestId('server').textContent).toBe(DEFAULT_SERVER)
  })

  it('changeServer normalizes a real URL (strips trailing slash) and stores it', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    render(<ServerProvider><Probe /></ServerProvider>)
    fireEvent.click(screen.getByText('to-real'))
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:9000')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('http://localhost:9000')
  })

  it('changeServer ignores non-http protocols and invalid URLs', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    render(<ServerProvider><Probe /></ServerProvider>)
    fireEvent.click(screen.getByText('bad-proto'))
    fireEvent.click(screen.getByText('invalid'))
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:8042')
  })

  it('exposes the configured servers', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    render(<ServerProvider><Probe /></ServerProvider>)
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(1)
  })
})
