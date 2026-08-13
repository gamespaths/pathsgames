import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import CardsFastEditPage from '../../pages/story/CardsFastEditPage'
import * as storyApi from '../../api/storyApi'

vi.mock('../../api/storyApi')

/**
 * Writing texts from the cards grid: the generator, which allocates the next free
 * id and saves english only, and the editor, which rewrites both languages of an
 * existing id — creating the row that is missing rather than failing on it.
 */

const STORY_UUID = 'story-uuid-1234'

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

function mockApi({ story = {}, cards = [], texts = [], creators = [] } = {}) {
  storyApi.getStory.mockResolvedValue({ uuid: STORY_UUID, ...story })
  storyApi.listEntities.mockImplementation((_uuid, type) => {
    if (type === 'cards')    return Promise.resolve(cards)
    if (type === 'texts')    return Promise.resolve(texts)
    if (type === 'creators') return Promise.resolve(creators)
    return Promise.resolve([])
  })
  storyApi.updateEntity.mockResolvedValue({})
  storyApi.createEntity.mockResolvedValue({})
}

describe('CardsFastEditPage text writing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates the first english-only text and inherits the first creator of the story', async () => {
    mockApi({
      story: {},   // neither idCreator nor idTextCopyright
      cards: [{ uuid: 'card-1', idCard: 1 }],
      creators: [{ uuid: 'cr-1', idCreator: 2 }],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    // An empty Title Text cell opens the list selector; from there, "New" generates one.
    await userEvent.click(screen.getAllByTitle('—')[0])
    const selector = (await screen.findByText('Fast Text Selector')).closest('.pg-modal')
    await userEvent.click(within(selector).getByRole('button', { name: /New/i }))
    await userEvent.type(await screen.findByPlaceholderText('Insert text value'), 'Gate')
    await userEvent.click(within(
      screen.getByPlaceholderText('Insert text value').closest('.pg-modal')
    ).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(storyApi.createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 1, lang: 'en', shortText: 'Gate', idCreator: 2, idTextCopyright: null })))
    // english only: the generator never writes the italian row
    expect(storyApi.createEntity).toHaveBeenCalledTimes(1)
  })

  it('rewrites the english row of an existing text and creates the missing italian one', async () => {
    mockApi({
      story: { idCreator: 9, idTextCopyright: 77 },
      cards: [{ uuid: 'card-1', idCard: 1, idTextTitle: 5 }],
      texts: [{ uuid: 't1', id: 5, idText: 5, lang: 'en', shortText: 'Gate', longText: 'The gate' }],
      creators: [{ uuid: 'cr-1', idCreator: 2 }],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    await userEvent.click(screen.getByTitle('#5 Gate'))
    await userEvent.type(await screen.findByLabelText('it-short'), 'Cancello')
    await userEvent.click(screen.getByRole('button', { name: /Save Text/i }))

    // english: the row exists, so it is updated in place with the story's own copyright/creator
    await waitFor(() => expect(storyApi.updateEntity).toHaveBeenCalledWith(STORY_UUID, 'texts', 't1',
      expect.objectContaining({ idText: 5, lang: 'en', idTextCopyright: 77, idCreator: 9 })))
    // italian: no row yet, so it is created
    expect(storyApi.createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 5, lang: 'it', shortText: 'Cancello', idCreator: 9 }))
  })

  it('numbers a generated text above the highest existing id', async () => {
    mockApi({
      story: { idCreator: 9, idTextCopyright: 77 },
      cards: [{ uuid: 'card-1', idCard: 1 }],
      texts: [{ uuid: 't1', id: 40, idText: 40, lang: 'en', shortText: 'Old' }],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    await userEvent.click(screen.getAllByTitle('—')[0])
    const selector = (await screen.findByText('Fast Text Selector')).closest('.pg-modal')
    await userEvent.click(within(selector).getByRole('button', { name: /New/i }))
    await userEvent.type(await screen.findByPlaceholderText('Insert text value'), 'Cellar')
    await userEvent.click(within(
      screen.getByPlaceholderText('Insert text value').closest('.pg-modal')
    ).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(storyApi.createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 41, idTextCopyright: 77, idCreator: 9 })))
  })
})
