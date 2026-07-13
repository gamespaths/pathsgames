import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/components/ui/BonusBadgeList', () => ({
  default: ({ items }) => (
    <div data-testid="bonus-badge-list">
      {items?.map(i => <span key={i.key} data-testid={`badge-${i.key}`}>{i.value}</span>)}
    </div>
  ),
}))
vi.mock('@/utils/loadoutCards', () => ({
  buildCardToSleep: () => ({ title: 'Sleep Card', description: 'Rest here' }),
}))
vi.mock('@/utils/gamebook', () => ({
  resolveSelectionEntity: () => ({ energy: 10 }),
}))
vi.mock('@/api/matches', () => ({
  sleepCharacter: vi.fn(() => Promise.resolve({ ok: true })),
}))

let capturedOnPreview = null
let capturedOnAction = null
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, onPreview, onAction, actionLabel, entityType, childrenIntoImage }) => {
    capturedOnPreview = onPreview
    capturedOnAction = onAction
    return (
      <div data-testid="sleep-card">
        <span data-testid="card-title">{card?.title}</span>
        {childrenIntoImage && <div data-testid="children-into-image">{childrenIntoImage}</div>}
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onAction && <button data-testid="action-btn" onClick={onAction}>{actionLabel}</button>}
      </div>
    )
  },
}))
vi.mock('./PlayerStats', () => ({ default: () => <div data-testid="player-stats" /> }))

import GoToSleepCard from '../features/gameplay/cards/GoToSleepCard'
import { sleepCharacter } from '../api/matches'

const STORY = { uuid: 's1', title: 'Story' }
const STORY_FULL = {}
const PLAYER_STATS = {
  energy: 30, energyMax: 60, dexterity: 10, intelligence: 8,
  constitution: 12, life: 80, lifeMax: 100, sad: 3, sadMax: 10,
}
const GAME_DATA = {
  info: { locationsActive: [{ secureParam: 3 }] },
}

describe('GoToSleepCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnPreview = null
    capturedOnAction = null
  })

  it('renders the sleep card', () => {
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={GAME_DATA}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid="m1"
        accessToken="tok"
        onSlept={vi.fn()}
      />
    )
    expect(screen.getByTestId('sleep-card')).toBeInTheDocument()
    expect(screen.getByTestId('card-title').textContent).toBe('Sleep Card')
  })

  it('calls sleepCharacter and onSlept when action triggered', async () => {
    const onSlept = vi.fn()
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={GAME_DATA}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid="m1"
        accessToken="tok"
        onSlept={onSlept}
      />
    )
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(sleepCharacter).toHaveBeenCalledWith('m1', 'tok'))
    await waitFor(() => expect(onSlept).toHaveBeenCalled())
  })

  it('does not call sleepCharacter when matchUuid is missing', async () => {
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={GAME_DATA}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid={null}
        accessToken="tok"
        onSlept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(sleepCharacter).not.toHaveBeenCalled())
  })

  it('calls onPreview with safe location data when secureParam > 0', () => {
    const onPreview = vi.fn()
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={GAME_DATA}
        playerStats={PLAYER_STATS}
        onPreview={onPreview}
        matchUuid="m1"
        accessToken="tok"
        onSlept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview).toHaveBeenCalled()
  })

  it('handles sleep error gracefully', async () => {
    sleepCharacter.mockRejectedValueOnce(new Error('network error'))
    const onSlept = vi.fn()
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={GAME_DATA}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid="m1"
        accessToken="tok"
        onSlept={onSlept}
      />
    )
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(sleepCharacter).toHaveBeenCalled())
    expect(onSlept).not.toHaveBeenCalled()
  })

  it('renders unsafe location content when secureParam is 0', () => {
    const unsafeGameData = { info: { locationsActive: [{ secureParam: 0 }] } }
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={unsafeGameData}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid="m1"
        accessToken="tok"
        onSlept={vi.fn()}
      />
    )
    expect(screen.getByTestId('sleep-card')).toBeInTheDocument()
  })

  it('renders when gameData locationsActive is empty', () => {
    const emptyGameData = { info: { locationsActive: [] } }
    render(
      <GoToSleepCard
        story={STORY}
        storyFull={STORY_FULL}
        gameData={emptyGameData}
        playerStats={PLAYER_STATS}
        onPreview={vi.fn()}
        matchUuid="m1"
        accessToken="tok"
        onSlept={vi.fn()}
      />
    )
    expect(screen.getByTestId('sleep-card')).toBeInTheDocument()
  })
})
