import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import CardsFastEditPage from '../../pages/story/CardsFastEditPage'
import * as storyApi from '../../api/storyApi'

vi.mock('../../api/storyApi')

/**
 * The fast-edit grid against cards that carry almost nothing: no idCard (only the
 * PK id), no texts, no creator, no image. Plus the story-level reference, which is
 * the one card link that does not come from an entity list.
 */

const STORY_UUID = 'story-uuid-1234'

const BARE_CARD = { uuid: 'card-bare', id: 4 }   // no idCard, no texts, no creator, no urls

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

function mockApi({ story = { uuid: STORY_UUID, idCard: 4 }, cards = [BARE_CARD], texts = [], creators = [], refs = {} } = {}) {
  storyApi.getStory.mockResolvedValue(story)
  storyApi.listEntities.mockImplementation((_uuid, type) => {
    if (type === 'cards')    return Promise.resolve(cards)
    if (type === 'texts')    return Promise.resolve(texts)
    if (type === 'creators') return Promise.resolve(creators)
    return Promise.resolve(refs[type] ?? [])
  })
  storyApi.updateEntity.mockResolvedValue({})
}

describe('CardsFastEditPage with bare cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  it('titles the page by uuid, keys the row by the PK id and marks the story reference', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())
    expect(screen.getByText(new RegExp(STORY_UUID.slice(0, 8)))).toBeInTheDocument()
    expect(screen.getByText('#4')).toBeInTheDocument()              // idCard ?? id
    expect(screen.getByTitle(/Linked to Story/i)).toBeInTheDocument()
  })

  it('renders empty inputs and a disabled link button when the card has no urls', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    const urlInput = screen.getAllByPlaceholderText('https://…')[1]
    expect(urlInput).toHaveValue('')

    const noLink = screen.getAllByTitle('No link')[0]
    fireEvent.click(noLink)   // href-less anchor: the click is swallowed
    expect(noLink).toBeInTheDocument()
  })

  it('labels an unknown creator by id and a missing one with a dash', async () => {
    mockApi({ cards: [{ ...BARE_CARD, idCreator: 7 }, { uuid: 'card-2', idCard: 5 }] })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())
    expect(screen.getByTitle('#7')).toBeInTheDocument()
    expect(screen.getAllByTitle('—').length).toBeGreaterThan(0)
  })

  it('sends nulls for every field left blank when a bare card is saved', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    await userEvent.type(screen.getAllByPlaceholderText('https://…')[1], 'http://img')
    await userEvent.click(screen.getByTitle('Save this card'))

    await waitFor(() => expect(storyApi.updateEntity).toHaveBeenCalledWith(
      STORY_UUID, 'cards', 'card-bare',
      expect.objectContaining({
        idTextTitle: null, idTextDescription: null, idTextCopyright: null,
        linkCopyright: null, urlImage: 'http://img', idCreator: null,
      })))
  })

  it('reports a save failure and lets the alert be dismissed', async () => {
    storyApi.updateEntity.mockRejectedValue(new Error('card is locked'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    await userEvent.type(screen.getAllByPlaceholderText('https://…')[1], 'x')
    await userEvent.click(screen.getByTitle('Save this card'))

    expect(await screen.findByText('card is locked')).toBeInTheDocument()
    const alert = screen.getByText('card is locked').closest('.pg-alert')
    await userEvent.click(alert.querySelector('button'))
    expect(screen.queryByText('card is locked')).not.toBeInTheDocument()
  })

  it('aligns a single misaligned entity and says so in the singular', async () => {
    mockApi({
      story: { uuid: STORY_UUID },
      cards: [{ uuid: 'card-1', idCard: 1, idTextTitle: 10, idTextDescription: 11 }],
      texts: [{ uuid: 't1', idText: 10, lang: 'en', shortText: 'Title' },
              { uuid: 't2', idText: 11, lang: 'en', shortText: 'Desc' }],
      refs: { locations: [{ uuid: 'loc-1', idCard: 1, idTextDescription: 99 }] },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Cards Fast Edit/)).toBeInTheDocument())

    await userEvent.click(screen.getByTitle(/idTextDescription diverso/i))

    await waitFor(() => expect(screen.getByText('Allineate 1 entità')).toBeInTheDocument())
    expect(storyApi.updateEntity).toHaveBeenCalledWith(
      STORY_UUID, 'locations', 'loc-1', expect.objectContaining({ idTextDescription: 11 }))
  })

  it('shows the empty state when the story has no cards at all', async () => {
    mockApi({ cards: [] })
    renderPage()
    expect(await screen.findByText('No cards found for this story.')).toBeInTheDocument()
  })
})
