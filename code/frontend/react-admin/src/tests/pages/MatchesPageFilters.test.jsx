// v1.7.0 step 12 — server-side user (picker) and story filters on the matches page, and short pages.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/matchApi', () => ({
  listMatches: vi.fn(), getMatchInfo: vi.fn(), listMatchStatuses: vi.fn(() => Promise.resolve([])),
  updateMatch: vi.fn(), stopMatch: vi.fn(), deleteMatch: vi.fn(),
  listMatchSnapshots: vi.fn(() => Promise.resolve([])), exportMatch: vi.fn(),
  errorBody: (e) => e?.response?.data ?? {},
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn(), listAllStories: vi.fn() }))
vi.mock('../../api/userApi', () => ({ listAdminUsers: vi.fn() }))

import MatchesPage from '../../pages/MatchesPage'
import { listMatches } from '../../api/matchApi'
import { listAllStories } from '../../api/storyApi'
import { listAdminUsers } from '../../api/userApi'

const MATCH = { uuid: 'm1-uuid-aaaa', name: 'Run', storyUuid: 's-1', status: 'RUNNING', tsInsert: '2026-10-01T00:00:00Z' }

function renderPage() {
  return render(<MemoryRouter><MatchesPage /></MemoryRouter>)
}

describe('MatchesPage filters (step 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllStories.mockResolvedValue([{ uuid: 's-1', title: 'Forest' }, { uuid: 's-2-uuid-long' }])
    listMatches.mockResolvedValue({ items: [MATCH], nextCursor: null, limit: 50 })
  })

  it('the story select sends storyUuid to the server', async () => {
    renderPage()
    await screen.findByText('Forest')
    expect(screen.getByLabelText('Filter by story').querySelectorAll('option')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Filter by story'), { target: { value: 's-1' } })
    await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith(
      { limit: 50, status: 'RUNNING', storyUuid: 's-1' }))
  })

  it('the user picker sends userUuid and clearing it removes the filter', async () => {
    listAdminUsers.mockResolvedValue({ items: [{ uuid: 'u-9', nickname: 'mario' }] })
    renderPage()
    await screen.findByText('Run')
    fireEvent.change(screen.getByLabelText('Filter by user'), { target: { value: 'mar' } })
    fireEvent.click(screen.getByLabelText('Search users'))
    fireEvent.click(await screen.findByText('mario'))
    await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith(
      { limit: 50, status: 'RUNNING', userUuid: 'u-9' }))
    fireEvent.click(screen.getByLabelText('Clear user filter'))
    await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith({ limit: 50, status: 'RUNNING' }))
  })

  it('an empty page with a cursor still offers the next page', async () => {
    listMatches
      .mockResolvedValueOnce({ items: [], nextCursor: 'c1', limit: 50 })
      .mockResolvedValueOnce({ items: [MATCH], nextCursor: null, limit: 50 })
    renderPage()
    expect(await screen.findByText(/load more to read further/)).toBeTruthy()
    fireEvent.click(screen.getByText('Load more'))
    expect(await screen.findByText('Run')).toBeTruthy()
    expect(listMatches).toHaveBeenLastCalledWith({ limit: 50, status: 'RUNNING', cursor: 'c1' })
    expect(screen.getByText('No more pages')).toBeTruthy()
  })

  it('a failed story list leaves only "All stories"', async () => {
    listAllStories.mockRejectedValue(new Error('down'))
    renderPage()
    await screen.findByText('Run')
    expect(screen.getByLabelText('Filter by story').querySelectorAll('option')).toHaveLength(1)
  })

  it('a story list that is not an array is ignored', async () => {
    listAllStories.mockResolvedValue({})
    renderPage()
    await screen.findByText('Run')
    expect(screen.getByLabelText('Filter by story').querySelectorAll('option')).toHaveLength(1)
  })
})
