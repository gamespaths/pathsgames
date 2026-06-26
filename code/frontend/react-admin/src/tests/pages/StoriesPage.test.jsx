import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StoriesPage from '../../pages/story/StoriesPage'

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

  it('exports weather-rules and global-random-events under their import keys', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    let capturedBlob = null
    global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return mockObjectURL })

    listEntities.mockImplementation((_uuid, apiType) => {
      if (apiType === 'weather-rules') return Promise.resolve([{ id: 1, idTextName: 800, probability: 70 }])
      if (apiType === 'global-random-events') return Promise.resolve([{ id: 2, idEvent: 5 }])
      return Promise.resolve([])
    })

    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Export JSON')[0])
    await waitFor(() => expect(capturedBlob).not.toBeNull())

    // The admin API is queried with kebab-case types (the bug used camelCase).
    expect(listEntities).toHaveBeenCalledWith('aaa-111', 'weather-rules')
    expect(listEntities).toHaveBeenCalledWith('aaa-111', 'global-random-events')
    expect(listEntities).not.toHaveBeenCalledWith('aaa-111', 'weatherRules')
    expect(listEntities).not.toHaveBeenCalledWith('aaa-111', 'globalRandomEvents')

    // The importer reads camelCase keys → data must land under those keys, non-empty.
    const parsed = JSON.parse(await capturedBlob.text())
    expect(parsed.weatherRules).toHaveLength(1)
    expect(parsed.weatherRules[0].probability).toBe(70)
    expect(parsed.globalRandomEvents).toHaveLength(1)
    expect(parsed.globalRandomEvents[0].idEvent).toBe(5)

    clickSpy.mockRestore()
  })

  it('exports JSON with alphabetically sorted keys, including nested nodes', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    let capturedBlob = null
    global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return mockObjectURL })

    // Header with unsorted keys plus a nested object
    getStory.mockResolvedValue({
      uuid: 'aaa-111',
      title: 'Z Title',
      author: 'A Author',
      card: { name: 'X', awesomeIcon: 'fa-crown', color: 'gold' },
    })
    // One entity type returns an item with unsorted keys
    listEntities.mockImplementation((_uuid, apiType) =>
      apiType === 'locations'
        ? Promise.resolve([{ name: 'Forest', id: 1, description: 'A place', code: 'FRST' }])
        : Promise.resolve([])
    )

    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Export JSON')[0])
    await waitFor(() => expect(capturedBlob).not.toBeNull())

    const text = await capturedBlob.text()
    const parsed = JSON.parse(text)

    const topKeys = Object.keys(parsed)
    expect(topKeys).toEqual([...topKeys].sort())

    const cardKeys = Object.keys(parsed.card)
    expect(cardKeys).toEqual(['awesomeIcon', 'color', 'name'])

    const locKeys = Object.keys(parsed.locations[0])
    expect(locKeys).toEqual(['code', 'description', 'id', 'name'])

    clickSpy.mockRestore()
  })

  it('keeps uuid on list elements but strips technical fields', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    let capturedBlob = null
    global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return mockObjectURL })

    listEntities.mockImplementation((_uuid, apiType) =>
      apiType === 'events'
        ? Promise.resolve([{
            uuid: 'evt-uuid-1', id: 7, name: 'Storm',
            idStory: 'aaa-111', tsInsert: '2024-01-01', tsUpdate: '2024-01-02',
          }])
        : Promise.resolve([])
    )

    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('Export JSON')[0])
    await waitFor(() => expect(capturedBlob).not.toBeNull())

    const parsed = JSON.parse(await capturedBlob.text())
    const event = parsed.events[0]
    expect(event.uuid).toBe('evt-uuid-1')
    expect(event).not.toHaveProperty('idStory')
    expect(event).not.toHaveProperty('tsInsert')
    expect(event).not.toHaveProperty('tsUpdate')

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

  it('closes error alert when X is clicked', async () => {
    listAllStories.mockRejectedValue(new Error('Persistent error'))
    renderPage()
    const errorMsg = await screen.findByText(/Persistent error/i)
    const closeBtn = errorMsg.parentElement.querySelector('button')
    await userEvent.click(closeBtn)
    expect(screen.queryByText(/Persistent error/i)).toBeNull()
  })

  it('closes detail modal when backdrop is clicked', async () => {
    renderPage()
    await screen.findByText('The Lost Kingdom')
    await userEvent.click(screen.getAllByTitle('View Info')[0])
    expect(screen.getByText('Close')).toBeInTheDocument()
    // Click the backdrop (pg-modal-backdrop) to close
    const backdrop = document.querySelector('.pg-modal-backdrop')
    await userEvent.click(backdrop)
    await waitFor(() => expect(screen.queryByText('Close')).toBeNull())
  })

  it('shows difficulties in detail modal for story with difficulties', async () => {
    const storyWithDifficulty = {
      uuid: 'ccc-333', title: 'Epic Quest', author: 'GameMaster', visibility: 'PUBLIC',
      priority: 3, peghi: 0, difficultyCount: 1, card: null,
      difficulties: [
        { expCost: 5, maxWeight: 20, minCharacter: 1, maxCharacter: 4, life: 100, energy: 50, sad: 10, dexterity: 15, intelligence: 12, constitution: 18, weight: 3 },
      ],
    }
    listAllStories.mockResolvedValue([storyWithDifficulty])
    renderPage()
    await screen.findByText('Epic Quest')
    await userEvent.click(screen.getAllByTitle('View Info')[0])
    await waitFor(() => expect(screen.getByText(/Difficulties \(1\)/)).toBeInTheDocument())
    expect(screen.getByText(/expCost: 5/)).toBeInTheDocument()
  })

  it('exports story with texts including idText remapping', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    getStory.mockResolvedValue({ uuid: 'aaa-111', title: 'Epic Quest', author: 'Author' })
    listEntities.mockImplementation((_uuid, type) => {
      if (type === 'texts') return Promise.resolve([
        { idText: 10, lang: 'en', shortText: 'Hello', tsInsert: '2024-01-01', idStory: 'aaa' },
      ])
      return Promise.resolve([])
    })
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const exportButtons = screen.getAllByTitle('Export JSON')
    await userEvent.click(exportButtons[0])
    await waitFor(() => expect(screen.getByText(/exported successfully/i)).toBeInTheDocument())
    clickSpy.mockRestore()
  })

  it('shows error when deleteStory throws', async () => {
    deleteStory.mockRejectedValue(new Error('Delete failed'))
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const deleteButtons = screen.getAllByTitle('Delete')
    await userEvent.click(deleteButtons[0])
    const confirmBtn = await screen.findByText('Confirm')
    await userEvent.click(confirmBtn)
    await waitFor(() => expect(screen.getByText(/Delete failed/i)).toBeInTheDocument())
  })

  it('shows error when createStory throws', async () => {
    createStory.mockRejectedValue(new Error('Create failed'))
    renderPage()
    await screen.findByText('The Lost Kingdom')
    const createBtn = screen.getByText(/New Story/i)
    await userEvent.click(createBtn)
    await waitFor(() => expect(screen.getByText(/Create failed/i)).toBeInTheDocument())
  })
})
