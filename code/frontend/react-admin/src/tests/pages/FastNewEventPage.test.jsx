import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FastNewEventPage from '../../pages/story/FastNewEventPage'
import * as storyApi from '../../api/storyApi'
import { SUMMARY_HIDE_MS } from '../../pages/story/FastNewEventHelpers'

vi.mock('../../api/storyApi')

const STORY_UUID = 'story-uuid-1234'
const mockStory = { uuid: STORY_UUID, author: 'TestAuthor', idCreator: 2 }
const mockTexts = [
  { uuid: 't1', idText: 10, lang: 'en', shortText: 'Forest' },
  { uuid: 't2', idText: 11, lang: 'en', shortText: 'Cave' },
]
const mockLocations = [
  { uuid: 'l1', id: 1, idTextName: 10 },
  { uuid: 'l2', id: 2, idTextName: 11 },
]
const mockKeys = [{ uuid: 'k1', name: 'DOOR', value: 'OPEN' }, { uuid: 'k2', name: 'MAP' }]

function mockLoad() {
  storyApi.getStory.mockResolvedValue(mockStory)
  storyApi.listEntities.mockImplementation((_uuid, type) => {
    if (type === 'texts') return Promise.resolve(mockTexts)
    if (type === 'locations') return Promise.resolve(mockLocations)
    if (type === 'keys') return Promise.resolve(mockKeys)
    if (type === 'cards') return Promise.resolve([{ idCard: 3 }])
    return Promise.resolve([])
  })
  let seq = 0
  storyApi.createEntity.mockImplementation((_s, type, payload) => {
    seq += 1
    const res = { uuid: `u${seq}` }
    if (type === 'cards') res.idCard = payload.idCard
    if (type === 'events' || type === 'choices') res.id = 50 + seq
    return Promise.resolve(res)
  })
  storyApi.deleteEntity.mockResolvedValue(true)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/stories/${STORY_UUID}/fast-new-event`]}>
      <Routes>
        <Route path="/stories/:uuid/fast-new-event" element={<FastNewEventPage />} />
        <Route path="/stories/:uuid/edit" element={<div>Editor page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const radio = (mode) => document.querySelector(`input[name="fast-event-mode"][value="${mode}"]`)
const type = (id, value) => fireEvent.change(document.getElementById(id), { target: { value } })
const created = (entityType) => storyApi.createEntity.mock.calls.filter(c => c[1] === entityType).map(c => c[2])

// Opens the picker next to `label` (first match unless `index`) and selects the row `value`.
async function pick(label, value, index = 0) {
  fireEvent.click(screen.getAllByTitle(`Select ${label}`)[index])
  const title = await screen.findByText(`Select ${label}`, { selector: 'h3', exact: false })
  const row = within(title.closest('.pg-modal')).getAllByText(value)[0].closest('tr')
  fireEvent.click(within(row).getByRole('button', { name: /Select/ }))
}

// The five-choice form is a large DOM: under coverage it needs more than the default 5 s.
describe('FastNewEventPage', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoad()
  })

  it('loads the story and shows the event form in effect mode', async () => {
    renderPage()
    expect(await screen.findByText(/Fast New Event — TestAuthor/)).toBeInTheDocument()
    expect(document.getElementById('event-titleEn')).toBeInTheDocument()
    expect(document.getElementById('event-type').value).toBe('NORMAL')
    expect(document.getElementById('effect-titleEn')).toBeInTheDocument()
    expect(document.getElementById('choice-0-titleEn')).toBeNull()
    expect(storyApi.listEntities).toHaveBeenCalledWith(STORY_UUID, 'locations')
    expect(storyApi.listEntities).toHaveBeenCalledWith(STORY_UUID, 'keys')
  })

  it('shows titles as inputs and descriptions as textareas, saving newlines as <br />', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    expect(document.getElementById('event-titleEn').tagName).toBe('INPUT')
    expect(document.getElementById('event-titleIt').tagName).toBe('INPUT')
    expect(document.getElementById('event-descEn').tagName).toBe('TEXTAREA')
    expect(document.getElementById('event-descIt').closest('div').className).toMatch(/md:row-span-2/)
    type('event-titleEn', 'Storm')
    type('event-descEn', 'First\nSecond')
    type('effect-titleEn', 'Wet')
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await screen.findByTestId('fast-event-summary')
    expect(created('texts').find(t => t.idText === 13).shortText).toBe('First<br />\nSecond')
  })

  it('hides the green report after a while and closes it on demand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderPage()
      await screen.findByText(/Fast New Event/)
      type('event-titleEn', 'Storm')
      type('effect-titleEn', 'Wet')
      fireEvent.click(screen.getByRole('button', { name: /Save/ }))
      expect(await screen.findByTestId('fast-event-summary')).toHaveTextContent('Event created')
      act(() => { vi.advanceTimersByTime(SUMMARY_HIDE_MS) })
      expect(screen.queryByTestId('fast-event-summary')).toBeNull()

      type('event-titleEn', 'Storm 2')
      type('effect-titleEn', 'Wet 2')
      fireEvent.click(screen.getByRole('button', { name: /Save/ }))
      await screen.findByTestId('fast-event-summary')
      fireEvent.click(screen.getByRole('button', { name: 'Close report' }))
      expect(screen.queryByTestId('fast-event-summary')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the failure report until it is closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      storyApi.createEntity.mockRejectedValue(new Error('down'))
      renderPage()
      await screen.findByText(/Fast New Event/)
      type('event-titleEn', 'Storm')
      type('effect-titleEn', 'Wet')
      fireEvent.click(screen.getByRole('button', { name: /Save/ }))
      expect(await screen.findByTestId('fast-event-summary')).toHaveTextContent('Save failed: down')
      act(() => { vi.advanceTimersByTime(SUMMARY_HIDE_MS * 2) })
      expect(screen.getByTestId('fast-event-summary')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close report' }))
      expect(screen.queryByTestId('fast-event-summary')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('switches to five choices with the radio buttons', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    fireEvent.click(radio('choice'))
    expect(document.getElementById('effect-titleEn')).toBeNull()
    expect(document.getElementById('choice-0-titleEn')).toBeInTheDocument()
    expect(document.getElementById('choice-4-titleEn')).toBeInTheDocument()
    fireEvent.click(radio('effect'))
    expect(document.getElementById('effect-titleEn')).toBeInTheDocument()
  })

  it('blocks the save when the titles are missing', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(await screen.findByText(/Event: English title is required/)).toBeInTheDocument()
    expect(storyApi.createEntity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(/English title is required/).parentElement.querySelector('button'))
    expect(screen.queryByText(/English title is required/)).toBeNull()
  })

  it('saves an event with its effect using the pickers, then shows the summary and resets', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    type('event-titleEn', 'Storm')
    type('event-titleIt', 'Tempesta')
    type('event-costEnery', '2')
    type('event-type', 'ONCE')
    type('event-keyValue', 'OPEN')
    type('event-keyOperator', '!=')
    await pick('Location', '#2 Cave')
    expect(screen.getAllByText('#2 Cave').length).toBeGreaterThan(0)
    await pick('Registry Key (condition)', 'DOOR = OPEN')

    type('effect-titleEn', 'Wet')
    type('effect-statistics', 'LIFE')
    type('effect-value', '-1')
    type('effect-target', 'ALL')
    type('effect-keyValue', 'YES')
    await pick('Registry Key to Write', 'MAP')
    await pick('Move To Location', '#1 Forest')

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    const summary = await screen.findByTestId('fast-event-summary')
    expect(summary).toHaveTextContent('Event created')

    expect(created('events')[0]).toEqual({
      idCard: 4, idTextName: 12, idSpecificLocation: 2, type: 'ONCE', costEnery: 2,
      registryKeyCondition: 'DOOR', registryValueCondition: 'OPEN', registryValueOperatorCondition: '!=',
    })
    expect(created('event-effects')[0]).toMatchObject({
      idCard: 5, idTextName: 13, statistics: 'LIFE', value: -1, target: 'ALL',
      keyToAdd: 'MAP', keyValueToAdd: 'YES', idLocation: 1,
    })
    expect(created('texts')[0]).toMatchObject({ idText: 12, lang: 'en', shortText: 'Storm', idCreator: 2 })
    // form reset after success
    expect(document.getElementById('event-titleEn').value).toBe('')
  })

  it('clears a picked value with the eraser button', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    await pick('Location', '#1 Forest')
    expect(screen.getByText('#1 Forest')).toBeInTheDocument()
    fireEvent.click(screen.getAllByTitle('Clear Location')[0])
    expect(screen.queryByText('#1 Forest')).toBeNull()
    // the picker offers no "New" shortcut
    expect(screen.queryByTitle('New Location')).toBeNull()
  })

  it('saves the filled choices with condition and effect', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    type('event-titleEn', 'Crossroad')
    fireEvent.click(radio('choice'))
    type('choice-0-priority', '1')
    type('choice-0-titleEn', 'Left')
    type('choice-0-descEn', 'Go left')
    type('choice-0-cond-type', 'KEYS')
    await pick('Condition Key', 'MAP', 0)
    type('choice-0-cond-value', '1')
    type('choice-0-cond-operator', '>')
    type('choice-0-effect-titleEn', 'Lost')
    type('choice-0-effect-descEn', 'You are lost')
    type('choice-0-effect-statistics', 'SAD')
    type('choice-0-effect-value', '1')
    await pick('Registry Key', 'DOOR = OPEN', 0)
    await pick('Move To Location', '#2 Cave', 0)
    type('choice-0-effect-valueToAdd', 'Y')
    type('choice-0-effect-valueToRemove', 'N')
    type('choice-0-copyright', 'CC')
    type('choice-0-link', 'http://l')
    type('choice-0-urlImage', 'http://i')
    type('choice-1-titleIt', 'solo IT, ignorata')

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await screen.findByTestId('fast-event-summary')

    const choices = created('choices')
    expect(choices).toHaveLength(1)
    expect(choices[0]).toMatchObject({ idTextName: 13, idTextNarrative: 13, priority: 1 })
    const { idChoices, idScelta } = created('choice-effects')[0]
    expect(idChoices).toBeGreaterThan(50)
    expect(idScelta).toBe(idChoices)
    expect(created('choice-conditions')[0].idChoices).toBe(idChoices)
    expect(created('choice-conditions')[0]).toMatchObject({ type: 'KEYS', key: 'MAP', value: '1', operator: '>' })
    expect(created('choice-effects')[0]).toMatchObject({
      idTextName: 16, idText: 17, statistics: 'SAD', value: 1, key: 'DOOR',
      valueToAdd: 'Y', valueToRemove: 'N', idLocation: 2,
    })
    expect(created('cards')[1]).toMatchObject({ idTextCopyright: 15, linkCopyright: 'http://l', urlImage: 'http://i' })
  })

  it('shows the rollback summary with the orphans when the save fails', async () => {
    storyApi.createEntity.mockImplementation((_s, t) =>
      t === 'cards' ? Promise.reject(new Error('card down')) : Promise.resolve({ uuid: 'tx' }))
    storyApi.deleteEntity.mockRejectedValue(new Error('no'))
    renderPage()
    await screen.findByText(/Fast New Event/)
    type('event-titleEn', 'Storm')
    type('effect-titleEn', 'Wet')
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    const summary = await screen.findByTestId('fast-event-summary')
    expect(summary).toHaveTextContent('Save failed: card down')
    expect(summary).toHaveTextContent('Rolled back 0 of 1 entities')
    expect(summary).toHaveTextContent('texts: Text #12 (en) (tx)')
    expect(document.getElementById('event-titleEn').value).toBe('Storm')
  })

  it('lists orphans without uuid and hides the orphan list when all were deleted', async () => {
    storyApi.createEntity.mockImplementation((_s, t) =>
      t === 'cards' ? Promise.reject(new Error('x')) : Promise.resolve({}))
    renderPage()
    await screen.findByText(/Fast New Event/)
    type('event-titleEn', 'Storm')
    type('effect-titleEn', 'Wet')
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(await screen.findByTestId('fast-event-summary')).toHaveTextContent('texts: Text #12 (en)')

    storyApi.createEntity.mockImplementation((_s, t) =>
      t === 'cards' ? Promise.reject(new Error('y')) : Promise.resolve({ uuid: 'ok' }))
    storyApi.deleteEntity.mockResolvedValue(true)
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await waitFor(() => expect(screen.getByTestId('fast-event-summary')).toHaveTextContent('Save failed: y'))
    expect(screen.queryByText(/Left orphaned/)).toBeNull()
  })

  it('shows an error when the save itself throws', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    storyApi.listEntities.mockRejectedValue({ response: { data: { message: 'list down' } } })
    type('event-titleEn', 'Storm')
    type('effect-titleEn', 'Wet')
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(await screen.findByText('list down')).toBeInTheDocument()
  })

  it('falls back to a generic save error', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    storyApi.listEntities.mockRejectedValue({})
    type('event-titleEn', 'Storm')
    type('effect-titleEn', 'Wet')
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('shows the load error and falls back to the uuid in the title', async () => {
    storyApi.getStory.mockRejectedValue(new Error('story down'))
    renderPage()
    expect(await screen.findByText('story down')).toBeInTheDocument()
    expect(screen.getByText(/Fast New Event — story-u/)).toBeInTheDocument()
  })

  it('uses a generic load error and tolerates null lists', async () => {
    storyApi.getStory.mockRejectedValueOnce({})
    renderPage()
    expect(await screen.findByText('Load failed')).toBeInTheDocument()

    storyApi.getStory.mockResolvedValue(mockStory)
    storyApi.listEntities.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText(/Fast New Event — TestAuthor/)).toBeInTheDocument()
  })

  it('closes the picker without selecting and goes back to the editor', async () => {
    renderPage()
    await screen.findByText(/Fast New Event/)
    fireEvent.click(screen.getAllByTitle('Select Location')[0])
    expect(await screen.findByRole('heading', { name: /Select Location/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('heading', { name: /Select Location/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(await screen.findByText('Editor page')).toBeInTheDocument()
  })

  it('ignores a load that resolves after unmount', async () => {
    let resolveStory
    storyApi.getStory.mockReturnValue(new Promise(r => { resolveStory = r }))
    const { unmount } = renderPage()
    unmount()
    resolveStory(mockStory)
    await Promise.resolve()
    storyApi.getStory.mockReturnValue(Promise.reject(new Error('late')))
    const second = renderPage()
    second.unmount()
    await new Promise(r => setTimeout(r, 0))
    expect(storyApi.getStory).toHaveBeenCalledTimes(2)
  })
})
