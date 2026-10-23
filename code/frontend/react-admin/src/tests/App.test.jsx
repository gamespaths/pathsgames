import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider, useAuth } from '../context/AuthContext'

// Mocking components to simplify App testing
vi.mock('../pages/LoginPage', () => ({ default: () => <div data-testid="login-page">Login Page</div> }))
vi.mock('../pages/DashboardPage', () => ({ default: () => <div data-testid="dashboard-page">Dashboard Page</div> }))
vi.mock('../api/echoApi', () => ({ getServerStatus: vi.fn().mockResolvedValue({}) }))
vi.mock('../pages/UsersPage', () => ({ default: () => <div data-testid="users-page">Users</div> }))
vi.mock('../pages/UserDetailPage', () => ({ default: () => <div data-testid="user-detail-page">User</div> }))
vi.mock('../pages/story/FastNewLocationsPage', () => ({ default: () => <div data-testid="fast-locations-page">Fast Locations</div> }))

describe('App', () => {
  it('redirects to login when not logged in', () => {
    // We need to override localStorage for AuthProvider
    localStorage.removeItem('pg_admin_token')
    
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders dashboard when logged in', async () => {
    localStorage.setItem('pg_admin_token', 'mock-token')
    
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    
    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('routes /stories/:uuid/fast-new-locations to the Fast New Locations page', async () => {
    localStorage.setItem('pg_admin_token', 'mock-token')
    render(
      <MemoryRouter initialEntries={['/stories/abc/fast-new-locations']}>
        <App />
      </MemoryRouter>
    )
    expect(await screen.findByTestId('fast-locations-page')).toBeInTheDocument()
  })

  it('routes /users and /users/:uuid to the user pages (v1.7.0)', async () => {
    localStorage.setItem('pg_admin_token', 'mock-token')
    const { unmount } = render(<MemoryRouter initialEntries={['/users']}><App /></MemoryRouter>)
    expect(await screen.findByTestId('users-page')).toBeInTheDocument()
    unmount()
    render(<MemoryRouter initialEntries={['/users/abc']}><App /></MemoryRouter>)
    expect(await screen.findByTestId('user-detail-page')).toBeInTheDocument()
  })
})
