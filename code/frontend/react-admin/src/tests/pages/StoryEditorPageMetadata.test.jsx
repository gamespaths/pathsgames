import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
import { getStory, listEntities, validateStory } from '../../api/storyApi'

// A story with *every* selector field populated, so the "Clear" buttons have
// something to clear and the displayed value visibly changes.
const FULL_STORY = {
  uuid: 'story-123',
  title: 'Test Story',
  author: 'Author',
  category: 'Fantasy',
  group: 'GroupA',
  visibility: 'DRAFT',
  priority: 10,
  peghi: 4,
  versionMin: '0.1',
  versionMax: '0.9',
  linkCopyright: 'http://old.example',
  idTextTitle: 101,
  idCard: 1,
  idLocationStart: 7,
  idImage: 102,
  idLocationAllPlayerComa: 7,
  idEventAllPlayerComa: 5,
  idEventEndGame: 5,
  idTextClockSingular: 101,
  idTextClockPlural: 102,
  idTextCopyright: 101,
  idCreator: 3,
}

const MOCK_TEXTS = [
  { idText: 101, lang: 'en', shortText: 'Title Text' },
  { idText: 102, lang: 'en', shortText: 'Image Text' },
]
const MOCK_CREATORS = [{ uuid: 'cr-1', idCreator: 3, idTextName: 101 }]
const MOCK_CARDS = [{ uuid: 'card-1', idCard: 1, idTextTitle: 101 }]
const MOCK_LOCATIONS = [{ uuid: 'loc-1', idLocation: 7, idTextName: 101 }]
const MOCK_EVENTS = [{ uuid: 'ev-1', idEvent: 5, idTextName: 102 }]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/stories/story-123/edit']}>
      <Routes>
        <Route path="/stories/:uuid/edit" element={<StoryEditorPage />} />
      </Routes>
    </MemoryRouter>
  )
}

/** The metadata inputs have plain <label> tags with no htmlFor, so we walk up
 *  from the label text to the wrapper div and grab the control inside. */
function controlFor(labelText, tag = 'input') {
  return screen.getByText(labelText).parentElement.querySelector(tag)
}

describe('StoryEditorPage — metadata form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue({ ...FULL_STORY })
    listEntities.mockImplementation((uuid, type) => {
      if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
      if (type === 'creators') return Promise.resolve(MOCK_CREATORS)
      if (type === 'cards') return Promise.resolve(MOCK_CARDS)
      if (type === 'locations') return Promise.resolve(MOCK_LOCATIONS)
      if (type === 'events') return Promise.resolve(MOCK_EVENTS)
      return Promise.resolve([])
    })
  })

  it('edits every plain metadata field', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    fireEvent.change(controlFor('Category'), { target: { value: 'Sci-Fi' } })
    expect(screen.getByDisplayValue('Sci-Fi')).toBeInTheDocument()

    fireEvent.change(controlFor('Group'), { target: { value: 'GroupZ' } })
    expect(screen.getByDisplayValue('GroupZ')).toBeInTheDocument()

    fireEvent.change(controlFor('Visibility', 'select'), { target: { value: 'PUBLIC' } })
    expect(controlFor('Visibility', 'select')).toHaveValue('PUBLIC')

    fireEvent.change(controlFor('Priority'), { target: { value: '42' } })
    expect(controlFor('Priority')).toHaveValue(42)

    fireEvent.change(controlFor('PEGHI'), { target: { value: '7' } })
    expect(controlFor('PEGHI')).toHaveValue(7)

    fireEvent.change(controlFor('Version Min'), { target: { value: '1.0' } })
    expect(screen.getByDisplayValue('1.0')).toBeInTheDocument()

    fireEvent.change(controlFor('Version Max'), { target: { value: '2.0' } })
    expect(screen.getByDisplayValue('2.0')).toBeInTheDocument()

    fireEvent.change(controlFor('Copyright Link'), { target: { value: 'http://new.example' } })
    expect(screen.getByDisplayValue('http://new.example')).toBeInTheDocument()
  })

  it('clears every selector field on the metadata form', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    const clearTargets = [
      ['Clear Title Text ID', 'idTextTitle'],
      ['Clear Card ID', 'idCard'],
      ['Clear Start Location ID', 'idLocationStart'],
      ['Clear Image ID', 'idImage'],
      ['Clear All-Player Coma Location ID', 'idLocationAllPlayerComa'],
      ['Clear All-Player Coma Event ID', 'idEventAllPlayerComa'],
      ['Clear End Game Event ID', 'idEventEndGame'],
      ['Clear Clock (singular) Text ID', 'idTextClockSingular'],
      ['Clear Clock (plural) Text ID', 'idTextClockPlural'],
      ['Clear Copyright Text ID', 'idTextCopyright'],
      ['Clear Creator ID', 'idCreator'],
    ]

    for (const [title, fieldName] of clearTargets) {
      fireEvent.click(screen.getByTitle(title))
      await waitFor(() => {
        expect(document.querySelector(`input[name="${fieldName}"]`)).toHaveValue('')
      }, { timeout: 5000 })
    }
  }, 30000)

  it('opens the fast-text selector in list mode for every text field', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    for (const title of [
      'Select Title Text ID',
      'Select Image ID',
      'Select Clock (singular) Text ID',
      'Select Clock (plural) Text ID',
      'Select Copyright Text ID',
    ]) {
      fireEvent.click(screen.getByTitle(title))
      expect(await screen.findByText(/Fast Text Selector/i, {}, { timeout: 5000 })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByText(/Fast Text Selector/i)).not.toBeInTheDocument(), { timeout: 5000 })
    }
  }, 30000)

  it('opens the fast-text creator (generator) for every text field', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    for (const title of [
      'New Title Text ID',
      'New Image ID',
      'New Clock (singular) Text ID',
      'New Clock (plural) Text ID',
      'New Copyright Text ID',
    ]) {
      fireEvent.click(screen.getByTitle(title))
      expect(await screen.findByPlaceholderText(/Insert text value/i, {}, { timeout: 5000 })).toBeInTheDocument()
      // The generator view has no labelled Close button — dismiss via the backdrop.
      fireEvent.click(document.querySelector('.pg-modal-backdrop'))
      await waitFor(
        () => expect(screen.queryByPlaceholderText(/Insert text value/i)).not.toBeInTheDocument(),
        { timeout: 5000 }
      )
    }
  }, 30000)

  it('picks a creator from the creator options modal', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    fireEvent.click(screen.getByTitle('Select Creator ID'))
    expect(await screen.findByText('Select Creator')).toBeInTheDocument()

    const selectBtn = await screen.findByRole('button', { name: /^Select(ed)?$/ })
    fireEvent.click(selectBtn)

    await waitFor(() => expect(screen.queryByText('Select Creator')).not.toBeInTheDocument())
    expect(document.querySelector('input[name="idCreator"]')).toHaveValue('3')
  })

  it('dismisses the validation report and closes the error alert', async () => {
    validateStory.mockResolvedValue({
      valid: false,
      count: 1,
      errors: [{ entityType: 'cards', entityId: 1, field: 'idTextName', message: 'missing' }],
    })
    renderPage()
    await screen.findByDisplayValue('Author')

    fireEvent.click(screen.getByRole('button', { name: /Validate story/i }))
    expect(await screen.findByTestId('validation-report')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))
    await waitFor(() => expect(screen.queryByTestId('validation-report')).not.toBeInTheDocument())

    // Now trigger an error and close the alert via its own close handler.
    validateStory.mockRejectedValue(new Error('validator-down'))
    fireEvent.click(screen.getByRole('button', { name: /Validate story/i }))
    expect(await screen.findByText(/validator-down/i)).toBeInTheDocument()

    const alert = screen.getByText(/validator-down/i).closest('div')
    fireEvent.click(alert.querySelector('button'))
    await waitFor(() => expect(screen.queryByText(/validator-down/i)).not.toBeInTheDocument())
  })
})

