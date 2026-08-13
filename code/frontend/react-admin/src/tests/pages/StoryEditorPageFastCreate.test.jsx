import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { getStory, listEntities, createEntity, updateEntity } from '../../api/storyApi'

/**
 * The "fast create" shortcuts of the story editor — a text and a card made from
 * inside the entity form, without leaving it. Both derive the new id from what the
 * story already holds, and both fall back to the story's own creator and copyright
 * text when neither the entity nor the story names one.
 */

const STORY_UUID = 'story-123'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/stories/${STORY_UUID}/edit`]}>
      <Routes>
        <Route path="/stories/:uuid/edit" element={<StoryEditorPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function mockLists({ story = {}, cards = [], texts = [], creators = [] } = {}) {
  getStory.mockResolvedValue({ uuid: STORY_UUID, author: 'Author', ...story })
  listEntities.mockImplementation((_uuid, type) => {
    if (type === 'cards')    return Promise.resolve(cards)
    if (type === 'texts')    return Promise.resolve(texts)
    if (type === 'creators') return Promise.resolve(creators)
    return Promise.resolve([])
  })
}

async function openLocationForm() {
  await userEvent.click(await screen.findByRole('button', { name: /^Locations/i }))
  await userEvent.click(await screen.findByRole('button', { name: /Add Location/i }))
}

/** Generates a brand-new name text through the fast generator of the form. */
async function generateNameText(value) {
  await userEvent.click(screen.getByTitle('New Name Text ID'))
  await userEvent.type(await screen.findByPlaceholderText('Insert text value'), value)
  const generator = screen.getByPlaceholderText('Insert text value').closest('.pg-modal')
  await userEvent.click(within(generator).getByRole('button', { name: 'Save' }))
}

describe('StoryEditorPage fast create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEntity.mockResolvedValue({ status: 'CREATED' })
    updateEntity.mockResolvedValue({ status: 'UPDATED' })
    mockLists()
  })

  it('refuses to create a card when the form names no text id', async () => {
    renderPage()
    await openLocationForm()

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    expect(await screen.findByText(/A text id is required to create a fast card/)).toBeInTheDocument()
    expect(createEntity).not.toHaveBeenCalled()
  })

  it('numbers the first generated text #1 and falls back to the first creator of the story', async () => {
    mockLists({
      story: {},   // the story names neither a creator nor a copyright text
      creators: [{ uuid: 'cr-0', idCreator: null }, { uuid: 'cr-1', idCreator: 4 }],
    })
    renderPage()
    await openLocationForm()

    await generateNameText('The Gate')

    // Generated texts are english-only, and inherit the story creator — here the
    // first creator row that actually carries an id, since the story names none.
    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts', {
      id: 1, idText: 1, lang: 'en',
      shortText: 'The Gate', longText: 'The Gate',
      idTextCopyright: null, idCreator: 4,
    }))
    expect(createEntity).toHaveBeenCalledTimes(1)   // no italian row for a generated text
    expect(await screen.findByText('Text #1 saved')).toBeInTheDocument()
  })

  it('creates the card from the generated text, starting the card ids at 1', async () => {
    mockLists({
      story: {},
      creators: [{ uuid: 'cr-1', idCreator: 4 }],
    })
    renderPage()
    await openLocationForm()
    await generateNameText('The Gate')
    await screen.findByText('Text #1 saved')

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'cards', {
      idCard: 1,
      idTextName: 1,
      idTextTitle: 1,
      idTextDescription: 1,
      idTextCopyright: 33,   // the documented default when the story has none
      idCreator: 4,
    }))
    expect(await screen.findByText('Card #1 created')).toBeInTheDocument()
  })

  it('numbers a new text and card above the highest existing id, preferring the story creator', async () => {
    mockLists({
      story: { idCreator: 9, idTextCopyright: 77 },
      texts: [{ uuid: 't1', id: 5, idText: 5, lang: 'en', shortText: 'Old' },
              { uuid: 't2', id: 12, idText: 12, lang: 'en', shortText: 'Newer' }],
      cards: [{ uuid: 'c1', id_card: 3 }, { uuid: 'c2', idCard: 8 }, { uuid: 'c3' }],
      creators: [{ uuid: 'cr-1', idCreator: 4 }],
    })
    renderPage()
    await openLocationForm()

    await generateNameText('The Cellar')

    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 13, idTextCopyright: 77, idCreator: 9 })))

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'cards', {
      idCard: 9,
      idTextName: 13,
      idTextTitle: 13,
      idTextDescription: 13,
      idTextCopyright: 77,
      idCreator: 9,
    }))
  })

})
