import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReportsPage, { utcDay, percent, orDash, buildNames, fetchNames, fetchActiveMatches } from '../../pages/ReportsPage'

vi.mock('../../api/reportApi', () => ({ getKpiReport: vi.fn() }))
vi.mock('../../api/matchApi', () => ({ listMatches: vi.fn(), getMatchInfo: vi.fn() }))
vi.mock('../../api/storyApi', () => ({ listAllStories: vi.fn(), listEntities: vi.fn(), getStory: vi.fn() }))

import { getKpiReport } from '../../api/reportApi'
import { listMatches, getMatchInfo } from '../../api/matchApi'
import { listAllStories, listEntities } from '../../api/storyApi'

const REPORT = {
  storyUuid: 's1', from: '2026-09-28', to: '2026-09-29', groupBy: 'day',
  rows: [
    { period: '2026-09-28', matchesStarted: 3, matchesCompleted: 2, completionRate: 0.6667,
      avgDurationMinutes: 1.54, avgDurationClocks: 2.5, comaCount: 1 },
    { period: '2026-09-29', matchesStarted: 0, matchesCompleted: 0, completionRate: null,
      avgDurationMinutes: null, avgDurationClocks: null, comaCount: 0 },
  ],
  choices: [{ uuid: 'ch-1', count: 3 }, { uuid: 'ch-unnamed-uuid', count: 1 }],
  locations: [{ uuid: 'loc-1', count: 2 }],
  missions: [{ uuid: 'mi-1', activated: 1, completed: 1, failed: 0 }],
}

const ENTITIES = {
  texts: [{ idText: 1, lang: 'en', shortText: 'Open the door' }, { idText: 2, lang: 'en', shortText: 'The mill' },
          { idText: 3, lang: 'en', shortText: 'Find the key' }, { idText: 1, lang: 'it', shortText: 'Apri' }],
  choices: [{ uuid: 'ch-1', idTextName: 1 }],
  locations: [{ uuid: 'loc-1', idTextName: 2 }],
  missions: [{ uuid: 'mi-1', idTextName: 3 }],
}

function renderPage() {
  return render(<MemoryRouter><ReportsPage /></MemoryRouter>)
}

