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

  it('shows error alert when load fails and can close it', async () => {
    storyApi.getStory.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => expect(screen.queryByText(/Loading cards/i)).not.toBeInTheDocument())
  })

  it('shows No cards found when cards are empty', async () => {
    storyApi.listEntities.mockImplementation((_uuid, type) => {
      if (type === 'texts') return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/No cards found/i)).toBeInTheDocument())
  })

  it('calls Save All and shows success for dirty rows', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const inputs = screen.getAllByLabelText('Copyright Link')
    fireEvent.change(inputs[0], { target: { value: 'https://new.com' } })
    const saveAllBtn = screen.getByRole('button', { name: /Save All/i })
    fireEvent.click(saveAllBtn)
    await waitFor(() => expect(storyApi.updateEntity).toHaveBeenCalled())
  })

  it('shows filter and filters cards when typing', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const filterInput = screen.getByPlaceholderText('Filter cards…')
    fireEvent.change(filterInput, { target: { value: 'hello' } })
    // After filtering by "hello", card 1 (with text "Hello Card") should remain
    expect(screen.queryByText(/No cards match the filter/i)).not.toBeInTheDocument()
  })

  it('shows no match message when filter matches nothing', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const filterInput = screen.getByPlaceholderText('Filter cards…')
    fireEvent.change(filterInput, { target: { value: 'zzznomatch' } })
    await waitFor(() => expect(screen.getByText(/No cards match the filter/i)).toBeInTheDocument())
  })

  it('shows delete button for unused cards and confirms delete', async () => {
    storyApi.deleteEntity = vi.fn().mockResolvedValue({})
    // Card uuid-2 has idCard=2 which is not in usedCardIds (story.idCard is undefined)
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const deleteButtons = screen.getAllByTitle('Delete unused card')
    expect(deleteButtons.length).toBeGreaterThan(0)
    fireEvent.click(deleteButtons[0])
    // Confirmation modal should appear
    await waitFor(() => expect(screen.getAllByText(/Delete Card/i).length).toBeGreaterThan(0))
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(storyApi.deleteEntity).toHaveBeenCalled())
  })

  it('cancels delete confirmation', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const deleteButtons = screen.getAllByTitle('Delete unused card')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => expect(screen.getAllByText(/Delete Card/i).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument())
  })

  it('opens card modal on ID badge click', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const idBadges = screen.getAllByTitle('Edit full card')
    fireEvent.click(idBadges[0])
    // EntityForm should appear (rendered in modal)
    await waitFor(() => expect(screen.getAllByTitle(/Edit full card/i).length).toBeGreaterThan(0))
  })

  it('shows unsaved count label when rows are dirty', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const inputs = screen.getAllByLabelText('Image URL')
    fireEvent.change(inputs[0], { target: { value: 'https://new-image.png' } })
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()
  })

  it('shows save error when updateEntity fails', async () => {
    storyApi.updateEntity.mockRejectedValue(new Error('Save failed'))
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const inputs = screen.getAllByLabelText('Copyright Link')
    fireEvent.change(inputs[0], { target: { value: 'https://changed.com' } })
    const saveBtns = screen.getAllByTitle('Save this card')
    fireEvent.click(saveBtns[0])
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument())
  })

  it('opens FastTextCreatorModal when clicking a title text button with existing id', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Card 1 has idTextTitle=10 — button label is "#10 Hello Card", clicking opens creator
    const titleBtn = screen.getByTitle('#10 Hello Card')
    fireEvent.click(titleBtn)
    // FastTextCreatorModal opens (modal with Save Text button)
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
  })

  it('opens the creator modal from the Copyright (+) button to create a replacing text', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // The Copyright Text cell exposes a (+) button (one per card row)
    const plusBtns = screen.getAllByTitle('Create a new text and use it as this Copyright Text')
    fireEvent.click(plusBtns[0])
    // FastTextCreatorModal opens in create mode
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
  })

  it('opens FastTextSelectorModal and selects a text (covers onSelect callback)', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards') return Promise.resolve([
        { uuid: 'card-uuid-3', idCard: 3, idTextTitle: null, idTextDescription: null, idTextCopyright: null, linkCopyright: '', urlImage: '', idCreator: null },
      ])
      if (type === 'texts') return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Find the "—" title button for the card with no text
    const dashButtons = screen.getAllByTitle('—')
    fireEvent.click(dashButtons[0])
    // FastTextSelectorModal opens
    await waitFor(() => expect(screen.getByText(/Fast Text Selector/i)).toBeInTheDocument())
    // Click "Select" on the first text row
    const selectBtns = screen.getAllByText('Select')
    fireEvent.click(selectBtns[0])
    // After selecting, the modal should close
    await waitFor(() => expect(screen.queryByText(/Fast Text Selector/i)).not.toBeInTheDocument())
  })

  it('opens creator selector and selects creator (covers onSelect/onClose callbacks)', async () => {
    // Add a text entry matching the creator's idText to populate creator options with label
    const mockCreatorsWithText = [{ uuid: 'cr1', idCreator: 1, idText: 99 }]
    const mockTextsWithCreator = [...mockTexts, { uuid: 'tc99', idText: 99, lang: 'en', shortText: 'Creator Name' }]
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards') return Promise.resolve(mockCards)
      if (type === 'texts') return Promise.resolve(mockTextsWithCreator)
      if (type === 'creators') return Promise.resolve(mockCreatorsWithText)
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const creatorCells = screen.getAllByRole('button').filter(b =>
      b.className.includes('pg-btn-ghost') && (b.textContent === '1' || b.textContent === '—') && b.getAttribute('style')?.includes('0.7rem')
    )
    fireEvent.click(creatorCells[0])
    await waitFor(() => expect(screen.getByText('Select Creator')).toBeInTheDocument())
    // Click Select on the creator option (modal should have it)
    const selectBtns = screen.queryAllByText('Select')
    if (selectBtns.length > 0) {
      fireEvent.click(selectBtns[0])
      await waitFor(() => expect(screen.queryByText('Select Creator')).not.toBeInTheDocument())
    }
  })

  it('opens PathsOptionsSelectorModal (creator selector) when clicking creator button', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // The creator cells show buttons with getCreatorLabel title — find any creator cell button
    // The first card has idCreator=1, second has null (shown as "—")
    // Find the button that shows creator value in the table (look for visible creator text)
    const creatorCells = screen.getAllByRole('button').filter(b =>
      b.className.includes('pg-btn-ghost') && (b.textContent === '1' || b.textContent === '—') && b.getAttribute('style')?.includes('0.7rem')
    )
    expect(creatorCells.length).toBeGreaterThan(0)
    fireEvent.click(creatorCells[0])
    await waitFor(() => expect(screen.getByText('Select Creator')).toBeInTheDocument())
  })

  it('closes error alert on close click', async () => {
    storyApi.getStory.mockRejectedValue(new Error('Load error'))
    renderPage()
    await waitFor(() => expect(screen.queryByText(/Loading cards/i)).not.toBeInTheDocument())
  })

  it('FastTextCreatorModal onClose callback updates row when result has idText', async () => {
    storyApi.createEntity = vi.fn().mockResolvedValue({ idText: 10 })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Open FastTextCreatorModal for card 1's title field (idTextTitle=10, text="Hello Card")
    const titleBtn = screen.getByTitle('#10 Hello Card')
    fireEvent.click(titleBtn)
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
    // The idText is pre-filled with 10 (initialTextId), storyUuid is set → canSubmit=true
    fireEvent.click(screen.getByRole('button', { name: /Save Text/i }))
    // After save, onClose is called with result → updateRow + setActiveTextCreator(null)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Save Text/i })).not.toBeInTheDocument())
  })

  it('FastTextCreatorModal onClose with null result just closes modal (no updateRow)', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const titleBtn = screen.getByTitle('#10 Hello Card')
    fireEvent.click(titleBtn)
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
    // Click Cancel → onClose(null) → setActiveTextCreator(null)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Save Text/i })).not.toBeInTheDocument())
  })

  it('EntityForm onCancel closes the card modal', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const idBadges = screen.getAllByTitle('Edit full card')
    fireEvent.click(idBadges[0])
    // EntityForm should appear
    await waitFor(() => expect(screen.getAllByTitle(/Edit full card/i).length).toBeGreaterThan(0))
    // Click Cancel in EntityForm → setCardModal(null)
    const cancelBtns = screen.queryAllByRole('button', { name: /cancel/i })
    if (cancelBtns.length > 0) {
      fireEvent.click(cancelBtns[cancelBtns.length - 1])
    }
  })

  it('PathsOptionsSelectorModal onSelect callback updates creator field and closes', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const creatorCells = screen.getAllByRole('button').filter(b =>
      b.className.includes('pg-btn-ghost') && (b.textContent === '1' || b.textContent === '—') && b.getAttribute('style')?.includes('0.7rem')
    )
    if (creatorCells.length === 0) return
    fireEvent.click(creatorCells[0])
    await waitFor(() => expect(screen.getByText('Select Creator')).toBeInTheDocument())
    // Click Select on a creator option
    const selectBtns = screen.queryAllByText('Select')
    if (selectBtns.length > 0) {
      fireEvent.click(selectBtns[0])
      // onSelect callback updates the row and closes the modal
      await waitFor(() => expect(screen.queryByText('Select Creator')).not.toBeInTheDocument())
    }
  })

  it('shows entity-type badge for a card referenced by an entity', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards')    return Promise.resolve(mockCards)
      if (type === 'texts')    return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      // Card 1 is linked to a location
      if (type === 'locations') return Promise.resolve([{ uuid: 'loc1', idCard: 1 }])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    expect(screen.getByTitle('Linked to Locations')).toBeInTheDocument()
  })

  it('treats a card used as a location-neighbor return card (idCardBack) as referenced', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards')    return Promise.resolve(mockCards)
      if (type === 'texts')    return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      // Card 2 is referenced only via idCardBack on a neighbor (not idCard)
      if (type === 'location-neighbors') return Promise.resolve([{ uuid: 'n1', idCard: 99, idCardBack: 2 }])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Card 2 must show the Location Neighbors badge, not the "unused" delete button
    expect(screen.getByTitle('Linked to Location Neighbors')).toBeInTheDocument()
    // Only card 1 stays unused
    expect(screen.getAllByTitle('Delete unused card').length).toBe(1)
  })

  it('does not duplicate the neighbor badge when a card matches both idCard and idCardBack', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards')    return Promise.resolve(mockCards)
      if (type === 'texts')    return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve(mockCreators)
      // Card 1 referenced via idCard, card 1 also as idCardBack on another neighbor
      if (type === 'location-neighbors') return Promise.resolve([
        { uuid: 'n1', idCard: 1, idCardBack: 5 },
        { uuid: 'n2', idCard: 7, idCardBack: 1 },
      ])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    expect(screen.getAllByTitle('Linked to Location Neighbors').length).toBe(1)
  })

  it('shows delete button in Entity column for unreferenced cards', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // No ref entities in default mock → both cards unused
    expect(screen.getAllByTitle('Delete unused card').length).toBe(2)
    expect(screen.getAllByTitle('Card not referenced by any entity').length).toBe(2)
  })

  it('renders open-link buttons enabled only when a URL is present', async () => {
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Card 1 has linkCopyright set, card 2 is empty
    const links = screen.getAllByLabelText('Open Copyright Link')
    expect(links[0]).toHaveAttribute('href', 'http://example.com')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[1]).not.toHaveAttribute('href')
  })

  it('filters cards by entity type via the Entity dropdown', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards')     return Promise.resolve(mockCards)
      if (type === 'texts')     return Promise.resolve(mockTexts)
      if (type === 'creators')  return Promise.resolve(mockCreators)
      if (type === 'locations') return Promise.resolve([{ uuid: 'loc1', idCard: 1 }])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    const entitySelect = screen.getByLabelText('Filter by entity type')
    // Select "Locations" → only card 1 (linked to a location) remains
    fireEvent.change(entitySelect, { target: { value: 'locations' } })
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.queryByText('#2')).not.toBeInTheDocument()
    // Select "Non collegate" → only card 2 (unlinked) remains
    fireEvent.change(entitySelect, { target: { value: '__none__' } })
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.queryByText('#1')).not.toBeInTheDocument()
    // Back to "Tutti" → both shown
    fireEvent.change(entitySelect, { target: { value: '' } })
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })

  it('shows alert badge when title and desc text id are the same', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards') return Promise.resolve([
        { uuid: 'card-uuid-5', idCard: 5, idTextTitle: 10, idTextDescription: 10, idTextCopyright: null, linkCopyright: '', urlImage: '', idCreator: null },
      ])
      if (type === 'texts') return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve([])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // The alert button (exclamation triangle) should appear in the Desc Text column
    expect(screen.getByTitle(/Same ID as Title Text/i)).toBeInTheDocument()
  })

  it('clicking split-desc alert opens splitDescCreator modal and close with result updates desc', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards') return Promise.resolve([
        { uuid: 'card-uuid-5', idCard: 5, idTextTitle: 10, idTextDescription: 10, idTextCopyright: null, linkCopyright: '', urlImage: '', idCreator: null },
      ])
      if (type === 'texts') return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve([])
      return Promise.resolve([])
    })
    storyApi.createEntity = vi.fn().mockResolvedValue({ idText: 99 })
    storyApi.updateEntity.mockResolvedValue({})
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    // Click the alert button to open splitDescCreator modal
    const alertBtn = screen.getByTitle(/Same ID as Title Text/i)
    fireEvent.click(alertBtn)
    // The splitDescCreator FastTextCreatorModal should appear
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
    // Submit to trigger onClose with result → updateRow + doSave
    fireEvent.click(screen.getByRole('button', { name: /Save Text/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Save Text/i })).not.toBeInTheDocument())
  })

  it('clicking split-desc alert and cancelling closes the modal without updating', async () => {
    storyApi.listEntities.mockImplementation((uuid, type) => {
      if (type === 'cards') return Promise.resolve([
        { uuid: 'card-uuid-5', idCard: 5, idTextTitle: 10, idTextDescription: 10, idTextCopyright: null, linkCopyright: '', urlImage: '', idCreator: null },
      ])
      if (type === 'texts') return Promise.resolve(mockTexts)
      if (type === 'creators') return Promise.resolve([])
      return Promise.resolve([])
    })
    renderPage()
    await waitFor(() => screen.getByText(/Cards Fast Edit/i))
    fireEvent.click(screen.getByTitle(/Same ID as Title Text/i))
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Text/i })).toBeInTheDocument())
    // Cancel → onClose(null) → setSplitDescCreator(null)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Save Text/i })).not.toBeInTheDocument())
  })
})
