import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MatchDetailPage from '../../pages/MatchDetailPage'

vi.mock('../../api/matchApi', () => ({
  getMatchInfo:  vi.fn(),
  getMatchClock: vi.fn(),
  getMatchWeather: vi.fn(),
  getMatchLocations: vi.fn(),
  getMatchLogs: vi.fn(),
  stopMatch:     vi.fn(),
  pauseMatch:    vi.fn(),
  resumeMatch:   vi.fn(),
  deleteMatch:   vi.fn(),
  changePlayerStatistics: vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))

import * as matchApi from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

/**
 * The match detail page against a backend that answers with the bare minimum: no
 * story context to resolve names against, log pages that fail, and error objects
 * of every shape the axios client can throw.
 */

const BARE_INFO = {
  match: { uuid: 'm1', storyUuid: null, status: 'RUNNING' },   // no name
  locations: [],
  registry: [],
  players: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/matches/m1']}>
      <Routes>
        <Route path="/matches/:uuid" element={<MatchDetailPage />} />
        <Route path="/matches"       element={<div>matches-list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MatchDetailPage edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchApi.getMatchInfo.mockResolvedValue(BARE_INFO)
    matchApi.getMatchClock.mockRejectedValue(new Error('no clock endpoint'))
    matchApi.getMatchWeather.mockRejectedValue(new Error('no weather endpoint'))
    matchApi.getMatchLocations.mockRejectedValue(new Error('no movement endpoint'))
    matchApi.getMatchLogs.mockResolvedValue({})   // an empty page: every field defaults
    getStory.mockResolvedValue({})
    listEntities.mockResolvedValue([])
  })

  it('titles the page by uuid and defaults an empty log page', async () => {
    renderPage()

    expect(await screen.findByText(/Match m1/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }))
    expect(await screen.findByText(/\(0 of 0 entries · clock 0\)/)).toBeInTheDocument()
  })

  it('shows the load failure from an error carrying no response body, then dismisses it', async () => {
    matchApi.getMatchInfo.mockRejectedValue(new Error('info down'))
    renderPage()

    expect(await screen.findByText('info down')).toBeInTheDocument()
    const alert = screen.getByText('info down').closest('.pg-alert')
    await userEvent.click(alert.querySelector('button'))
    expect(screen.queryByText('info down')).not.toBeInTheDocument()
  })

  it('falls back to the generic message when the error carries nothing at all', async () => {
    matchApi.getMatchInfo.mockRejectedValue({})
    renderPage()
    expect(await screen.findByText('Failed to load match')).toBeInTheDocument()
  })

  it('reports a log failure with the API message and keeps the rest of the page', async () => {
    matchApi.getMatchLogs.mockRejectedValue({ response: { data: { message: 'logs unavailable' } } })
    renderPage()

    await screen.findByText(/Match m1/)
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }))
    expect(await screen.findByText('logs unavailable')).toBeInTheDocument()
  })

  it('falls back to the generic log message for a bodyless error', async () => {
    matchApi.getMatchLogs.mockRejectedValue({})
    renderPage()

    await screen.findByText(/Match m1/)
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }))
    expect(await screen.findByText('Failed to load match logs')).toBeInTheDocument()
  })

  it('appends the next log page, keeping the clock and total of the first one', async () => {
    matchApi.getMatchLogs
      .mockResolvedValueOnce({ logs: [{ type: 'SLEEP', clock: 1 }], currentClock: 7, total: 2, nextCursor: 'c1' })
      .mockResolvedValueOnce({})   // the second page carries neither clock nor total
    renderPage()

    await screen.findByText(/Match m1/)
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }))
    await screen.findByText(/\(1 of 2 entries · clock 7\)/)

    await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
    await screen.findByRole('button', { name: /No more pages/i })
    // the second page carried nothing, so clock and total survive from the first
    expect(screen.getByText(/\(1 of 2 entries · clock 7\)/)).toBeInTheDocument()
  })

  it('reports a failure of the load-more call', async () => {
    matchApi.getMatchLogs
      .mockResolvedValueOnce({ logs: [{ type: 'SLEEP', clock: 1 }], currentClock: 1, total: 5, nextCursor: 'c1' })
      .mockRejectedValueOnce(new Error('page 2 exploded'))
    renderPage()

    await screen.findByText(/Match m1/)
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }))
    await screen.findByText(/\(1 of 5 entries · clock 1\)/)

    await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
    expect(await screen.findByText('page 2 exploded')).toBeInTheDocument()
  })

  it('shows short uuids when there is no story context to resolve names against', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      ...BARE_INFO,
      match: { ...BARE_INFO.match, difficultyUuid: 'difficulty-uuid-1234' },
      players: [{
        uuid: 'c1', characterTemplateUuid: 'template-uuid-1234', classUuid: 'class-uuid-1234',
        traitUuids: ['trait-uuid-1234'], idLocation: 1,
      }],
    })
    renderPage()

    await screen.findByText(/Match m1/)
    expect(screen.getByText('difficul…')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Players/i }))
    expect(await screen.findByText('template…')).toBeInTheDocument()
  })

  it('names a location that resolves through neither uuid nor id with a dash', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      ...BARE_INFO,
      currentLocationId: 42,
      currentLocationUuid: 'nope',
      locations: [{ idLocation: 42, uuid: 'nope' }],
    })
    renderPage()

    await screen.findByText(/Match m1/)
    await userEvent.click(screen.getByRole('tab', { name: /Locations/i }))
    expect(await screen.findByText('#42')).toBeInTheDocument()
  })

  it('appends the next log page and keeps what the page does not say', async () => {
    matchApi.getMatchLogs.mockResolvedValueOnce({
      logs: [{ id: 1, type: 'EVENT', clock: 0 }], currentClock: 2, total: 3, nextCursor: 'p2',
    })
    matchApi.getMatchLogs.mockResolvedValueOnce({ logs: [{ id: 2, type: 'EVENT', clock: 1 }] })
    renderPage()
    await userEvent.click(await screen.findByText('Logs'))

    await userEvent.click(await screen.findByText('Load more'))

    // The second page names no clock and no total, so the first page's values stand.
    await waitFor(() => expect(matchApi.getMatchLogs).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText(/of 3/).length).toBeGreaterThan(0)
  })

  it('a failing log page with no response body falls back to the error message', async () => {
    matchApi.getMatchLogs.mockResolvedValueOnce({ logs: [{ id: 1, type: 'EVENT', clock: 0 }], nextCursor: 'p2' })
    matchApi.getMatchLogs.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await userEvent.click(await screen.findByText('Logs'))

    await userEvent.click(await screen.findByText('Load more'))

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
  })

  it('a failing log page with neither body nor message falls back to the generic one', async () => {
    matchApi.getMatchLogs.mockResolvedValueOnce({ logs: [{ id: 1, type: 'EVENT', clock: 0 }], nextCursor: 'p2' })
    matchApi.getMatchLogs.mockRejectedValueOnce({})
    renderPage()
    await userEvent.click(await screen.findByText('Logs'))

    await userEvent.click(await screen.findByText('Load more'))

    expect(await screen.findByText('Failed to load match logs')).toBeInTheDocument()
  })

  it('the stop dialog names the match by uuid when it has no name', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('Stop match'))
    expect(await screen.findByText(/status to ENDED/)).toBeInTheDocument()
  })

  it('the delete dialog names the match by uuid when it has no name', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      ...BARE_INFO, match: { ...BARE_INFO.match, status: 'ENDED' },
    })
    renderPage()
    await userEvent.click(await screen.findByText('Delete match'))
    expect(await screen.findByText(/and all its data/)).toBeInTheDocument()
  })

  it('the turn-order tab renders with no player at all', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('Turn order'))
    await waitFor(() => expect(screen.getByText('Turn order')).toBeInTheDocument())
  })

  it('a class and a trait the story context does not know are named by their uuid', async () => {
    matchApi.getMatchInfo.mockResolvedValue({
      ...BARE_INFO,
      players: [{
        uuid: 'p1', characterUuid: 'c1', classUuid: 'cls-unknown',
        traitUuids: ['tr-unknown'], items: [],
      }],
    })
    renderPage()

    await userEvent.click(await screen.findByText('Players'))

    // No story context at all, so each uuid is shown shortened rather than dropped.
    expect(await screen.findByText(/cls-unkn/)).toBeInTheDocument()
    expect(screen.getByText(/tr-unkno/)).toBeInTheDocument()
  })
})
