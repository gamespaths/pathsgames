// v1.7.0 step 12 — the user picker of the matches filter: nickname search, pick, clear, empty and failed search.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../api/userApi', () => ({ listAdminUsers: vi.fn() }))
import { listAdminUsers } from '../../../api/userApi'
import UserPicker, { PICKER_LIMIT } from '../../../components/user/UserPicker'

describe('UserPicker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches by nickname prefix and picks a user', async () => {
    listAdminUsers.mockResolvedValue({ items: [{ uuid: 'u-1', nickname: 'mario' }, { uuid: 'u-2' }], nextCursor: null })
    const onChange = vi.fn()
    render(<UserPicker value={null} onChange={onChange} />)
    expect(screen.getByLabelText('Search users')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Filter by user'), { target: { value: ' mar ' } })
    fireEvent.click(screen.getByLabelText('Search users'))
    await screen.findByTestId('user-picker-results')
    expect(listAdminUsers).toHaveBeenCalledWith({ nickname: 'mar', limit: PICKER_LIMIT })
    expect(screen.getByText('u-2')).toBeTruthy()
    fireEvent.click(screen.getByText('mario'))
    expect(onChange).toHaveBeenCalledWith({ uuid: 'u-1', nickname: 'mario' })
    expect(screen.queryByTestId('user-picker-results')).toBeNull()
  })

  it('Enter searches; an empty answer and a failure are said', async () => {
    listAdminUsers.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce({})
    render(<UserPicker value={null} onChange={vi.fn()} />)
    const input = screen.getByLabelText('Filter by user')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(listAdminUsers).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'zz' } })
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('No users found.')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('alert')).toHaveTextContent('down')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Search failed'))
  })

  it('a picked user shows its nickname and can be cleared', () => {
    const onChange = vi.fn()
    render(<UserPicker value={{ uuid: 'u-1', nickname: 'mario' }} onChange={onChange} />)
    expect(screen.getByTestId('user-picker-value')).toHaveTextContent('mario')
    fireEvent.click(screen.getByLabelText('Clear user filter'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
