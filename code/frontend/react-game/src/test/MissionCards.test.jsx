import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

vi.mock('../features/gameplay/cards/MissionStepCard', () => ({
  default: ({ mission, previewSide }) => (
    <div data-testid="mission-row" data-side={previewSide}>{mission.name}</div>
  ),
}))

import MissionCards from '../features/gameplay/cards/MissionCards'

describe('MissionCards (Step 37)', () => {
  const rows = [
    { uuid: 'a', name: 'Zeta', status: 'COMPLETED' },
    { uuid: 'b', name: 'Alpha', status: 'ACTIVE' },
  ]

  it('lists one card per mission, open ones first', () => {
    render(<MissionCards missions={rows} />)

    expect(screen.getAllByTestId('mission-row').map(n => n.textContent))
      .toEqual(['Alpha', 'Zeta'])
  })

  it('owns no data: what it is handed is what it shows', () => {
    render(<MissionCards missions={[]} />)

    expect(screen.getByText('game.missions.empty')).toBeTruthy()
    expect(screen.queryAllByTestId('mission-row')).toHaveLength(0)
  })

  it('says the same for a payload that is not a list at all', () => {
    render(<MissionCards missions={undefined} />)
    expect(screen.getByText('game.missions.empty')).toBeTruthy()
  })

  it('passes the preview side down so the reading page opens where it was asked', () => {
    render(<MissionCards missions={rows} previewSide="left" />)

    expect(screen.getAllByTestId('mission-row')[0].dataset.side).toBe('left')
  })

  it('closes the grid with the cards a caller hands it, even with no mission at all', () => {
    render(<MissionCards missions={[]}><div data-testid="extra">History</div></MissionCards>)
    expect(screen.getByTestId('extra')).toBeTruthy()
    expect(screen.getByText('game.missions.empty')).toBeTruthy()
  })
})
