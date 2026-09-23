import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// PageRightMain — when the end-game card is on the board, the sleep card never shows.

vi.mock('@/components/layout/Card', () => ({ default: () => <div data-testid="info-card" /> }))
vi.mock('../features/gameplay/cards/PlayerStats', () => ({ default: () => null }))
vi.mock('../features/gameplay/cards/ComaCard', () => ({ default: () => null }))
vi.mock('../features/gameplay/cards/ExperienceCard', () => ({ default: () => null }))
vi.mock('../features/gameplay/cards/MovementCard', () => ({ default: () => null }))
vi.mock('../features/gameplay/cards/ActionCard', () => ({ default: () => <div data-testid="action-card" /> }))
vi.mock('../features/gameplay/cards/EndGameCard', () => ({ default: () => <div data-testid="end-game-card" /> }))
vi.mock('../features/gameplay/cards/GoToSleepCard', () => ({ default: () => <div data-testid="sleep-card" /> }))
vi.mock('@/utils/gamebook', () => ({
  buildCardCharacteristics: () => ({}),
  checkShowToSleepCard: () => true,
  movementCostKey: () => 'k',
}))
vi.mock('@/utils/experience', () => ({ canUseExp: () => false }))

import PageRightMain from '../features/gameplay/PageRightMain'

const renderWith = (actions, sleepCardForced = false) => render(
  <PageRightMain t={k => k} story={{}} actions={actions} locations={[]} locationCosts={{}}
    playerStats={{}} sleepCardForced={sleepCardForced} />)

describe('PageRightMain — the end-game card hides the sleep card', () => {
  it('shows the sleep card when there is no end-game action', () => {
    renderWith([{ uuid: 'a1', endGame: false }])
    expect(screen.getByTestId('sleep-card')).toBeInTheDocument()
  })

  it('never shows it next to the end-game card, not even when forced', () => {
    renderWith([{ uuid: 'a1', endGame: false }, { uuid: 'a2', endGame: true }], true)
    expect(screen.getByTestId('end-game-card')).toBeInTheDocument()
    expect(screen.queryByTestId('sleep-card')).not.toBeInTheDocument()
  })

  it('tolerates a board with no actions at all', () => {
    renderWith(undefined)
    expect(screen.getByTestId('sleep-card')).toBeInTheDocument()
  })
})
