import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider, useAuth } from '../context/AuthContext'

// Mocking components to simplify App testing
vi.mock('../pages/LoginPage', () => ({ default: () => <div data-testid="login-page">Login Page</div> }))
vi.mock('../pages/DashboardPage', () => ({ default: () => <div data-testid="dashboard-page">Dashboard Page</div> }))
vi.mock('../api/echoApi', () => ({ getServerStatus: vi.fn().mockResolvedValue({}) }))

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
})