describe('ReportsPage (v0.41.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllStories.mockResolvedValue([{ uuid: 's1', title: 'The Mill' }, { uuid: 's2' }])
    getKpiReport.mockResolvedValue(REPORT)
    listEntities.mockImplementation((_story, type) => Promise.resolve(ENTITIES[type]))
    listMatches.mockImplementation(({ status }) => Promise.resolve({
      items: status === 'RUNNING'
        ? [{ uuid: 'm-run', name: 'robottest run', status: 'RUNNING', currentClock: 3, storyUuid: 's1' }]
        : [{ uuid: 'm-pause', status: 'PAUSED', storyUuid: 's1' }],
    }))
    getMatchInfo.mockResolvedValue({ currentLocationUuid: 'loc-1',
      players: [{ uuid: 'p1', userUuid: 'user-1234567890', life: 7, lifeMax: 10 }, { uuid: 'p2', userUuid: 'u2', life: 3 }] })
  })

  it('loads the last 30 days of every story by day, with the help text of decision 44', async () => {
    renderPage()
    await waitFor(() => expect(getKpiReport).toHaveBeenCalledWith({ from: utcDay(-29), to: utcDay(0), groupBy: 'day' }))
    expect(screen.getByTestId('kpi-help').textContent).toMatch(/counted again/)
    const table = await screen.findByTestId('kpi-table')
    expect(within(table).getByText('66.7%')).toBeInTheDocument()
    expect(within(table).getAllByText('—').length).toBe(3)
    expect(listEntities).not.toHaveBeenCalled()
    expect(screen.getByText('ch-unnam…')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledWith({ status: 'RUNNING', limit: 50 })
    expect(listMatches).toHaveBeenCalledWith({ status: 'PAUSED', limit: 50 })
  })

  it('one story, month grouping: the names come from the story entities', async () => {
    renderPage()
    await screen.findByTestId('kpi-table')
    await screen.findByRole('option', { name: 'The Mill' })
    await userEvent.selectOptions(screen.getByLabelText('Story'), 's1')
    await userEvent.selectOptions(screen.getByLabelText('Group by'), 'month')
    await userEvent.click(screen.getByRole('button', { name: /Load/ }))
    await waitFor(() => expect(getKpiReport).toHaveBeenLastCalledWith(expect.objectContaining({ storyUuid: 's1', groupBy: 'month' })))
    expect(await screen.findByText('Open the door')).toBeInTheDocument()
    expect(screen.getByText('The mill')).toBeInTheDocument()
    expect(screen.getByText('Find the key')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledWith({ status: 'RUNNING', limit: 50, storyUuid: 's1' })
  })

  it('an active match row loads /info only when opened, and closes again', async () => {
    renderPage()
    const table = await screen.findByTestId('active-matches')
    expect(within(table).getByText('robottest run')).toBeInTheDocument()
    expect(getMatchInfo).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Details of m-run' }))
    const info = await screen.findByTestId('active-match-info')
    expect(info.textContent).toMatch(/Players: 2/)
    expect(info.textContent).toMatch(/life 7\/10/)
    expect(info.textContent).toMatch(/life 3/)
    expect(getMatchInfo).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Details of m-run' }))
    expect(screen.queryByTestId('active-match-info')).not.toBeInTheDocument()
  })

  it('a failed /info shows its error; empty lists say so', async () => {
    getMatchInfo.mockRejectedValue(new Error('info down'))
    getKpiReport.mockResolvedValue({ ...REPORT, choices: [], locations: [], missions: [] })
    listMatches.mockImplementation(({ status }) => Promise.resolve(
      { items: status === 'RUNNING' ? [{ uuid: 'm-x', status: 'RUNNING' }] : [] }))
    renderPage()
    expect(await screen.findByText('No choice made.')).toBeInTheDocument()
    expect(screen.getByText('No location visited.')).toBeInTheDocument()
    expect(screen.getByText('No mission moved.')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Details of m-x' }))
    expect(await screen.findByText('info down')).toBeInTheDocument()
  })

  it('report and active-match failures are shown, the report error can be dismissed', async () => {
    getKpiReport.mockRejectedValue({ response: { data: { message: 'groupBy must be day, month or total' } } })
    listMatches.mockRejectedValue(new Error('list down'))
    listAllStories.mockRejectedValue(new Error('stories down'))
    renderPage()
    expect(await screen.findByText('groupBy must be day, month or total')).toBeInTheDocument()
    expect(await screen.findByText('list down')).toBeInTheDocument()
    const alert = screen.getByText('groupBy must be day, month or total').closest('div')
    await userEvent.click(within(alert).getByRole('button'))
    expect(screen.queryByText('groupBy must be day, month or total')).not.toBeInTheDocument()
  })

  it('the date inputs drive the query', async () => {
    listMatches.mockResolvedValue({ items: [] })
    renderPage()
    expect(await screen.findByText('No match is being played.')).toBeInTheDocument()
    const fromInput = screen.getByLabelText('From')
    await userEvent.clear(fromInput)
    await userEvent.type(fromInput, '2026-09-01')
    const toInput = screen.getByLabelText('To')
    await userEvent.clear(toInput)
    await userEvent.type(toInput, '2026-09-02')
    await userEvent.click(screen.getByRole('button', { name: /Load/ }))
    await waitFor(() => expect(getKpiReport).toHaveBeenLastCalledWith({ from: '2026-09-01', to: '2026-09-02', groupBy: 'day' }))
  })
})

describe('ReportsPage helpers', () => {
  it('formats and defaults', () => {
    expect(utcDay(0, Date.UTC(2026, 8, 29, 23, 30))).toBe('2026-09-29')
    expect(utcDay(-29, Date.UTC(2026, 8, 29))).toBe('2026-08-31')
    expect(percent(null)).toBe('—')
    expect(percent(0.5)).toBe('50.0%')
    expect(orDash(undefined)).toBe('—')
    expect(orDash(0)).toBe(0)
  })

  it('buildNames keeps English names only and skips entities without a text', () => {
    const names = buildNames(ENTITIES.texts, [{ uuid: 'a', idTextName: 1 }, { uuid: 'b' }, { uuid: 'c', idTextName: 99 }, null])
    expect([...names.entries()]).toEqual([['a', 'Open the door']])
    expect(buildNames(null).size).toBe(0)
  })

  it('fetchNames tolerates a failed entity list and no story', async () => {
    listEntities.mockImplementation((_s, type) => (type === 'choices' ? Promise.reject(new Error('x')) : Promise.resolve(ENTITIES[type])))
    const names = await fetchNames('s1')
    expect(names.get('loc-1')).toBe('The mill')
    expect(names.has('ch-1')).toBe(false)
    expect((await fetchNames('')).size).toBe(0)
  })

  it('fetchActiveMatches merges running and paused, tolerating an odd page', async () => {
    listMatches.mockImplementation(({ status }) => Promise.resolve(status === 'RUNNING' ? { items: [{ uuid: 'r' }] } : null))
    expect(await fetchActiveMatches('')).toEqual([{ uuid: 'r' }])
  })
})
