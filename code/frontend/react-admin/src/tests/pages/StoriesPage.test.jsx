import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StoriesPage from '../../pages/StoriesPage'

// ── Mock API module ────────────────────────────────────────────
vi.mock('../../api/storyApi', () => ({
  listAllStories: vi.fn(),
  deleteStory:    vi.fn(),
  createStory:    vi.fn(),
  getStory:       vi.fn(),
  listEntities:   vi.fn(),
}))
import { listAllStories, deleteStory, createStory, getStory, listEntities } from '../../api/storyApi'

// Mock URL APIs used by export
const mockObjectURL = 'blob:http://localhost/test-uuid'
global.URL.createObjectURL = vi.fn(() => mockObjectURL)
global.URL.revokeObjectURL = vi.fn()

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
    card:            { awesomeIcon: 'fa-crown' },
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

const MOCK_STORY_DETAIL = {
  uuid: 'aaa-111',
  title: 'The Lost Kingdom',
  author: 'GameMaster',
  tsInsert: '2024-01-01',
  tsUpdate: '2024-01-02',
}

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
    getStory.mockResolvedValue(MOCK_STORY_DETAIL)
    listEntities.mockResolvedValue([])
    createStory.mockResolvedValue({ uuid: 'new-uuid-111' })
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

  it('renders card awesomeIcon when story has card', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    // The first story has card.awesomeIcon = 'fa-crown'; icon element should be present
    const rows = document.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
    // story with card icon renders an <i> with the icon class
    const iconEl = document.querySelector('i.fa-crown')
    expect(iconEl).not.toBeNull()
  })

  it('exports story and shows success message', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const exportButtons = screen.getAllByTitle('Export JSON')
    await userEvent.click(exportButtons[0])
    await waitFor(() => expect(getStory).toHaveBeenCalledWith('aaa-111'))
    await waitFor(() => expect(listEntities).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/exported successfully/i)).toBeInTheDocument())
    clickSpy.mockRestore()
  })

  it('shows export error when getStory fails', async () => {
    getStory.mockRejectedValue(new Error('Export error'))
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const exportButtons = screen.getAllByTitle('Export JSON')
    await userEvent.click(exportButtons[0])
    await waitFor(() => expect(screen.getByText(/Export failed/i)).toBeInTheDocument())
  })

  it('closes success alert when X is clicked', async () => {
    deleteStory.mockResolvedValue({ status: 'DELETED' })
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Delete')[0])
    await userEvent.click(screen.getByText('Confirm'))
    const successMsg = await screen.findByText(/deleted/i)
    expect(successMsg).toBeInTheDocument()
    // close button inside success alert
    const closeBtn = successMsg.parentElement.querySelector('button')
    await userEvent.click(closeBtn)
    await waitFor(() => expect(screen.queryByText(/deleted/i)).toBeNull())
  })

  it('opens detail modal and can export from it', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('View Info')[0])
    // Export JSON inside detail modal - there are multiple "Export JSON" buttons (one in row, one in modal)
    const exportBtns = screen.getAllByRole('button', { name: /Export JSON/i })
    await userEvent.click(exportBtns[exportBtns.length - 1])
    await waitFor(() => expect(getStory).toHaveBeenCalled())
    clickSpy.mockRestore()
  })

  it('closes detail modal when backdrop clicked', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('View Info')[0])
    expect(screen.getByText('Close')).toBeInTheDocument()
    // click close button
    await userEvent.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('Close')).toBeNull())
  })
})
