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
 * Story-editor flows over legacy-shaped data: cards keyed by `id_card` rather than
 * `idCard`, a keys entity whose only text is its description, and a text edited
 * (rather than generated) from inside the entity form.
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

function mockLists(overrides = {}, story = {}) {
  getStory.mockResolvedValue({ uuid: STORY_UUID, author: 'Author', ...story })
  listEntities.mockImplementation((_uuid, type) => Promise.resolve(overrides[type] ?? []))
}

async function gotoTab(label) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${label}`, 'i') }))
}

/** Generates a text through the fast generator behind a text selector. */
async function generateText(selectorTitle, value) {
  await userEvent.click(screen.getByTitle(selectorTitle))
  await userEvent.type(await screen.findByPlaceholderText('Insert text value'), value)
  const generator = screen.getByPlaceholderText('Insert text value').closest('.pg-modal')
  await userEvent.click(within(generator).getByRole('button', { name: 'Save' }))
}

describe('StoryEditorPage over legacy-shaped data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEntity.mockResolvedValue({ status: 'CREATED' })
    updateEntity.mockResolvedValue({ status: 'UPDATED' })
    mockLists()
  })

  it('builds a keys card from the description text alone', async () => {
    mockLists({ creators: [{ uuid: 'cr-1', idCreator: 2 }] }, { idCreator: 6, idTextCopyright: 8 })
    renderPage()
    await gotoTab('Keys')
    await userEvent.click(await screen.findByRole('button', { name: /Add Key/i }))

    await generateText('New Desc Text ID', 'A key description')
    await screen.findByText('Text #1 saved')

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    // A keys form names name+value+idTextDescription: the description is the title too.
    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'cards', {
      idCard: 1, idTextName: 1, idTextTitle: 1, idTextDescription: 1,
      idTextCopyright: 8, idCreator: 6,
    }))
  })

  it('duplicates a card back from a card keyed by id_card with only a description text', async () => {
    mockLists({
      cards: [{ uuid: 'card-1', id_card: 4, idTextDescription: 20, awesomeIcon: 'fa-key' }],
      texts: [{ uuid: 't20', id: 20, idText: 20, lang: 'en', shortText: 'Desc', longText: 'Long' }],
      'location-neighbors': [{ uuid: 'nb-1', id: 1, idCard: 4, idCardBack: null }],
    })
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))

    // No title text on the source, so only the description gets a BIS clone…
    await waitFor(() => expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 21, shortText: 'Desc BIS', longText: 'Long BIS' })))
    // …and the new card keeps the source's null title while taking the next card id.
    expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'cards',
      expect.objectContaining({ idCard: 5, idTextTitle: null, idTextDescription: 21, awesomeIcon: 'fa-key' }))
    expect(await screen.findByText(/Card Back #5 created \(BIS texts #—\/#21\)/)).toBeInTheDocument()
  })

  it('numbers the duplicated card #1 when no card carries a usable id', async () => {
    mockLists({
      cards: [{ uuid: 'card-1', idCard: 'abc', idTextTitle: 3 }],
      texts: [],
      'location-neighbors': [{ uuid: 'nb-1', id: 1, idCard: 'abc', idCardBack: null }],
    })
    renderPage()
    await gotoTab('Loc Neighbors')

    await userEvent.click(await screen.findByTitle(/Duplicate the Card as Card Back/i))

    expect(await screen.findByText('This neighbor has no source Card to duplicate')).toBeInTheDocument()
  })

  it('rewrites the english row and creates the italian one when a text is edited from the form', async () => {
    mockLists({
      texts: [{ uuid: 't5', id: 5, idText: 5, lang: 'en', shortText: 'Gate', longText: 'The gate' }],
      locations: [{ uuid: 'loc-1', id: 1, idTextName: 5 }],
    }, { idCreator: 9, idTextCopyright: 77 })
    renderPage()
    await gotoTab('Locations')

    // Open the row, then the name text — which already exists, so the editor opens.
    const row = (await screen.findByTitle('loc-1')).closest('tr')
    await userEvent.click(row.querySelectorAll('td:last-child button')[0])
    await userEvent.click(screen.getByTitle('Select Name Text ID'))

    await userEvent.type(await screen.findByLabelText('it-short'), 'Cancello')
    await userEvent.click(screen.getByRole('button', { name: /Save Text/i }))

    await waitFor(() => expect(updateEntity).toHaveBeenCalledWith(STORY_UUID, 'texts', 't5',
      expect.objectContaining({ idText: 5, lang: 'en', idTextCopyright: 77, idCreator: 9 })))
    expect(createEntity).toHaveBeenCalledWith(STORY_UUID, 'texts',
      expect.objectContaining({ idText: 5, lang: 'it', shortText: 'Cancello' }))
  })
})
