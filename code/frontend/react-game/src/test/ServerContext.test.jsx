import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import axios from 'axios'
import { ServerProvider, useServer, MOCK_SERVER } from '../context/ServerContext'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))

const STORAGE_KEY = 'pg_game_server'

function Probe() {
  const { server, servers, probing, changeServer } = useServer()
  return (
    <div>
      <span data-testid="server">{server}</span>
      <span data-testid="probing">{probing ? 'yes' : 'no'}</span>
      <span data-testid="count">{servers.length}</span>
      <button onClick={() => changeServer(MOCK_SERVER)}>to-mock</button>
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
  })
  afterEach(() => localStorage.clear())

  it('keeps a stored real server and does not probe', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    render(<ServerProvider><Probe /></ServerProvider>)
    expect(screen.getByTestId('server').textContent).toBe('http://localhost:8042')
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('defaults to MOCK_SERVER then probes and adopts the first reachable server', async () => {
    axios.get.mockResolvedValue({ data: {} })
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByTestId('server').textContent).not.toBe(MOCK_SERVER)
    )
    const adopted = screen.getByTestId('server').textContent
    expect(localStorage.getItem(STORAGE_KEY)).toBe(adopted)
  })

  it('stays on mock when no real server responds', async () => {
    axios.get.mockRejectedValue(new Error('down'))
    render(<ServerProvider><Probe /></ServerProvider>)
    await waitFor(() => expect(screen.getByTestId('probing').textContent).toBe('no'))
    expect(screen.getByTestId('server').textContent).toBe(MOCK_SERVER)
  })

  it('changeServer switches to mock', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042') // skip probe
    render(<ServerProvider><Probe /></ServerProvider>)
    fireEvent.click(screen.getByText('to-mock'))
    expect(screen.getByTestId('server').textContent).toBe(MOCK_SERVER)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_SERVER)
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

  it('exposes Mock as a server option', () => {
    localStorage.setItem(STORAGE_KEY, 'http://localhost:8042')
    render(<ServerProvider><Probe /></ServerProvider>)
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(2)
  })
})
