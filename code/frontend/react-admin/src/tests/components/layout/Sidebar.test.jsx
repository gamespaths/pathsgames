import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../../../components/layout/Sidebar'

describe('Sidebar', () => {
  it('renders all menu links', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Guest Users')).toBeInTheDocument()
    expect(screen.getAllByText('Stories').length).toBeGreaterThan(0)
    expect(screen.getByText('Server Status')).toBeInTheDocument()
  })

  it('calls onNavigate callback when link is clicked', () => {
    const onNavigate = vi.fn()
    render(
      <MemoryRouter>
        <Sidebar onNavigate={onNavigate} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('Guest Users'))
    expect(onNavigate).toHaveBeenCalledWith('/guests')
  })
})
