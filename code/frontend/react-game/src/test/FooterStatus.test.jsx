import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockChangeServer = vi.fn()
vi.mock('../context/ServerContext', () => ({
  useServer: () => ({
    server: 'http://api.test',
    servers: [
      { label: 'Local', url: 'http://api.test' },
      { label: 'Remote', url: 'http://api.remote' },
    ],
    probing: false,
    changeServer: mockChangeServer,
  }),
}))

vi.mock('../api/echoApi', () => ({ getServerStatus: vi.fn() }))

import { getServerStatus } from '../api/echoApi'
import Footer from '../components/layout/Footer'

describe('Footer — real-server status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the version when the server responds online', async () => {
    getServerStatus.mockResolvedValue({ properties: { version: 'v9.9' } })
    render(<Footer />)
    await waitFor(() => expect(screen.getByText('v9.9')).toBeInTheDocument())
    expect(getServerStatus).toHaveBeenCalledWith('http://api.test')
  })

  it('handles an online server that returns no version', async () => {
    getServerStatus.mockResolvedValue({})
    render(<Footer />)
    await waitFor(() => expect(getServerStatus).toHaveBeenCalled())
  })

  it('marks the server offline when the status call fails', async () => {
    getServerStatus.mockRejectedValue(new Error('down'))
    render(<Footer />)
    await waitFor(() => expect(getServerStatus).toHaveBeenCalled())
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('invokes changeServer when a different server is selected', async () => {
    getServerStatus.mockResolvedValue({})
    render(<Footer />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'http://api.remote' } })
    expect(mockChangeServer).toHaveBeenCalledWith('http://api.remote')
  })
})
