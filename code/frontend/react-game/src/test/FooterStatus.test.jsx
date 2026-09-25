import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

const mockChangeServer = vi.fn()
// v0.37.6 — status/version are read from ServerContext (one request per server, made
// there); the footer only renders them.
const ctx = vi.hoisted(() => ({ status: 'loading', version: '' }))
vi.mock('../context/ServerContext', () => ({
  useServer: () => ({
    server: 'http://api.test',
    servers: [
      { label: 'Local', url: 'http://api.test' },
      { label: 'Remote', url: 'http://api.remote' },
    ],
    probing: false,
    status: ctx.status,
    version: ctx.version,
    changeServer: mockChangeServer,
  }),
}))

import Footer from '../components/layout/Footer'

describe('Footer — real-server status', () => {
  beforeEach(() => { vi.clearAllMocks(); ctx.status = 'loading'; ctx.version = '' })

  it('shows the version when the server is online', () => {
    ctx.status = 'online'
    ctx.version = 'v9.9'
    const { container } = render(<Footer />)
    expect(screen.getByText('v9.9')).toBeInTheDocument()
    expect(container.querySelector('[style*="rgb(76, 175, 80)"]')).toBeInTheDocument()
  })

  it('handles an online server with no version', () => {
    ctx.status = 'online'
    const { container } = render(<Footer />)
    expect(container.querySelector('[style*="rgb(76, 175, 80)"]')).toBeInTheDocument()
    // No server version beside the status dot (the build's own v0.x line lives elsewhere).
    expect(container.querySelector('.footer-server-row').textContent).not.toMatch(/v\d/)
  })

  it('marks the server offline', () => {
    ctx.status = 'offline'
    const { container } = render(<Footer />)
    expect(container.querySelector('[style*="rgb(244, 67, 54)"]')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // Two servers: the drop-down, never the fixed name.
    expect(container.querySelector('.footer-server-name')).toBeNull()
  })

  it('shows an ellipsis while loading', () => {
    render(<Footer />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('invokes changeServer when a different server is selected', () => {
    render(<Footer />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'http://api.remote' } })
    expect(mockChangeServer).toHaveBeenCalledWith('http://api.remote')
  })
})
