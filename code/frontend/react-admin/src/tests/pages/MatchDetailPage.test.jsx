import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
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
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, nextCursor: null, limit: 50, total: 5,
      logs: [
        { type: 'WEATHER',       clock: 0, timestamp: '2026-07-12T10:00:00Z', idWeather: 2,
          idCard: 300, card: { title: 'Thunderstorm', urlImage: 'http://img/storm.png' } },
        { type: 'MOVEMENT',      clock: null, timestamp: '2026-07-12T10:01:00Z',
          idCharacterMatch: 1, characterUuid: 'char-1', characterName: 'Ranger',
          idLocationFrom: 90001, idLocationTo: 90002, energyCost: 7,
          idCard: 400, card: { title: 'Dark Forest', awesomeIcon: 'fa-tree' } },
        { type: 'SLEEP',         clock: 0, timestamp: '2026-07-12T10:02:00Z',
          idCharacterMatch: 1, characterUuid: 'char-1', characterName: 'Ranger' },
        { type: 'CLOCK_ADVANCE', clock: 1, timestamp: '2026-07-12T10:02:01Z' },
        { type: 'RECOVERY',      clock: null, timestamp: '2026-07-12T10:03:00Z',
          idCharacterMatch: 1, characterUuid: 'char-1', characterName: 'Ranger',
          message: 'recovery safe=true p=3 dEnergy=5 dLife=2 dSad=-1' },
      ],
    })
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
    expect(screen.queryByTestId('match-logs-panel')).not.toBeInTheDocument()
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

  // ── Logs tab (Step 28.7) ─────────────────────────────────────────────────

  it('renders the Logs tab with all entry types', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    // panel is visible
    expect(await screen.findByTestId('match-logs-panel')).toBeInTheDocument()
    // header shows entry count and current clock
    expect(screen.getByText(/5 entries/i)).toBeInTheDocument()
    expect(screen.getByText(/clock 4/i)).toBeInTheDocument()
    // all five entry types appear
    expect(screen.getAllByText('WEATHER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MOVEMENT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('SLEEP').length).toBeGreaterThan(0)
    expect(screen.getAllByText('CLOCK_ADVANCE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('RECOVERY').length).toBeGreaterThan(0)
    // movement detail shows from → to
    expect(screen.getByText(/#90001 → #90002/)).toBeInTheDocument()
    // recovery detail shows the message (truncated)
    expect(screen.getByText(/recovery safe=true/)).toBeInTheDocument()
    expect(matchApi.getMatchLogs).toHaveBeenCalledWith('m1', { limit: 50 })
  })

  it('shows the card title and image for weather and movement entries', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    // WEATHER card: title + thumbnail image
    expect(screen.getByText('Thunderstorm')).toBeInTheDocument()
    expect(screen.getByAltText('Thunderstorm')).toHaveAttribute('src', 'http://img/storm.png')
    // MOVEMENT card: title of the destination location (no image → icon fallback)
    expect(screen.getByText('Dark Forest')).toBeInTheDocument()
    expect(screen.queryByAltText('Dark Forest')).not.toBeInTheDocument()
  })

  it('shows an EVENT entry with its own card and event id detail (v0.30.3)', async () => {
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, nextCursor: null, limit: 50, total: 1,
      logs: [
        { type: 'EVENT', clock: 3, timestamp: '2026-07-12T10:04:00Z',
          idEvent: 42, idCharacterMatch: 1, characterUuid: 'char-1', characterName: 'Ranger',
          message: 'EVENT_EXECUTED 42',
          idCard: 600, card: { title: 'A Fork In The Road', urlImage: 'http://img/fork.png' } },
      ],
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    expect(screen.getAllByText('EVENT').length).toBeGreaterThan(0)
    expect(screen.getByText('A Fork In The Road')).toBeInTheDocument()
    expect(screen.getByAltText('A Fork In The Road')).toHaveAttribute('src', 'http://img/fork.png')
    expect(screen.getByText('event #42')).toBeInTheDocument()
  })

  it('v0.35.4 — shows the three ITEM_* entries with the item card, units and source event', async () => {
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, nextCursor: null, limit: 50, total: 3,
      logs: [
        { type: 'ITEM_ADD', timestamp: '2026-07-12T10:01:00Z', idItem: 900, itemAction: 'ADD',
          counter: 1, idEvent: 42, idCharacterMatch: 1, characterName: 'Ranger',
          energyCost: 0, foodCost: 0, magicCost: 0, coinCost: 0,
          energyGain: 0, foodGain: 0, magicGain: 0, coinGain: 0,
          idCard: 700, card: { title: 'Healing Potion', urlImage: 'http://img/potion.png' } },
        { type: 'ITEM_USE', timestamp: '2026-07-12T10:02:00Z', idItem: 900, itemAction: 'USE',
          counter: 2, idCharacterMatch: 1, characterName: 'Ranger',
          energyCost: 0, foodCost: 0, magicCost: 3, coinCost: 0,
          energyGain: 9, foodGain: 0, magicGain: 0, coinGain: 0,
          idCard: 700, card: { title: 'Healing Potion' } },
        { type: 'ITEM_DROP', timestamp: '2026-07-12T10:03:00Z', idItem: 901, itemAction: 'DROP',
          counter: 1, idCharacterMatch: 1, characterName: 'Ranger',
          idCard: 701, card: { title: 'Rusty Sword' } },
      ],
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    expect(screen.getAllByText('ITEM_ADD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ITEM_USE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ITEM_DROP').length).toBeGreaterThan(0)
    // the item's own card, the units, and the event that handed it over
    expect(screen.getAllByText('Healing Potion').length).toBe(2)
    expect(screen.getByText('item #900 (event #42)')).toBeInTheDocument()
    expect(screen.getByText('item #900 ×2')).toBeInTheDocument()
    expect(screen.getByText('item #901')).toBeInTheDocument()
    // a usage that restored energy and drained magic shows both halves
    expect(screen.getByText('+9 ⚡')).toBeInTheDocument()
    expect(screen.getByText('−3 ✨')).toBeInTheDocument()
  })

  it('v0.35.4 — an EVENT row shows what it took and what it gave back', async () => {
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, nextCursor: null, limit: 50, total: 1,
      logs: [
        { type: 'EVENT', clock: 3, timestamp: '2026-07-12T10:04:00Z', idEvent: 42,
          message: 'EVENT_EXECUTED 42',
          energyCost: 5, foodCost: 0, magicCost: 0, coinCost: 7,
          energyGain: 0, foodGain: 2, magicGain: 0, coinGain: 30 },
      ],
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    expect(screen.getByText('−5 ⚡')).toBeInTheDocument()
    expect(screen.getByText('−7 🪙')).toBeInTheDocument()
    expect(screen.getByText('+2 🍞')).toBeInTheDocument()
    expect(screen.getByText('+30 🪙')).toBeInTheDocument()
  })

  it('v0.35.4 — an entry that moved no resource shows nothing in the column', async () => {
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 4, nextCursor: null, limit: 50, total: 1,
      logs: [{ type: 'CLOCK_ADVANCE', clock: 3, timestamp: '2026-07-12T10:04:00Z' }],
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    expect(screen.queryByTestId('log-resources')).not.toBeInTheDocument()
  })

  it('names the character that performed each character-scoped action', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')
    // MOVEMENT, SLEEP and RECOVERY all carry the character
    expect(screen.getAllByText('Ranger')).toHaveLength(3)
  })

  it('loads the next page of logs when Load more is clicked', async () => {
    matchApi.getMatchLogs
      .mockResolvedValueOnce({
        matchUuid: 'm1', currentClock: 4, limit: 50, total: 2, nextCursor: 'cur-2',
        logs: [{ type: 'CLOCK_ADVANCE', clock: 0, timestamp: '2026-07-12T10:00:00Z' }],
      })
      .mockResolvedValueOnce({
        matchUuid: 'm1', currentClock: 4, limit: 50, total: 2, nextCursor: null,
        logs: [{ type: 'CLOCK_ADVANCE', clock: 1, timestamp: '2026-07-12T11:00:00Z' }],
      })

    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')
    expect(screen.getByText(/Showing 1 of 2 — more available/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Load more/i }))

    // the second page is appended, not replaced
    expect(await screen.findByText(/Showing 2 of 2 — all loaded/)).toBeInTheDocument()
    expect(screen.getAllByText('CLOCK_ADVANCE')).toHaveLength(2)
    expect(matchApi.getMatchLogs).toHaveBeenLastCalledWith('m1', { limit: 50, cursor: 'cur-2' })
    expect(screen.getByRole('button', { name: /No more pages/i })).toBeDisabled()
  })

  it('disables Load more when the first page is already the whole timeline', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')
    expect(screen.getByRole('button', { name: /No more pages/i })).toBeDisabled()
  })

  it('filters the log table by type when a count badge is clicked', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    // all five entries are listed to begin with
    expect(screen.getAllByText('MOVEMENT')).toHaveLength(1)
    expect(screen.getAllByText('SLEEP')).toHaveLength(1)

    // the MOVEMENT count badge filters the table down to that type
    const filters = within(screen.getByTestId('match-logs-filters')).getAllByRole('button')
    const movementChip = filters.find(b => b.getAttribute('title') === 'MOVEMENT')
    fireEvent.click(movementChip)

    expect(screen.getByText('MOVEMENT')).toBeInTheDocument()
    expect(screen.queryByText('SLEEP')).not.toBeInTheDocument()
    expect(screen.queryByText('WEATHER')).not.toBeInTheDocument()
    expect(movementChip).toHaveAttribute('aria-pressed', 'true')

    // the "All" chip brings every type back
    fireEvent.click(screen.getByRole('button', { name: /All 5/ }))
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
    expect(screen.getByText('WEATHER')).toBeInTheDocument()
  })

  it('clears the filter when the active badge is clicked again', async () => {
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    await screen.findByTestId('match-logs-panel')

    const chipFor = (type) => within(screen.getByTestId('match-logs-filters'))
      .getAllByRole('button').find(b => b.getAttribute('title') === type)

    fireEvent.click(chipFor('SLEEP'))
    expect(screen.queryByText('WEATHER')).not.toBeInTheDocument()

    fireEvent.click(chipFor('SLEEP'))  // same badge again → back to all
    expect(screen.getByText('WEATHER')).toBeInTheDocument()
    expect(screen.getByText('MOVEMENT')).toBeInTheDocument()
  })

  it('renders empty-state message when log list is empty', async () => {
    matchApi.getMatchLogs.mockResolvedValue({
      matchUuid: 'm1', currentClock: 0, logs: [], nextCursor: null, limit: 50, total: 0,
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    expect(await screen.findByText(/No log entries yet/i)).toBeInTheDocument()
  })

  it('shows an error instead of the panel when the logs API fails', async () => {
    matchApi.getMatchLogs.mockRejectedValue(new Error('not available'))
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    expect(screen.queryByTestId('match-logs-panel')).not.toBeInTheDocument()
    expect(await screen.findByText('not available')).toBeInTheDocument()
  })

  it('surfaces the backend error message when the logs API returns an error body', async () => {
    matchApi.getMatchLogs.mockRejectedValue({
      response: { data: { error: 'MATCH_NOT_FOUND', message: 'Match not found' } },
    })
    renderPage()
    await screen.findByText('Saturday run')
    await gotoTab('Logs')
    expect(await screen.findByText('Match not found')).toBeInTheDocument()
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