describe('StoryEditorPage — the option selectors on the metadata form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue({ ...FULL_STORY })
    listEntities.mockImplementation((uuid, type) => {
      if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
      if (type === 'creators') return Promise.resolve(MOCK_CREATORS)
      if (type === 'cards') return Promise.resolve(MOCK_CARDS)
      if (type === 'locations') return Promise.resolve(MOCK_LOCATIONS)
      if (type === 'events') return Promise.resolve(MOCK_EVENTS)
      return Promise.resolve([])
    })
  })

  const SELECTORS = [
    ['Select Card ID', 'idCard', '1'],
    ['Select Start Location ID', 'idLocationStart', '7'],
    ['Select All-Player Coma Location ID', 'idLocationAllPlayerComa', '7'],
    ['Select All-Player Coma Event ID', 'idEventAllPlayerComa', '5'],
    ['Select End Game Event ID', 'idEventEndGame', '5'],
    ['Select Creator ID', 'idCreator', '3'],
  ]

  it.each(SELECTORS)('%s picks a value and closes the modal', async (title, fieldName, expected) => {
    renderPage()
    await screen.findByDisplayValue('Author')

    fireEvent.click(screen.getByTitle(title))
    // The row is already the selected one, so its button reads "Selected".
    fireEvent.click(await screen.findByRole('button', { name: /^Selected$/ }))

    await waitFor(() => {
      expect(document.querySelector(`input[name="${fieldName}"]`)).toHaveValue(expected)
    })
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument()
  })

  it('a selector closed without a choice leaves the field alone', async () => {
    renderPage()
    await screen.findByDisplayValue('Author')

    fireEvent.click(screen.getByTitle('Select Card ID'))
    fireEvent.click(await screen.findByRole('button', { name: /^Close$/ }))

    await waitFor(() => {
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument()
    })
    expect(document.querySelector('input[name="idCard"]')).toHaveValue('1')
  })
})

describe('StoryEditorPage — a story with no selector field set', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStory.mockResolvedValue({ uuid: 'story-123', title: 'Bare Story' })
    listEntities.mockImplementation((uuid, type) => {
      if (type === 'texts') return Promise.resolve(MOCK_TEXTS)
      if (type === 'creators') return Promise.resolve(MOCK_CREATORS)
      if (type === 'cards') return Promise.resolve(MOCK_CARDS)
      if (type === 'locations') return Promise.resolve(MOCK_LOCATIONS)
      if (type === 'events') return Promise.resolve(MOCK_EVENTS)
      return Promise.resolve([])
    })
  })

  it('every selector renders empty rather than undefined', async () => {
    renderPage()
    await waitFor(() => expect(document.querySelector('input[name="idCard"]')).toBeInTheDocument())

    for (const name of ['idCard', 'idLocationStart', 'idLocationAllPlayerComa',
      'idEventAllPlayerComa', 'idEventEndGame', 'idCreator']) {
      expect(document.querySelector(`input[name="${name}"]`)).toHaveValue('')
    }
  })

  it('picking a value on a bare story fills the field', async () => {
    renderPage()
    await waitFor(() => expect(document.querySelector('input[name="idCard"]')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Select End Game Event ID'))
    fireEvent.click(await screen.findByRole('button', { name: /^Select$/ }))

    await waitFor(() => {
      expect(document.querySelector('input[name="idEventEndGame"]')).toHaveValue('5')
    })
  })
})
