import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import TurnOrderPanel from '../../components/match/TurnOrderPanel'

const PLAYERS = [
  { uuid: 'c1', characterTemplateUuid: 'ct-a', dexterity: 1, intelligence: 1, constitution: 1, life: 1 },
  { uuid: 'c2', characterTemplateUuid: 'ct-b', dexterity: 9, intelligence: 1, constitution: 1, life: 1 },
  { uuid: 'c3', characterTemplateUuid: 'ct-c', dexterity: 5, intelligence: 1, constitution: 1, life: 1 },
]

describe('TurnOrderPanel', () => {
  it('renders one row per player', () => {
    render(<TurnOrderPanel players={PLAYERS} />)
    expect(screen.getAllByTestId('turn-order-row')).toHaveLength(3)
  })

  it('orders rows highest priority first (#1 is the highest-dexterity character)', () => {
    render(<TurnOrderPanel players={PLAYERS} nameOf={(u) => u} />)
    const rows = screen.getAllByTestId('turn-order-row')
    expect(rows[0]).toHaveTextContent('#1')
    expect(rows[0]).toHaveTextContent('ct-b')
    expect(rows[2]).toHaveTextContent('ct-a')
  })

  it('uses nameOf to resolve the character display name', () => {
    render(<TurnOrderPanel players={[PLAYERS[1]]} nameOf={() => 'Warrior'} />)
    expect(screen.getByText('Warrior')).toBeInTheDocument()
  })

  it('shows the empty state when there are no players', () => {
    render(<TurnOrderPanel players={[]} />)
    expect(screen.getByTestId('turn-order-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('turn-order-list')).not.toBeInTheDocument()
  })

  it('renders safely when players is undefined', () => {
    render(<TurnOrderPanel />)
    expect(screen.getByTestId('turn-order-empty')).toBeInTheDocument()
  })

  it('a player row with no uuid is keyed by its position', () => {
    render(<TurnOrderPanel players={[{ idCharacterMatch: 1 }, { idCharacterMatch: 2 }]} />)
    expect(screen.getAllByTestId('turn-order-row')).toHaveLength(2)
  })
})
