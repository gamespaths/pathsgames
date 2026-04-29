import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../../components/layout/Layout'
import { AuthProvider } from '../../../context/AuthContext'

// ── Mock API module ────────────────────────────────────────────
vi.mock('../../../api/echoApi', () => ({
  getServerStatus: vi.fn().mockResolvedValue({ properties: { version: '1.0.0' } }),
}))

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Layout>
          <div data-testid="children">Content</div>
        </Layout>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children and essential layout components', () => {
    renderLayout()
    expect(screen.getAllByText('Stories').length).toBeGreaterThan(0)
    expect(screen.getByText('Server Status')).toBeInTheDocument()
    expect(screen.getByTestId('children')).toBeInTheDocument()
    expect(screen.getByText(/Admin Panel/i)).toBeInTheDocument()  // Footer
  })

  it('shows sidebar by default on dashboard', () => {
    renderLayout('/')
    expect(screen.getByRole('complementary')).toBeInTheDocument() // aside is Sidebar
  })

  it('hides sidebar when navigating to other pages (behavior test)', async () => {
    // Layout logic uses useLocation and useEffect to handle visibility
    renderLayout('/guests')
    // On non-dashboard, sidebar might still be visible initially but can be toggled
    // or set by navigation events.
    // In Layout.jsx: useEffect(() => { if (isDashboard) setIsSidebarVisible(true) }, [isDashboard])
    // If not dashboard, it stays whatever it was.
    
    // On non-dashboard, sidebar can be toggled
    const toggleBtn = screen.getByTitle(/Hide sidebar|Show sidebar/i)
    fireEvent.click(toggleBtn)
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('sidebar cannot be toggled on dashboard', () => {
    renderLayout('/')
    const toggleBtn = screen.getByTitle(/Sidebar always visible on Dashboard/i)
    fireEvent.click(toggleBtn)
    // Should still be visible because onToggleSidebar is not called or logic prevents it
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })
})
