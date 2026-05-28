import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../api/matches', () => ({ listMatches: vi.fn() }))
vi.mock('../api/stories',  () => ({ getStory: vi.fn() }))

import UserMatchesList from '../components/modals/user/UserMatchesList'
import { listMatches } from '../api/matches'
import { getStory }    from '../api/stories'

const STORY = { uuid: 's1', title: 'Dragon Keep', card: { title: 'Dragon Keep' } }
const MATCHES = [
  { uuid: 'm1', storyUuid: 's1', status: 'RUNNING',  currentClock: 3,  tsInsert: '2026-05-01T10:00:00Z' },
  { uuid: 'm2', storyUuid: 's1', status: 'ENDED',    currentClock: 20, tsInsert: '2026-04-01T10:00:00Z' },
]

function wrap(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('UserMatchesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMatches.mockResolvedValue(MATCHES)
    getStory.mockResolvedValue(STORY)
  })

  it('shows loading state initially', () => {
    listMatches.mockReturnValue(new Promise(() => {}))
    wrap(<UserMatchesList accessToken="tok" />)
    expect(screen.getByText(/matches\.loading/)).toBeInTheDocument()
  })

  it('renders match cards after load', async () => {
    wrap(<UserMatchesList accessToken="tok" />)
    expect(await screen.findAllByText('Dragon Keep')).toHaveLength(2)
  })

  it('shows title heading', async () => {
    wrap(<UserMatchesList accessToken="tok" />)
    expect(await screen.findByText('matches.title')).toBeInTheDocument()
  })

  it('shows empty message when no matches', async () => {
    listMatches.mockResolvedValue([])
    wrap(<UserMatchesList accessToken="tok" />)
    expect(await screen.findByText('matches.noMatches')).toBeInTheDocument()
  })

  it('shows error message when API fails', async () => {
    listMatches.mockRejectedValue(new Error('Network error'))
    wrap(<UserMatchesList accessToken="tok" />)
    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })

  it('calls listMatches with the provided accessToken', async () => {
    wrap(<UserMatchesList accessToken="my-token" />)
    await waitFor(() => expect(listMatches).toHaveBeenCalledWith('my-token'))
  })

  it('loads unique story UUIDs only once', async () => {
    wrap(<UserMatchesList accessToken="tok" />)
    await waitFor(() => expect(getStory).toHaveBeenCalledTimes(1)) // s1 appears twice but fetched once
  })
})
