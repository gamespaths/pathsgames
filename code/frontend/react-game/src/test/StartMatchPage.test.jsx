import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../context/GuestUserContext', () => ({
  useGuestUser: () => ({
    user: { userUuid: 'u1', username: 'guest_u1', accessToken: 'tok-1' },
  }),
}))
vi.mock('../api/matches', () => ({ createMatch: vi.fn() }))

import StartMatchPage from '../pages/StartMatchPage'
import { createMatch } from '../api/matches'

const STORY = {
  uuid: 's1',
  title: 'The Lost Crown',
  card: { title: 'The Lost Crown', description: 'An epic quest.' },
}
const CONFIG = {
  character:  { uuid: 'ch1', name: 'Ranger' },
  class:      { uuid: 'cl1', name: 'Mage' },
  trait:      { uuid: 'tr1', name: 'Brave' },
  difficulty: { uuid: 'df1', name: 'Normal' },
}

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/start-match/s1', state }]}>
      <Routes>
        <Route path="/start-match/:storyId" element={<StartMatchPage />} />
        <Route path="/" element={<div>home-page</div>} />
        <Route path="/play/:storyId" element={<div>game-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StartMatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_MATCH_START_DELAY', '3') // 3s waits keep the test fast
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('redirects home when navigation state is missing', () => {
    renderPage(undefined)
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })

  it('renders the story card and the starting status', () => {
    renderPage({ story: STORY, config: CONFIG })
    expect(screen.getAllByText('The Lost Crown').length).toBeGreaterThan(0)
    expect(screen.getByText(/startMatch\.starting/)).toBeInTheDocument()
  })

  it('creates the match after the delay with the full loadout', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(1)
    const [payload, token] = createMatch.mock.calls[0]
    expect(payload).toMatchObject({
      storyUuid: 's1',
      difficultyUuid: 'df1',
      classUuid: 'cl1',
      characterTemplateUuid: 'ch1',
      traitUuids: ['tr1'],
      singlePlayer: 1,
    })
    expect(token).toBe('tok-1')
    expect(screen.getByText(/startMatch\.created/)).toBeInTheDocument()
  })

  it('jumps to the game page after the created delay', async () => {
    createMatch.mockResolvedValue({ uuid: 'm1', status: 'CREATED' })
    renderPage({ story: STORY, config: CONFIG })

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) }) // starting → create
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) }) // created → game

    expect(screen.getByText('game-page')).toBeInTheDocument()
  })

  it('shows an error and retries when match creation fails', async () => {
    createMatch.mockRejectedValueOnce(new Error('STORY_HAS_NO_LOCATIONS'))
    renderPage({ story: STORY, config: CONFIG })

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText(/startMatch\.error/)).toBeInTheDocument()
    expect(screen.getByText('STORY_HAS_NO_LOCATIONS')).toBeInTheDocument()

    createMatch.mockResolvedValueOnce({ uuid: 'm2', status: 'CREATED' })
    await act(async () => { fireEvent.click(screen.getByText(/startMatch\.retry/)) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(createMatch).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/startMatch\.created/)).toBeInTheDocument()
  })
})
