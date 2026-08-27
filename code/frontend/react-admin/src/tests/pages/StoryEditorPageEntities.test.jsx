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
import {
  getStory, listEntities, deleteEntity, createEntity, updateEntity, validateStory,
} from '../../api/storyApi'

/**
 * Saving and deleting through the story editor, plus the validation report — the
 * paths that also refresh the editor's reference lists (texts, locations, and the
 * nine lists the selectors read from).
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

function mockLists(overrides = {}) {
  getStory.mockResolvedValue({ uuid: STORY_UUID, author: 'Author' })
  listEntities.mockImplementation((_uuid, type) => Promise.resolve(overrides[type] ?? []))
}

/** The edit / delete buttons of a row, which the table renders without labels. */
function rowActions(rowText) {
  const cells = screen.getByText(rowText).closest('tr').querySelectorAll('td')
  const buttons = cells[cells.length - 1].querySelectorAll('button')
  return { edit: buttons[0], remove: buttons[buttons.length - 1] }
}

async function gotoTab(label) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${label}`, 'i') }))
}

describe('StoryEditorPage entity save and delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEntity.mockResolvedValue({ status: 'CREATED' })
    updateEntity.mockResolvedValue({ status: 'UPDATED' })
    deleteEntity.mockResolvedValue({ status: 'DELETED' })
    validateStory.mockResolvedValue({ valid: true, count: 0, errors: [] })
    mockLists()
  })

  it('mirrors idText onto the PK when a text row is saved, then refreshes the texts', async () => {
    mockLists({ texts: [{ uuid: 't-1', id: 42, idText: 42, lang: 'en', shortText: 'Gate' }] })
    renderPage()
    await gotoTab('Texts')

    await screen.findByText('Gate')
    await userEvent.click(rowActions('Gate').edit)
    const langInput = screen.getByDisplayValue('en')
    await userEvent.clear(langInput)
    await userEvent.type(langInput, 'it')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateEntity).toHaveBeenCalledWith(STORY_UUID, 'texts', 't-1',
      expect.objectContaining({ idText: 42, id: 42, lang: 'it' })))
    expect(await screen.findByText('texts saved')).toBeInTheDocument()
    await waitFor(() => expect(listEntities).toHaveBeenCalledWith(STORY_UUID, 'texts'))
  })

  it('refreshes the reference lists after an event is deleted', async () => {
    mockLists({ events: [{ uuid: 'ev-1', id: 1, type: 'EVENT-ONE' }] })
    renderPage()
    await gotoTab('Events')

    await screen.findByText('EVENT-ONE')
    await userEvent.click(rowActions('EVENT-ONE').remove)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(deleteEntity).toHaveBeenCalledWith(STORY_UUID, 'events', 'ev-1'))
    expect(await screen.findByText('events entity deleted')).toBeInTheDocument()
    await waitFor(() => expect(listEntities).toHaveBeenCalledWith(STORY_UUID, 'weather-rules'))
  })

  it('reports a delete failure', async () => {
    deleteEntity.mockRejectedValue(new Error('still referenced'))
    mockLists({ events: [{ uuid: 'ev-1', id: 1, type: 'EVENT-ONE' }] })
    renderPage()
    await gotoTab('Events')

    await screen.findByText('EVENT-ONE')
    await userEvent.click(rowActions('EVENT-ONE').remove)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('still referenced')).toBeInTheDocument()
  })

  it('reads a card keyed by id_card when one is opened from a table', async () => {
    mockLists({
      cards: [{ uuid: 'card-1', id_card: 3, urlImage: 'legacy.png' }],
      locations: [{ uuid: 'loc-1', id: 1, idCard: 3 }],
    })
    renderPage()
    await gotoTab('Locations')

    await userEvent.click(await screen.findByTitle('Open card'))
    expect(await screen.findByDisplayValue('legacy.png')).toBeInTheDocument()
  })

  it('renders a single validation issue in the singular and without an entity id', async () => {
    validateStory.mockResolvedValue({
      valid: false,
      count: 1,
      errors: [{ entityType: 'locations', entityId: null, field: null, message: 'orphan location' }],
    })
    renderPage()
    await screen.findByDisplayValue('Author')

    await userEvent.click(screen.getByRole('button', { name: /Validate/i }))

    const report = await screen.findByTestId('validation-report')
    expect(within(report).getByText(/1 integrity issue found/)).toBeInTheDocument()
    expect(within(report).getByTestId('validation-error')).toHaveTextContent('locations: orphan location')

    await userEvent.click(within(report).getByRole('button', { name: /Dismiss/i }))
    expect(screen.queryByTestId('validation-report')).not.toBeInTheDocument()
  })

  it('reports a validation call that fails', async () => {
    validateStory.mockRejectedValue(new Error('validator offline'))
    renderPage()
    await screen.findByDisplayValue('Author')

    await userEvent.click(screen.getByRole('button', { name: /Validate/i }))
    expect(await screen.findByText('validator offline')).toBeInTheDocument()
  })
})
