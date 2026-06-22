import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import CardsFastEditPage from '../../pages/story/CardsFastEditPage'
import * as storyApi from '../../api/storyApi'

vi.mock('../../api/storyApi')

const STORY_UUID = 'story-uuid-1234'

const mockStory = {
  uuid: STORY_UUID, author: 'TestAuthor', idCreator: 1, idTextCopyright: 33,
}
const mockCards = [
  { uuid: 'card-uuid-1', idCard: 1, idTextTitle: 10, idTextDescription: 11, idTextCopyright: 33, linkCopyright: 'http://example.com', urlImage: 'http://img.com/a.png', idCreator: 1 },
  { uuid: 'card-uuid-2', idCard: 2, idTextTitle: 20, idTextDescription: null, idTextCopyright: null, linkCopyright: '', urlImage: '', idCreator: null },
]
const mockTexts = [
  { uuid: 't1', idText: 10, lang: 'en', shortText: 'Hello Card' },
  { uuid: 't2', idText: 11, lang: 'en', shortText: 'Description text' },
  { uuid: 't3', idText: 33, lang: 'en', shortText: 'Copyright' },
  { uuid: 't4', idText: 20, lang: 'en', shortText: 'Card Two Title' },
]
const mockCreators = [
  { uuid: 'cr1', idCreator: 1, idText: 5 },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/stories/${STORY_UUID}/cards-fast-edit`]}>
      <AuthProvider>
        <Routes>
          <Route path="/stories/:uuid/cards-fast-edit" element={<CardsFastEditPage />} />
          <Route path="/stories/:uuid/edit" element={<div>Editor</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('CardsFastEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storyApi.getStory.mockResolvedValue(mockStory)
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards')    return Promise.resolve(mockCards)
      if (type === 'texts')    return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      return Promise.resolve([])
    })
    storyApi.updateEntity.mockResolvedValue({})
  })

  it('renders loading then card table', async () => {
    renderPage()
    expect(screen.getByText(/Loading cards/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/i)).toBeInTheDocument())
    expect(screen.getByText('Title Text')).toBeInTheDocument()
    expect(screen.getAllByTitle(/Save this card/i).length).toBe(2)
  })

  it('shows page title with story author', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/TestAuthor/)).toBeInTheDocument())
  })

  it('shows text id buttons for existing text fields', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/^#10/)).toBeInTheDocument())
    expect(screen.getByText(/^#20/)).toBeInTheDocument()
  })

  it('shows dash for empty text ids', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Title Text'))
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('Save All button is disabled when nothing is dirty', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const saveAllBtn = screen.getByRole('button', { name: /Save All/i })
    expect(saveAllBtn).toBeDisabled()
  })

  it('marks row as dirty and enables per-row save button when input changes', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const inputs = screen.getAllByLabelText('Copyright Link')
    fireEvent.change(inputs[0], { target: { value: 'https://new-link.com' } })
    const saveAllBtn = screen.getByRole('button', { name: /Save All/i })
    expect(saveAllBtn).not.toBeDisabled()
  })

  it('calls updateEntity when per-row save button clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const inputs = screen.getAllByLabelText('Copyright Link')
    fireEvent.change(inputs[0], { target: { value: 'https://changed.com' } })
    const saveBtns = screen.getAllByTitle('Save this card')
    fireEvent.click(saveBtns[0])
    await waitFor(() => expect(storyApi.updateEntity).toHaveBeenCalledWith(
      STORY_UUID, 'cards', 'card-uuid-1', expect.objectContaining({ linkCopyright: 'https://changed.com' })
    ))
  })

  it('renders Back button linking to story editor', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    expect(screen.getByText(/Back/i)).toBeInTheDocument()
  })
})
