// v1.7.0 V1 step 11 — the users list: search routing, state filter, cursor paging, no email column.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import UsersPage from '../../pages/UsersPage'
import { listAdminUsers } from '../../api/userApi'

vi.mock('../../api/userApi', () => ({ listAdminUsers: vi.fn() }))

const ROW = {
  uuid: 'aaaaaaaa-1111-4000-8000-000000000001', nickname: 'annabel', state: 2, role: 'PLAYER',
  accountType: 'GOOGLE', tsRegistration: '2026-10-01T10:00:00Z', tsLastAccess: '2026-10-20T10:00:00Z',
  suspendedUntil: null,
}
const SUSPENDED = { ...ROW, uuid: 'bbbbbbbb-2222-4000-8000-000000000002', nickname: 'bob', state: 3, suspendedUntil: '2026-11-01T00:00:00Z' }

const renderPage = () => render(
  <MemoryRouter initialEntries={['/users']}>
    <Routes>
      <Route path="/users" element={<UsersPage />} />
      <Route path="/users/:uuid" element={<div data-testid="detail-page">detail</div>} />
    </Routes>
  </MemoryRouter>
)

const search = (text) => {
  fireEvent.change(screen.getByLabelText('Search users'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /Search/ }))
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAdminUsers.mockResolvedValue({ items: [ROW, SUSPENDED], nextCursor: null, limit: 50 })
  })

  it('loads the default view (active users by last access) with no email column', async () => {
    renderPage()
    expect(await screen.findByText('annabel')).toBeInTheDocument()
    expect(listAdminUsers).toHaveBeenCalledWith({ limit: 50 })
    expect(screen.queryByText(/^Email$/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Suspended')).toBeInTheDocument()
    expect(screen.getByText(/^until /)).toBeInTheDocument()
    expect(screen.getByTestId('users-hint')).toHaveTextContent('newest last access first')
    expect(screen.getByText(/all loaded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No more pages/ })).toBeDisabled()
  })

  it('a value with "@" searches the exact email and ignores the state', async () => {
    renderPage()
    await screen.findByText('annabel')
    search(' Ann@Example.com ')
    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50, email: 'ann@example.com' }))
    expect(screen.getByLabelText('Filter by state')).toBeDisabled()
    expect(screen.getByTestId('users-hint')).toHaveTextContent('state filter is ignored')
  })

  it('anything else is a nickname prefix with the state filter', async () => {
    renderPage()
    await screen.findByText('annabel')
    search('ann')
    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50, nickname: 'ann', state: '2' }))
    expect(screen.getByTestId('users-hint')).toHaveTextContent('Alphabetical')
    fireEvent.change(screen.getByLabelText('Filter by state'), { target: { value: '4' } })
    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50, nickname: 'ann', state: '4' }))
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }))
    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50, state: '4' }))
    fireEvent.change(screen.getByLabelText('Filter by state'), { target: { value: '' } })
    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50 }))
    expect(screen.getByTestId('users-hint')).toHaveTextContent('Without a search')
  })

  it('pages with the cursor', async () => {
    listAdminUsers
      .mockResolvedValueOnce({ items: [ROW], nextCursor: 'c1', limit: 50 })
      .mockResolvedValueOnce({ items: [SUSPENDED], nextCursor: null, limit: 50 })
    renderPage()
    await screen.findByText('annabel')
    expect(screen.getByText(/more available/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Load more/ }))
    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(listAdminUsers).toHaveBeenLastCalledWith({ limit: 50, cursor: 'c1' })
    expect(screen.getByText('annabel')).toBeInTheDocument()
  })

  it('shows the load-more error and keeps the rows', async () => {
    listAdminUsers
      .mockResolvedValueOnce({ items: [ROW], nextCursor: 'c1', limit: 50 })
      .mockRejectedValueOnce(Object.assign(new Error('Bad cursor'), { code: 'INVALID_INPUT' }))
    renderPage()
    await screen.findByText('annabel')
    fireEvent.click(screen.getByRole('button', { name: /Load more/ }))
    expect(await screen.findByText(/INVALID_INPUT/)).toBeInTheDocument()
    expect(screen.getByText('annabel')).toBeInTheDocument()
  })

  it('shows a load error, an empty table and a malformed envelope', async () => {
    listAdminUsers.mockRejectedValueOnce(new Error('Network Error'))
    renderPage()
    expect(await screen.findByText('Network Error')).toBeInTheDocument()
    expect(screen.getByText('No users found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^\s*$/ }))
    listAdminUsers.mockResolvedValueOnce({})
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))
    await waitFor(() => expect(listAdminUsers).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  it('ignores a load-more without cursor and a page without items', async () => {
    listAdminUsers
      .mockResolvedValueOnce({ items: [ROW], nextCursor: 'c1', limit: 50 })
      .mockResolvedValueOnce({ nextCursor: null })
    renderPage()
    await screen.findByText('annabel')
    fireEvent.click(screen.getByRole('button', { name: /Load more/ }))
    await screen.findByText(/all loaded/)
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('opens the user page and renders a row without nickname or known state', async () => {
    listAdminUsers.mockResolvedValue({ items: [{ ...ROW, nickname: '', state: 9, role: null, accountType: null }], nextCursor: null })
    renderPage()
    expect(await screen.findByText('no nickname')).toBeInTheDocument()
    expect(screen.getByText('State 9')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Open user ${ROW.uuid}` }))
    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })
})
