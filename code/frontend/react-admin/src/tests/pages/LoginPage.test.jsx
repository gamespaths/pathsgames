import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import LoginPage from '../../pages/LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('renders brand and title', () => {
    renderLogin()
    expect(screen.getByText('Paths Games')).toBeInTheDocument()
    // "Admin Panel" appears in both the subtitle <p> and the submit button text
    expect(screen.getAllByText(/Admin Panel/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the textarea for JWT input', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/eyJhbGciOiJIUzI1NiJ9/)).toBeInTheDocument()
  })

  it('shows error when submitting empty token', async () => {
    renderLogin()
    await userEvent.click(screen.getByText(/Enter Admin Panel/i))
    expect(await screen.findByText(/Please paste your JWT access token/i)).toBeInTheDocument()
  })

  it('shows error when token does not start with eyJ', async () => {
    renderLogin()
    const textarea = screen.getByPlaceholderText(/eyJhbGciOiJIUzI1NiJ9/)
    await userEvent.type(textarea, 'invalidtoken123')
    await userEvent.click(screen.getByText(/Enter Admin Panel/i))
    expect(await screen.findByText(/does not look like a valid JWT/i)).toBeInTheDocument()
  })

  it('saves token to localStorage on valid JWT', async () => {
    renderLogin()
    const textarea = screen.getByPlaceholderText(/eyJhbGciOiJIUzI1NiJ9/)
    await userEvent.type(textarea, 'eyJhbGciOiJIUzI1NiJ9.payload.sig')
    await userEvent.click(screen.getByText(/Enter Admin Panel/i))
    await waitFor(() => {
      expect(localStorage.getItem('pg_admin_token')).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig')
    })
  })

  it('renders the server selector with default option', () => {
    renderLogin()
    expect(screen.getByText(/Local \(8042\)/)).toBeInTheDocument()
  })
})
