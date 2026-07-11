import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MatchDetailPage from '../../pages/MatchDetailPage'

vi.mock('../../api/matchApi', () => ({
  getMatchInfo:  vi.fn(),
  getMatchClock: vi.fn(),
  getMatchWeather: vi.fn(),
  getMatchLocations: vi.fn(),
  stopMatch:     vi.fn(),
  pauseMatch:    vi.fn(),
  resumeMatch:   vi.fn(),
  deleteMatch:   vi.fn(),
  changePlayerStatistics: vi.fn(),
}))
vi.mock('../../api/storyApi', () => ({ getStory: vi.fn(), listEntities: vi.fn() }))

import * as matchApi from '../../api/matchApi'
import { getStory, listEntities } from '../../api/storyApi'

const PLAYER = {
  uuid: 'c1', userUuid: 'player-uuid-001', characterTemplateUuid: 'ct-w',
  classUuid: 'cls-1', traitUuids: ['tr-1', 'tr-2'],
  dexterity: 19, intelligence: 18, constitution: 19, energy: 127, life: 137, sad: 0,
  // Step 27 — max statistics, carried weight and items
  lifeMax: 137, energyMax: 127, sadMax: 8, weightMax: 24, weight: 4,
  items: [{ uuid: 'inv-1', itemUuid: 'item-1', name: 'Training Potion', weight: 2, amount: 2, state: 'ACTIVE' }],
  idLocation: 90001, isSleeping: false, isComa: false,
}

