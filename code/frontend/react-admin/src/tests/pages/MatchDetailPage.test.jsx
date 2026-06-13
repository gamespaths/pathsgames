import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MatchDetailPage from '../../pages/MatchDetailPage'

vi.mock('../../api/matchApi', () => ({
  getMatchInfo: vi.fn(),
  stopMatch:    vi.fn(),
  pauseMatch:   vi.fn(),
  resumeMatch:  vi.fn(),
  deleteMatch:  vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))

import * as matchApi from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

const PLAYER = {
  uuid: 'c1', userUuid: 'player-uuid-001', characterTemplateUuid: 'ct-w',
  classUuid: 'cls-1', traitUuids: ['tr-1', 'tr-2'],
  dexterity: 19, intelligence: 18, constitution: 19, energy: 127, life: 137, sad: 0,
  idLocation: 90001, locationName: 'location-90001', isSleeping: false, isComa: false,
}

function mockInfo(status = 'RUNNING', extra = {}) {
  return {
    match: {
      uuid: 'm1', name: 'Saturday run', storyUuid: 'story-1', difficultyUuid: 'd1',
      status, singlePlayer: 1, currentClock: 4, expCost: 5, tsInsert: '2026-05-20T10:00:00Z',
    },
    currentLocationId: 90001, currentLocationName: 'location-90001',
    locations: [{ idLocation: 90001, uuid: 'loc-1', flagAlreadyActived: 1, clockCounter: 3 }],
    registry: [{ uuid: 'r1', key: 'act_1_done', intValue: 0, stringValue: null }],
    events: [], choices: [],
    players: [PLAYER],
    ...extra,
  }
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

describe('MatchDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true, configurable: true,
    })
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING'))
    matchApi.stopMatch.mockResolvedValue({ status: 'UPDATED' })
    matchApi.pauseMatch.mockResolvedValue({ status: 'UPDATED' })
    matchApi.resumeMatch.mockResolvedValue({ status: 'UPDATED' })
    matchApi.deleteMatch.mockResolvedValue({ status: 'DELETED' })
    getStory.mockResolvedValue({ uuid: 'story-1', title: 'The Lost Kingdom' })
    listEntities.mockImplementation((_uuid, type) => {
      if (type === 'character-templates') return Promise.resolve([{ uuid: 'ct-w', idTextName: 210 }])
      if (type === 'texts') return Promise.resolve([
        { idText: 210, lang: 'en', shortText: 'Warrior' },
        { idText: 220, lang: 'en', shortText: 'Mage' },
        { idText: 230, lang: 'en', shortText: 'Normal' },
        { idText: 240, lang: 'en', shortText: 'Brave' },
        { idText: 241, lang: 'en', shortText: 'Quick' },
      ])
      if (type === 'classes')      return Promise.resolve([{ uuid: 'cls-1', idTextName: 220 }])
      if (type === 'difficulties') return Promise.resolve([{ uuid: 'd1',    idTextName: 230 }])
      if (type === 'traits')       return Promise.resolve([
        { uuid: 'tr-1', idTextName: 240 },
        { uuid: 'tr-2', idTextName: 241 },
      ])
      return Promise.resolve([])
    })
  })

  // ── content ──────────────────────────────────────────────────────────────

  it('loads the match and renders players with stats and resolved template name', async () => {
    renderPage()
    expect(await screen.findByText('Saturday run')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Players & characters (1)')).toBeInTheDocument())
    // "Warrior" now appears both in the players table and the Step 24 projected
    // turn-order panel, so there are two occurrences.
    expect((await screen.findAllByText('Warrior')).length).toBeGreaterThan(0)
    expect(screen.getByText('137')).toBeInTheDocument()
    expect(screen.getByText('127')).toBeInTheDocument()
    expect(screen.getAllByText('location-90001').length).toBeGreaterThan(0)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(matchApi.getMatchInfo).toHaveBeenCalledWith('m1')
  })

  it('renders difficulty, class and trait names', async () => {
    renderPage()
    expect(await screen.findByText('Normal')).toBeInTheDocument()   // difficulty
    expect(screen.getByText('Mage')).toBeInTheDocument()             // class
    expect(screen.getByText('Brave')).toBeInTheDocument()            // trait
    expect(screen.getByText('Quick')).toBeInTheDocument()            // trait
  })

  it('renders locations and registry sections', async () => {
    renderPage()
    expect(await screen.findByText('Locations (1)')).toBeInTheDocument()
    expect(screen.getByText('Registry (1)')).toBeInTheDocument()
    expect(screen.getByText('act_1_done')).toBeInTheDocument()
  })

  it('shows empty-state when no players', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { players: [] }))
    renderPage()
    expect(await screen.findByText(/No characters have joined/i)).toBeInTheDocument()
  })

  it('surfaces an error', async () => {
    matchApi.getMatchInfo.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  // ── status panel & buttons ────────────────────────────────────────────────

  it('shows RUNNING status and Stop + Pause buttons', async () => {
    renderPage()
    const label = await screen.findByTestId('match-status-label')
    expect(label).toHaveTextContent('RUNNING')
    expect(screen.getByRole('button', { name: /Stop match/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
  })

  it('shows PAUSED status and Stop + Resume buttons (no Pause)', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('PAUSED'))
    renderPage()
    const label = await screen.findByTestId('match-status-label')
    expect(label).toHaveTextContent('PAUSED')
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stop match/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pause/i })).not.toBeInTheDocument()
  })

  it('shows ENDED status with Delete button only', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('ENDED'))
    renderPage()
    const label = await screen.findByTestId('match-status-label')
    expect(label).toHaveTextContent('ENDED')
    expect(screen.getByRole('button', { name: /Delete match/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stop/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pause/i })).not.toBeInTheDocument()
  })

  it('pause calls pauseMatch and reloads info without confirm', async () => {
    renderPage()
    await screen.findByTestId('match-status-label')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Pause/i })))
    expect(matchApi.pauseMatch).toHaveBeenCalledWith('m1')
    // reloads — getMatchInfo called a second time
    await waitFor(() => expect(matchApi.getMatchInfo).toHaveBeenCalledTimes(2))
  })

  it('stop shows confirm modal, confirming calls stopMatch', async () => {
    renderPage()
    await screen.findByTestId('match-status-label')
    fireEvent.click(screen.getByRole('button', { name: /Stop match/i }))
    // Cancel button only exists inside the modal
    expect(await screen.findByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }))
    )
    expect(matchApi.stopMatch).toHaveBeenCalledWith('m1')
  })

  it('delete shows confirm modal and navigates to matches list', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('ENDED'))
    renderPage()
    await screen.findByTestId('match-status-label')
    fireEvent.click(screen.getByRole('button', { name: /Delete match/i }))
    expect(await screen.findByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }))
    )
    expect(matchApi.deleteMatch).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('matches-list')).toBeInTheDocument()
  })

  it('cancelling the confirm modal does not call the action', async () => {
    renderPage()
    await screen.findByTestId('match-status-label')
    fireEvent.click(screen.getByRole('button', { name: /Stop match/i }))
    const cancelBtn = await screen.findByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)
    expect(matchApi.stopMatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument()
  })

  it('copies UUID to clipboard when a UuidCopy chip is clicked', async () => {
    renderPage()
    const chip = await screen.findByTitle('ct-w')
    fireEvent.click(chip)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ct-w')
  })
})
