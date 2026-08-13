import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StoryEditorPage from '../../pages/story/StoryEditorPage'

vi.mock('../../api/storyApi', () => ({
  getStory: vi.fn(),
  listEntities: vi.fn(),
  updateStory: vi.fn(),
  deleteEntity: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  validateStory: vi.fn(),
}))
import {
  getStory, listEntities, createEntity, updateEntity,
} from '../../api/storyApi'

/**
 * The card-side shortcuts of the story editor: opening a card straight from an
 * entity table, and duplicating a neighbour's forward Card into a Card Back with
 * fresh " BIS" texts. Both run over data the editor may not have cached yet, and
 * over cards whose text ids are partly missing.
 */

const STORY = { uuid: 'story-123', title: 'Test Story', author: 'Author', visibility: 'DRAFT' }

const CARD = {
  uuid: 'card-1', id: 9, idCard: 9, idTextTitle: 101, idTextDescription: 102,
  urlImage: 'x.png', awesomeIcon: 'fa-star', tsInsert: 'x', tsUpdate: 'y',
}

const TEXTS = [
  { id: 101, uuid: 'text-101', idText: 101, lang: 'en', shortText: 'Gate', longText: 'The gate' },
  { id: 101, uuid: 'text-101-it', idText: 101, lang: 'it', shortText: '', longText: null },
  { id: 102, uuid: 'text-102', idText: 102, lang: 'en', shortText: 'Desc', longText: 'Long desc' },
]

const NEIGHBOR = { uuid: 'nb-1', id: 1, idCard: 9, idCardBack: null, idLocationFrom: 1, idLocationTo: 2 }

function mockLists({ cards = [CARD], texts = TEXTS, neighbors = [NEIGHBOR], creators = [] } = {}) {
  listEntities.mockImplementation((_uuid, type) => {
    if (type === 'texts') return Promise.resolve(texts)
    if (type === 'cards') return Promise.resolve(cards)
    if (type === 'creators') return Promise.resolve(creators)
    if (type === 'location-neighbors') return Promise.resolve(neighbors)
    return Promise.resolve([])
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/stories/story-123/edit']}>
      <Routes>
        <Route path="/stories/:uuid/edit" element={<StoryEditorPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function gotoTab(label) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(label, 'i') }))
}

describe('StoryEditorPage card shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue(STORY)
    createEntity.mockResolvedValue({ status: 'CREATED' })
    updateEntity.mockResolvedValue({ status: 'UPDATED' })
    mockLists()
  })

  it('opens the card form from a card id in an entity table', async () => {
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle('Open card'))

    // The modal now edits the cards entity, not the neighbour.
    expect(await screen.findByDisplayValue('x.png')).toBeInTheDocument()
  })

  it('reports a card id that no card carries', async () => {
    mockLists({ cards: [{ uuid: 'card-2', idCard: 42 }] })
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle('Open card'))
    expect(await screen.findByText('Card #9 not found')).toBeInTheDocument()
  })

  it('duplicates a card into a card back, cloning both texts with a BIS suffix', async () => {
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))

    await waitFor(() => expect(screen.getByText(/Card Back #10 created/)).toBeInTheDocument())

    // Two ids above the current max text id (102): 103 for the title, 104 for the description.
    expect(createEntity).toHaveBeenCalledWith('story-123', 'texts',
      expect.objectContaining({ idText: 103, lang: 'en', shortText: 'Gate BIS', longText: 'The gate BIS' }))
    // The italian row of the same text has no short text and a null long text.
    expect(createEntity).toHaveBeenCalledWith('story-123', 'texts',
      expect.objectContaining({ idText: 103, lang: 'it', shortText: 'BIS', longText: '' }))
    // The new card keeps every other field of the source and drops its identity.
    expect(createEntity).toHaveBeenCalledWith('story-123', 'cards',
      expect.objectContaining({ idCard: 10, idTextTitle: 103, idTextDescription: 104, urlImage: 'x.png' }))
    expect(createEntity).toHaveBeenCalledWith('story-123', 'cards',
      expect.not.objectContaining({ uuid: 'card-1' }))
    expect(updateEntity).toHaveBeenCalledWith('story-123', 'location-neighbors', 'nb-1', { idCardBack: 10 })
  })

  it('invents the BIS text when the source text id has no rows at all', async () => {
    mockLists({
      cards: [{ ...CARD, idTextTitle: 900, idTextDescription: undefined }],
      texts: [],
    })
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))

    await waitFor(() => expect(screen.getByText(/Card Back #10 created/)).toBeInTheDocument())
    expect(createEntity).toHaveBeenCalledWith('story-123', 'texts',
      expect.objectContaining({ idText: 1, lang: 'en', shortText: 'BIS', longText: '' }))
    // No description text id on the source → the new card keeps a null description.
    expect(createEntity).toHaveBeenCalledWith('story-123', 'cards',
      expect.objectContaining({ idCard: 10, idTextTitle: 1, idTextDescription: null }))
  })

  it('shows no duplicate action for a neighbour that has no source card', async () => {
    mockLists({ neighbors: [{ uuid: 'nb-2', id: 2, idCardBack: null }] })
    renderPage()
    await gotoTab('Loc Neighbors')

    expect(await screen.findByText('Card Back')).toBeInTheDocument()
    expect(screen.queryByTitle(/Duplicate the Card as Card Back/i)).not.toBeInTheDocument()
  })

  it('reports a duplicate whose source card is gone, and a failure of the clone', async () => {
    mockLists({ cards: [{ uuid: 'card-9', idCard: 77 }] })
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))
    expect(await screen.findByText('Card #9 not found')).toBeInTheDocument()
  })

  it('surfaces the error when creating the BIS texts fails', async () => {
    createEntity.mockRejectedValue(new Error('texts are read-only'))
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))
    expect(await screen.findByText(/Duplicate Card Back failed: texts are read-only/)).toBeInTheDocument()
  })
})