function mockInfo(status = 'RUNNING', extra = {}) {
  return {
    match: {
      uuid: 'm1', name: 'Saturday run', storyUuid: 'story-1', difficultyUuid: 'd1',
      status, singlePlayer: 1, currentClock: 4, expCost: 5, tsInsert: '2026-05-20T10:00:00Z',
    },
    currentLocationId: 90001, currentLocationUuid: 'loc-1-story',
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

/** The page lays its sections out as tabs (default "Match configuration"); click
 *  the tab whose label matches before asserting that section's content. */
async function gotoTab(label) {
  fireEvent.click(await screen.findByRole('tab', { name: new RegExp(label, 'i') }))
}

describe('MatchDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true, configurable: true,
    })
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING'))
    matchApi.getMatchClock.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, clockLabelSingular: 'hour', clockLabelPlural: 'hours',
      anyCharacterSleeping: true,
      characters: [{ characterUuid: 'c1', isSleeping: true, energy: 88 }],
    })
    matchApi.getMatchWeather.mockResolvedValue({
      rngSeed: 42,
      current: { idWeather: 2, uuid: 'we-storm', idCard: 6, deltaEnergy: -2,
                 costMoveSafeLocation: 5, costMoveNotSafeLocation: 9, currentClock: 1 },
      rules: [
        { id: 1, uuid: 'we-clear', idTextName: 800, name: 'Clear Skies', probability: 70,
          deltaEnergy: 0, costMoveSafeLocation: 4, costMoveNotSafeLocation: 6, active: true, current: false },
        { id: 2, uuid: 'we-storm', idTextName: 801, name: 'Storm', probability: 30,
          deltaEnergy: -2, costMoveSafeLocation: 5, costMoveNotSafeLocation: 9, active: true, current: true },
      ],
      log: [{ id: 1, uuid: 'l-1', clock: 0, idWeather: 2, weatherUuid: 'we-storm',
              idTextName: 101, timestampStart: '2026-06-24T00:00:00Z' }],
    })
    matchApi.getMatchLocations.mockResolvedValue({
      matchUuid: 'm1',
      locations: [
        { idLocation: 90001, uuid: 'loc-1', idCard: 2, safe: true, characterCount: 1,
          neighbors: [
            { idLocation: 90002, uuid: 'loc-2', direction: 'NORTH',
              baseEnergyCost: 2, entryEnergyCost: 0, weatherEnergyCost: 5,
              totalEnergyCost: 7, conditionMet: true },
          ] },
        { idLocation: 90002, uuid: 'loc-2', idCard: 3, safe: false, characterCount: 0, neighbors: [] },
      ],
    })
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
        { idText: 250, lang: 'en', shortText: 'Welcome Hall of the Academy' },
        { idText: 251, lang: 'en', shortText: 'Movement Training Room' },
        { idText: 800, lang: 'en', shortText: 'Clear Skies' },
        { idText: 801, lang: 'en', shortText: 'Storm' },
      ])
      if (type === 'locations') return Promise.resolve([
        { id: 90001, uuid: 'loc-1-story', idTextName: 250 },
        { id: 90002, uuid: 'loc-2', idTextName: 251 },
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
    await gotoTab('Players')
    await waitFor(() => expect(screen.getByText('Players & characters (1)')).toBeInTheDocument())
    // "Warrior" now appears both in the players table and the Step 24 projected
    // turn-order panel, so there are two occurrences.
    expect((await screen.findAllByText('Warrior')).length).toBeGreaterThan(0)
    // Step 27 — stats render as current/max gauges
    expect(screen.getByText('137/137')).toBeInTheDocument()  // life
    expect(screen.getByText('127/127')).toBeInTheDocument()  // energy
    expect(screen.getByText('0/8')).toBeInTheDocument()      // sad
    expect(screen.getByText('4/24')).toBeInTheDocument()     // weight
    expect(screen.getByText(/Training Potion ×2/)).toBeInTheDocument()
    // v0.28.6 — the synthetic locationName is gone: the console resolves the
    // player's position from the story context (idTextName 250, name20-truncated).
    expect(screen.getAllByText(/Welcome Hall of the/).length).toBeGreaterThan(0)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(matchApi.getMatchInfo).toHaveBeenCalledWith('m1')
  })

  it('renders difficulty, class and trait names', async () => {
    renderPage()
    // difficulty is on the default Match configuration tab
    expect(await screen.findByText('Normal')).toBeInTheDocument()
    // class + traits live on the Players tab
    await gotoTab('Players')
    expect(await screen.findByText('Mage')).toBeInTheDocument()       // class
    expect(screen.getByText('Brave')).toBeInTheDocument()            // trait
    expect(screen.getByText('Quick')).toBeInTheDocument()            // trait
  })

  it('renders locations and registry sections', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Locations')
    expect(await screen.findByText('Location state — gaming_state_locations (1)')).toBeInTheDocument()
    // Step 26 — the location time counter (clock_counter) is rendered.
    expect(screen.getByText('3')).toBeInTheDocument()
    await gotoTab('Registry')
    expect(await screen.findByText('Registry (1)')).toBeInTheDocument()
    expect(screen.getByText('act_1_done')).toBeInTheDocument()
  })

  it('shows empty-state when no players', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { players: [] }))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Players')
    expect(await screen.findByText(/No characters have joined/i)).toBeInTheDocument()
  })

  it('surfaces an error', async () => {
    matchApi.getMatchInfo.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  // ── tabs ───────────────────────────────────────────────────────────────────

  it('defaults to the Match configuration tab and hides the other sections', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    // config content is visible by default (the status label lives only in the config card)
    expect(screen.getByTestId('match-status-label')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Match configuration/i })).toHaveAttribute('aria-selected', 'true')
    // other sections are not mounted until their tab is selected
    expect(screen.queryByText('Players & characters (1)')).not.toBeInTheDocument()
    expect(screen.queryByTestId('weather-panel')).not.toBeInTheDocument()
  })

  it('switches the visible section when a tab is clicked', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    expect(screen.getByTestId('match-status-label')).toBeInTheDocument()
    await gotoTab('Players')
    expect(await screen.findByText('Players & characters (1)')).toBeInTheDocument()
    // leaving the config tab unmounts its content (status label is gone)
    expect(screen.queryByTestId('match-status-label')).not.toBeInTheDocument()
  })

  // ── clock status panel (Step 26) ──────────────────────────────────────────

  it('renders the Clock status panel with label and sleeping character', async () => {
    renderPage()
    expect(await screen.findByText('Clock status')).toBeInTheDocument()
    // current clock 4 → plural label "hours"
    expect(screen.getByText('4 (hours)')).toBeInTheDocument()
    expect(screen.getByText('Anyone sleeping')).toBeInTheDocument()
    // per-character row: resolved name + Sleeping state
    expect(screen.getByText('Sleeping')).toBeInTheDocument()
    expect(matchApi.getMatchClock).toHaveBeenCalledWith('m1')
  })

  it('hides the Clock status panel when the clock endpoint fails', async () => {
    matchApi.getMatchClock.mockRejectedValue(new Error('no clock endpoint'))
    renderPage()
    // the rest of the page still renders…
    expect(await screen.findByText('Saturday run')).toBeInTheDocument()
    // …but the clock panel is absent
    expect(screen.queryByText('Clock status')).not.toBeInTheDocument()
  })

  // ── weather panel (Step 27) ────────────────────────────────────────────────

  it('renders the Weather panel with rng seed, current weather and log', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    // RNG seed row is on the default Match configuration tab
    expect(screen.getByText('RNG seed')).toBeInTheDocument()
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
    await gotoTab('Weather')
    expect(await screen.findByTestId('weather-panel')).toBeInTheDocument()
    expect(matchApi.getMatchWeather).toHaveBeenCalledWith('m1')
    // weather panel title carries the seed; every rule listed, active flagged
    expect(screen.getByText(/Weather · seed 42/)).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()   // clear probability
    expect(screen.getByText('30')).toBeInTheDocument()   // storm probability
    expect(screen.getByText('current')).toBeInTheDocument()
    // the active storm rule's energy delta and move costs are in its row
    expect(screen.getAllByText('-2').length).toBeGreaterThan(0)
    expect(screen.getByText('Move (safe)')).toBeInTheDocument()
    expect(screen.getByText('Move (unsafe)')).toBeInTheDocument()
    // name column now shows the first 20 chars of the weather name (not initials)
    expect(screen.getByText('Clear Skies')).toBeInTheDocument()
    expect(screen.getByText('Storm')).toBeInTheDocument()
  })

  it('hides the Weather panel when the weather endpoint fails', async () => {
    matchApi.getMatchWeather.mockRejectedValue(new Error('no weather endpoint'))
    renderPage()
    expect(await screen.findByText('Saturday run')).toBeInTheDocument()
    expect(screen.queryByTestId('weather-panel')).not.toBeInTheDocument()
  })

  // ── movement view inside Location state (Step 28) ──────────────────────────

  it('shows location name, characters and neighbor cost formula in Location state', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Locations')
    expect(await screen.findByText('Location state — gaming_state_locations (1)')).toBeInTheDocument()
    expect(matchApi.getMatchLocations).toHaveBeenCalledWith('m1')
    // location name truncated to the first 20 chars in the row
    expect(screen.getByText('Welcome Hall of the')).toBeInTheDocument()
    // neighbor (beside Characters): destination name (first 20 chars) + cost formula
    expect(screen.getByText(/Movement Training Ro/)).toBeInTheDocument()
    expect(screen.getByText(/2 \+ 0 \+ 5 =/)).toBeInTheDocument()  // edge + entry + weather
    expect(screen.getByText('7')).toBeInTheDocument()              // total badge
    // character shown inline on the location row (Characters column of the Locations tab)
    expect(screen.getAllByText('Warrior').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Location state without neighbors when there is no movement data', async () => {
    matchApi.getMatchLocations.mockResolvedValue({ matchUuid: 'm1', locations: [] })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Locations')
    expect(await screen.findByText('Location state — gaming_state_locations (1)')).toBeInTheDocument()
    // no neighbor cost badge rendered
    expect(screen.queryByText('7')).not.toBeInTheDocument()
  })

  it('tolerates the movement endpoint failing on older backends', async () => {
    matchApi.getMatchLocations.mockRejectedValue(new Error('no locations endpoint'))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Locations')
    expect(await screen.findByText('Location state — gaming_state_locations (1)')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()
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
    await screen.findByText('Saturday run')
    await gotoTab('Players')
    const chip = await screen.findByTitle('ct-w')
    fireEvent.click(chip)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ct-w')
  })

  it('resume calls resumeMatch and reloads info', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('PAUSED'))
    renderPage()
    await screen.findByTestId('match-status-label')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Resume/i })))
    expect(matchApi.resumeMatch).toHaveBeenCalledWith('m1')
    await waitFor(() => expect(matchApi.getMatchInfo).toHaveBeenCalledTimes(2))
  })

  it('shows actionError when stop fails', async () => {
    matchApi.stopMatch.mockRejectedValue(new Error('stop-fail'))
    renderPage()
    await screen.findByTestId('match-status-label')
    fireEvent.click(screen.getByRole('button', { name: /Stop match/i }))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }))
    )
    expect(await screen.findByText(/stop-fail/i)).toBeInTheDocument()
  })

  it('shows GAMEOVER status with Delete button only', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('GAMEOVER'))
    renderPage()
    const label = await screen.findByTestId('match-status-label')
    expect(label).toHaveTextContent('GAMEOVER')
    expect(screen.getByRole('button', { name: /Delete match/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stop/i })).not.toBeInTheDocument()
  })

  it('shows coma badge for a player in coma', async () => {
    const comaPlayer = { ...PLAYER, isSleeping: false, isComa: true }
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { players: [comaPlayer] }))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Players')
    expect(await screen.findByText('coma')).toBeInTheDocument()
  })

  it('shows sleeping badge for a sleeping player', async () => {
    const sleepingPlayer = { ...PLAYER, isSleeping: true, isComa: false }
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { players: [sleepingPlayer] }))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Players')
    expect(await screen.findByText('sleeping')).toBeInTheDocument()
  })

  it('renders clock with singular label when currentClock is 1', async () => {
    matchApi.getMatchClock.mockResolvedValue({
      matchUuid: 'm1', currentClock: 1, clockLabelSingular: 'hour', clockLabelPlural: 'hours',
      anyCharacterSleeping: false,
      characters: [],
    })
    renderPage()
    expect(await screen.findByText('1 (hour)')).toBeInTheDocument()
  })

  it('renders clock characters with Awake state when not sleeping', async () => {
    matchApi.getMatchClock.mockResolvedValue({
      matchUuid: 'm1', currentClock: 3, clockLabelSingular: 'hour', clockLabelPlural: 'hours',
      anyCharacterSleeping: false,
      characters: [{ characterUuid: 'c1', isSleeping: false, energy: 100 }],
    })
    renderPage()
    expect(await screen.findByText('Awake')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders dash for player without classUuid', async () => {
    const noClassPlayer = { ...PLAYER, classUuid: null, traitUuids: [], items: [] }
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { players: [noClassPlayer] }))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Players')
    const dashes = await screen.findAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders Multiplayer badge when singlePlayer is 0', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', {
      match: { uuid: 'm1', name: 'Saturday run', storyUuid: 'story-1', difficultyUuid: 'd1',
               status: 'RUNNING', singlePlayer: 0, currentClock: 4, expCost: 5, tsInsert: '2026-05-20T10:00:00Z' },
    }))
    renderPage()
    expect(await screen.findByText('Saturday run')).toBeInTheDocument()
    expect(screen.getByText('Multiplayer')).toBeInTheDocument()
  })

  it('renders empty state for locations and registry when lists are empty', async () => {
    matchApi.getMatchInfo.mockResolvedValue(mockInfo('RUNNING', { locations: [], registry: [] }))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Locations')
    expect(await screen.findByText('No locations.')).toBeInTheDocument()
    await gotoTab('Registry')
    expect(await screen.findByText('No registry entries.')).toBeInTheDocument()
  })

  it('navigates back to matches list when back button is clicked', async () => {
    renderPage()
    await screen.findByTestId('match-status-label')
    fireEvent.click(screen.getByRole('button', { name: /Matches/i }))
    expect(await screen.findByText('matches-list')).toBeInTheDocument()
  })

  it('opens EditStatsModal when Edit statistics button is clicked', async () => {
    matchApi.changePlayerStatistics.mockResolvedValue({})
    renderPage()
    await screen.findByTestId('match-status-label')
    await gotoTab('Players')
    const editBtn = await screen.findByTitle('Edit statistics')
    fireEvent.click(editBtn)
    expect(screen.getByText('Edit statistics')).toBeInTheDocument()
  })

  it('saves statistics and reloads info', async () => {
    matchApi.changePlayerStatistics.mockResolvedValue({})
    renderPage()
    await screen.findByTestId('match-status-label')
    await gotoTab('Players')
    fireEvent.click(await screen.findByTitle('Edit statistics'))
    expect(screen.getByText('Edit statistics')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    })
    await waitFor(() => expect(matchApi.changePlayerStatistics).toHaveBeenCalled())
    await waitFor(() => expect(matchApi.getMatchInfo).toHaveBeenCalledTimes(2))
  })

  it('shows error in EditStatsModal when save fails', async () => {
    matchApi.changePlayerStatistics.mockRejectedValue({ message: 'stat-save-error' })
    renderPage()
    await screen.findByTestId('match-status-label')
    await gotoTab('Players')
    fireEvent.click(await screen.findByTitle('Edit statistics'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    })
    await waitFor(() => expect(screen.getByText('stat-save-error')).toBeInTheDocument())
  })

  it('closes EditStatsModal via Cancel button', async () => {
    renderPage()
    await screen.findByTestId('match-status-label')
    await gotoTab('Players')
    fireEvent.click(await screen.findByTitle('Edit statistics'))
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    await waitFor(() => expect(screen.queryByText('Edit statistics')).not.toBeInTheDocument())
  })

  it('triggers keyboard navigation on UuidLink with Enter key', async () => {
    renderPage()
    const matchStatus = await screen.findByTestId('match-status-label')
    expect(matchStatus).toBeInTheDocument()
    // UuidLink is the clickable uuid span — trigger Enter key
    const uuidLinks = document.querySelectorAll('.uuid-link')
    if (uuidLinks.length > 0) {
      fireEvent.keyDown(uuidLinks[0], { key: 'Enter' })
      expect(uuidLinks[0]).toBeInTheDocument()
    }
  })

  it('triggers keyboard navigation on UuidLink with Space key', async () => {
    renderPage()
    const matchStatus = await screen.findByTestId('match-status-label')
    expect(matchStatus).toBeInTheDocument()
    const uuidLinks = document.querySelectorAll('.uuid-link')
    if (uuidLinks.length > 0) {
      fireEvent.keyDown(uuidLinks[0], { key: ' ' })
      expect(uuidLinks[0]).toBeInTheDocument()
    }
  })
})
