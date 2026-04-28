import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StoryEditorPage from '../../pages/StoryEditorPage'

// --- Mock API module ---
vi.mock('../../api/storyApi', () => ({
  getStory: vi.fn(),
  listEntities: vi.fn(),
  updateStory: vi.fn(),
  deleteEntity: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
}))
import { getStory, listEntities, updateStory, deleteEntity, createEntity, updateEntity } from '../../api/storyApi'

const MOCK_STORY = {
  uuid: 'story-123',
  title: 'Test Story',
  author: 'Author',
  visibility: 'DRAFT',
  priority: 10,
  peghi: 0
}

const MOCK_TEXTS = [
  { idText: 101, lang: 'en', shortText: 'Location Name' },
  { idText: 102, lang: 'en', shortText: 'Location Desc' }
]

function renderPage(uuid = 'story-123') {
  return render(
    <MemoryRouter initialEntries={[`/stories/${uuid}/edit`]}>
      <Routes>
        <Route path="/stories/:uuid/edit" element={<StoryEditorPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StoryEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue(MOCK_STORY)
    listEntities.mockResolvedValue([])
    // Initial load calls getEntity and listEntities('texts')
    listEntities.mockImplementation((uuid, type) => {
        if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
        return Promise.resolve([])
    })
  })

  it('renders story info by default', async () => {
    renderPage()
    expect(await screen.findByDisplayValue('Author')).toBeInTheDocument()
    // The tab button has the class we're looking for
    expect(screen.getByRole('button', { name: /Story Info/i })).toHaveClass(/text-gold-light/i)
  })

  it('updates story metadata', async () => {
    updateStory.mockResolvedValue({ status: 'UPDATED' })
    renderPage()
    await screen.findByDisplayValue('Author')
    const input = screen.getByDisplayValue('Author')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Author')
    await userEvent.click(screen.getByText(/Save Changes/i))
    expect(updateStory).toHaveBeenCalledWith('story-123', expect.objectContaining({ author: 'New Author' }))
    expect(await screen.findByText(/updated successfully/i)).toBeInTheDocument()
  })

  it('switches tabs and loads entities', async () => {
    listEntities.mockImplementation((uuid, type) => {
        if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
        if (type === 'locations') return Promise.resolve([{ uuid: 'loc-1', idTextName: 101, idTextDescription: 102, isSafe: 1 }])
        return Promise.resolve([])
    })
    renderPage()
    await screen.findByDisplayValue('Author')
    await userEvent.click(screen.getByRole('button', { name: /Locations/i }))
    expect(await screen.findByText(/Location Name/i)).toBeInTheDocument()
    expect(listEntities).toHaveBeenCalledWith('story-123', 'locations')
  })

  it('deletes an entity after confirmation', async () => {
    listEntities.mockImplementation((uuid, type) => {
        if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
        if (type === 'locations') return Promise.resolve([{ uuid: 'loc-1', idTextName: 101 }])
        return Promise.resolve([])
    })
    deleteEntity.mockResolvedValue({ status: 'DELETED' })
    renderPage()
    await screen.findByDisplayValue('Author')
    await userEvent.click(screen.getByRole('button', { name: /Locations/i }))
    
    const trashBtn = await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        return buttons.find(b => b.querySelector('.fa-trash'))
    })
    await userEvent.click(trashBtn)
    
    expect(screen.getByText(/Are you sure you want to delete this location/i)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Confirm'))
    expect(deleteEntity).toHaveBeenCalledWith('story-123', 'locations', 'loc-1')
  })

  it('creates a new entity', async () => {
    createEntity.mockResolvedValue({ uuid: 'new-loc' })
    renderPage()
    await screen.findByDisplayValue('Author')
    await userEvent.click(screen.getByRole('button', { name: /Locations/i }))
    await userEvent.click(screen.getByRole('button', { name: /Add Location/i }))
    
    expect(screen.getByText('Create Entity')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Save'))
    expect(createEntity).toHaveBeenCalledWith('story-123', 'locations', expect.any(Object))
  })

  it('opens selectors in metadata form', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')
    
    const cardSelectorBtn = screen.getByTitle(/Select Card ID/i)
    await userEvent.click(cardSelectorBtn)
    expect(screen.getByText(/Select Card/i)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Close'))
    
    const startLocBtn = screen.getByTitle(/Select Start Location ID/i)
    await userEvent.click(startLocBtn)
    expect(screen.getByText(/Select Start Location/i)).toBeInTheDocument()
  })
})
