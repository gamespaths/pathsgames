import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StoriesPage from '../../pages/StoriesPage'

// ── Mock API module ────────────────────────────────────────────
vi.mock('../../api/storyApi', () => ({
  listAllStories: vi.fn(),
  deleteStory:    vi.fn(),
}))
import { listAllStories, deleteStory } from '../../api/storyApi'

const MOCK_STORIES = [
  {
    uuid:            'aaa-111',
    title:           'The Lost Kingdom',
    author:          'GameMaster',
    category:        'adventure',
    group:           'fantasy',
    visibility:      'PUBLIC',
    priority:        5,
    peghi:           2,
    difficultyCount: 3,
    card:            null,
  },
  {
    uuid:            'bbb-222',
    title:           'Dark Secrets',
    author:          'StoryTeller',
    category:        'horror',
    group:           'dark',
    visibility:      'DRAFT',
    priority:        2,
    peghi:           1,
    difficultyCount: 1,
    card:            null,
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <StoriesPage />
    </MemoryRouter>
  )
}

describe('StoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllStories.mockResolvedValue(MOCK_STORIES)
  })

  it('shows loading spinner initially', () => {
    // resolves never so spinner stays visible
    listAllStories.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading stories/i)).toBeInTheDocument()
  })

  it('renders story rows after load', async () => {
    renderPage()
    expect(await screen.findByText('The Lost Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Dark Secrets')).toBeInTheDocument()
  })

  it('renders visibility badges', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    expect(screen.getByText('PUBLIC')).toBeInTheDocument()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('filters stories by title text', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const input = screen.getByPlaceholderText(/Filter by title/i)
    await userEvent.type(input, 'Dark')
    expect(screen.queryByText('The Lost Kingdom')).toBeNull()
    expect(screen.getByText('Dark Secrets')).toBeInTheDocument()
  })

  it('shows empty row message when filter matches nothing', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const input = screen.getByPlaceholderText(/Filter by title/i)
    await userEvent.type(input, 'zzznomatch')
    expect(screen.getByText('No stories found.')).toBeInTheDocument()
  })

  it('shows error alert when API fails', async () => {
    listAllStories.mockRejectedValue(new Error('Network error'))
    renderPage()
    expect(await screen.findByText(/Network error/i)).toBeInTheDocument()
  })

  it('opens confirm modal on delete click', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const deleteButtons = screen.getAllByTitle('Delete')
    await userEvent.click(deleteButtons[0])
    expect(screen.getByText('Delete Story')).toBeInTheDocument()
  })

  it('cancels delete modal without calling API', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Cancel'))
    expect(deleteStory).not.toHaveBeenCalled()
  })

  it('calls deleteStory and reloads after confirm', async () => {
    deleteStory.mockResolvedValue({ status: 'DELETED', uuid: 'aaa-111' })
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(deleteStory).toHaveBeenCalledWith('aaa-111'))
    expect(listAllStories).toHaveBeenCalledTimes(2) // initial + reload
  })

  it('opens detail modal on eye click', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('View Info')[0])
    // modal shows the story title; Close button appears only in the modal
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('calls listAllStories with selected lang', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const langSelect = screen.getByDisplayValue('en')
    await userEvent.selectOptions(langSelect, 'it')
    await waitFor(() => {
      expect(listAllStories).toHaveBeenCalledWith('it')
    })
  })
})
