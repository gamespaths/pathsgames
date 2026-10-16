import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FastNewLocationsPage from '../../pages/story/FastNewLocationsPage'
import * as storyApi from '../../api/storyApi'
import { SUMMARY_HIDE_MS } from '../../pages/story/FastFormHelpers'

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
const mockNeighbors = [{ uuid: 'n1', idLocationFrom: 2, idLocationTo: 1, direction: 'SOUTH' }]

function mockLoad() {
  storyApi.getStory.mockResolvedValue(mockStory)
  storyApi.listEntities.mockImplementation((_uuid, type) => {
    if (type === 'texts') return Promise.resolve(mockTexts)
    if (type === 'locations') return Promise.resolve(mockLocations)
    if (type === 'location-neighbors') return Promise.resolve(mockNeighbors)
    if (type === 'cards') return Promise.resolve([{ idCard: 3 }])
    return Promise.resolve([])
  })
  let seq = 0
  storyApi.createEntity.mockImplementation((_s, type, payload) => {
    seq += 1
    const res = { uuid: `u${seq}` }
    if (type === 'cards') res.idCard = payload.idCard
    if (type === 'locations') res.id = 50 + seq
    return Promise.resolve(res)
  })
  storyApi.deleteEntity.mockResolvedValue(true)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/stories/${STORY_UUID}/fast-new-locations`]}>
      <Routes>
        <Route path="/stories/:uuid/fast-new-locations" element={<FastNewLocationsPage />} />
        <Route path="/stories/:uuid/edit" element={<div>Editor page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const el = (id) => document.getElementById(id)
const type = (id, value) => fireEvent.change(el(id), { target: { value } })
const created = (entityType) => storyApi.createEntity.mock.calls.filter(c => c[1] === entityType).map(c => c[2])
const optionLabels = (id) => [...el(id).options].map(o => o.textContent)
const save = () => fireEvent.click(screen.getByRole('button', { name: /Save/ }))
const loaded = () => screen.findByText(/Fast New Locations — /)

describe('FastNewLocationsPage', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoad()
  })

  it('loads the story with one empty location row and no neighbor', async () => {
    renderPage()
    expect(await screen.findByText(/Fast New Locations — TestAuthor/)).toBeInTheDocument()
    expect(el('location-0-titleEn')).toBeInTheDocument()
    expect(el('location-0-descEn').tagName).toBe('TEXTAREA')
    expect(el('location-1-titleEn')).toBeNull()
    expect(el('neighbor-0-from')).toBeNull()
    expect(storyApi.listEntities).toHaveBeenCalledWith(STORY_UUID, 'location-neighbors')
  })

  it('adds and removes location and neighbor rows', async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /Add location/ }))
    expect(el('location-1-titleEn')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add neighbor/ }))
    expect(el('neighbor-0-from')).toBeInTheDocument()
    expect(el('neighbor-0-flagBack').value).toBe('0')
    expect(optionLabels('neighbor-0-flagBack')).toEqual(['YES', 'NO'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove neighbor 1' }))
    expect(el('neighbor-0-from')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove location 2' }))
    expect(el('location-1-titleEn')).toBeNull()
  })

  it('lists new rows then existing locations by descending id, and follows row removal', async () => {
    renderPage()
    await loaded()
    type('location-0-titleEn', 'Hall')
    fireEvent.click(screen.getByRole('button', { name: /Add location/ }))
    type('location-1-titleEn', 'Tower')
    fireEvent.click(screen.getByRole('button', { name: /Add neighbor/ }))
    expect(optionLabels('neighbor-0-from')).toEqual(['Select...', 'New 1: Hall', 'New 2: Tower', '#2 Cave', '#1 Forest'])
    type('neighbor-0-from', 'new:1')
    type('neighbor-0-to', 'new:0')
    fireEvent.click(screen.getByRole('button', { name: 'Remove location 1' }))
    expect(el('neighbor-0-from').value).toBe('new:0')
    expect(el('neighbor-0-to').value).toBe('')
    expect(optionLabels('neighbor-0-to')).toEqual(['Select...', 'New 1: Tower', '#2 Cave', '#1 Forest'])
  })

  it('blocks the save with the validation errors', async () => {
    renderPage()
    await loaded()
    save()
    expect(await screen.findByText(/Add at least one location or one neighbor/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add neighbor/ }))
    type('neighbor-0-from', '2')
    type('neighbor-0-to', '1')
    type('neighbor-0-direction', 'SOUTH')
    save()
    expect(await screen.findByText(/already has a neighbor going SOUTH/)).toBeInTheDocument()
    expect(storyApi.createEntity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(/already has a neighbor/).parentElement.querySelector('button'))
    expect(screen.queryByText(/already has a neighbor/)).toBeNull()
  })

  it('saves locations and neighbors, shows the report, resets and reloads', async () => {
    renderPage()
    await loaded()
    type('location-0-titleEn', 'Hall')
    type('location-0-descEn', 'Big\nhall')
    type('location-0-energy', '2')
    fireEvent.click(screen.getByRole('button', { name: /Add neighbor/ }))
    type('neighbor-0-from', 'new:0')
    type('neighbor-0-to', '1')
    type('neighbor-0-direction', 'NORTH')
    type('neighbor-0-flagBack', '1')
    type('neighbor-0-key', 'DOOR')
    type('neighbor-0-keyValue', 'OPEN')
    type('neighbor-0-keyOperator', '!=')
    type('neighbor-0-energyCost', '1')
    type('neighbor-0-costFood', '2')
    type('neighbor-0-costMagic', '3')
    type('neighbor-0-costCoin', '4')
    save()
    const summary = await screen.findByTestId('fast-locations-summary')
    expect(summary).toHaveTextContent('Locations created')

    expect(created('locations')[0]).toEqual({
      idCard: 4, idTextName: 12, idTextDescription: 13, idTextNarrative: 13, costEnergyEnter: 2,
    })
    expect(created('texts')[1].shortText).toBe('Big<br />\nhall')
    const idLocation = created('location-neighbors')[0].idLocationFrom
    expect(idLocation).toBeGreaterThan(50)
    expect(created('location-neighbors')[0]).toEqual({
      idLocationFrom: idLocation, idLocationTo: 1, direction: 'NORTH', conditionRegistryKey: 'DOOR',
      conditionRegistryValue: 'OPEN', registryValueOperatorCondition: '!=', energyCost: 1,
      costFood: 2, costMagic: 3, costCoin: 4, flagBack: 1,
    })
    expect(el('location-0-titleEn').value).toBe('')
    expect(el('neighbor-0-from')).toBeNull()
    // lists loaded twice: on mount and after the save
    expect(storyApi.listEntities.mock.calls.filter(c => c[1] === 'location-neighbors')).toHaveLength(2)
  })

  it('hides the green report after a while and closes it on demand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderPage()
      await loaded()
      type('location-0-titleEn', 'Hall')
      save()
      await screen.findByTestId('fast-locations-summary')
      act(() => { vi.advanceTimersByTime(SUMMARY_HIDE_MS) })
      expect(screen.queryByTestId('fast-locations-summary')).toBeNull()

      type('location-0-titleEn', 'Hall 2')
      save()
      await screen.findByTestId('fast-locations-summary')
      fireEvent.click(screen.getByRole('button', { name: 'Close report' }))
      expect(screen.queryByTestId('fast-locations-summary')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the rollback report and keeps the form when the save fails', async () => {
    storyApi.createEntity.mockImplementation((_s, t) =>
      t === 'cards' ? Promise.reject(new Error('card down')) : Promise.resolve({ uuid: 'tx' }))
    storyApi.deleteEntity.mockRejectedValue(new Error('no'))
    renderPage()
    await loaded()
    type('location-0-titleEn', 'Hall')
    save()
    const summary = await screen.findByTestId('fast-locations-summary')
    expect(summary).toHaveTextContent('Save failed: card down')
    expect(summary).toHaveTextContent('Rolled back 0 of 1 entities')
    expect(summary).toHaveTextContent('texts: Text #12 (en) (tx)')
    expect(el('location-0-titleEn').value).toBe('Hall')
  })

  it('shows an error when the save itself throws', async () => {
    renderPage()
    await loaded()
    storyApi.listEntities.mockRejectedValue({ response: { data: { message: 'list down' } } })
    type('location-0-titleEn', 'Hall')
    save()
    expect(await screen.findByText('list down')).toBeInTheDocument()
  })

  it('falls back to a generic save error', async () => {
    renderPage()
    await loaded()
    storyApi.listEntities.mockRejectedValue({})
    type('location-0-titleEn', 'Hall')
    save()
    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('shows the load error and falls back to the uuid in the title', async () => {
    storyApi.getStory.mockRejectedValue(new Error('story down'))
    renderPage()
    expect(await screen.findByText('story down')).toBeInTheDocument()
    expect(screen.getByText(/Fast New Locations — story-u/)).toBeInTheDocument()
  })

  it('uses a generic load error and tolerates null lists', async () => {
    storyApi.getStory.mockRejectedValueOnce({})
    const first = renderPage()
    expect(await screen.findByText('Load failed')).toBeInTheDocument()
    first.unmount()

    storyApi.listEntities.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText(/Fast New Locations — TestAuthor/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add neighbor/ }))
    expect(optionLabels('neighbor-0-from')).toEqual(['Select...', 'New 1: (no title)'])
  })

  it('goes back to the editor', async () => {
    renderPage()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(await screen.findByText('Editor page')).toBeInTheDocument()
  })

  it('ignores a load that settles after unmount', async () => {
    let resolveStory
    storyApi.getStory.mockReturnValue(new Promise(r => { resolveStory = r }))
    const { unmount } = renderPage()
    unmount()
    resolveStory(mockStory)
    storyApi.getStory.mockReturnValue(Promise.reject(new Error('late')))
    const second = renderPage()
    second.unmount()
    await waitFor(() => expect(storyApi.getStory).toHaveBeenCalledTimes(2))
    await new Promise(r => setTimeout(r, 0))
  })
})
