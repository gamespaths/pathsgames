import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../../components/layout/Layout'
import { AuthProvider } from '../../../context/AuthContext'

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

  it('toggles sidebar when not on dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/stories']}>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    
    // Sidebar should be visible initially
    expect(screen.getByText('Hide menu')).toBeInTheDocument()
    
    await userEvent.click(screen.getByText('Hide menu'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.getByText('Show menu')).toBeInTheDocument()
    
    await userEvent.click(screen.getByText('Show menu'))
    expect(screen.getByText('Hide menu')).toBeInTheDocument()
  })

  it('always shows sidebar on dashboard and disables toggle', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Layout><div>Dashboard</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    
    const toggleBtn = screen.getByTitle(/Sidebar always visible/i)
    expect(toggleBtn).toBeDisabled()
  })

  it('hides the sidebar when navigating to a non-dashboard route', async () => {
    render(
      <MemoryRouter initialEntries={['/stories']}>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    await userEvent.click(screen.getByText('Server Status'))
    expect(screen.getByText('Show menu')).toBeInTheDocument()
  })

  it('re-shows the sidebar when navigating back to the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/stories']}>
        <AuthProvider>
          <Layout><div>Content</div></Layout>
        </AuthProvider>
      </MemoryRouter>
    )
    await userEvent.click(screen.getByText('Server Status'))
    expect(screen.getByText('Show menu')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Show menu'))
    await userEvent.click(screen.getByText('Dashboard'))
    expect(screen.getByText('Hide menu')).toBeInTheDocument()
  })
})
