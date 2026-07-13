import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../../components/layout/Layout'
import { AuthProvider } from '../../../context/AuthContext'

vi.mock('../../../api/echoApi', () => ({
  getServerStatus: vi.fn().mockResolvedValue({ properties: { version: '0.0.0' } }),
}))

describe('Layout', () => {
  it('renders navbar and children', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByText(/Paths Games Admin Panel/i)).toBeInTheDocument()
  })

  it('does not render sidebar', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
