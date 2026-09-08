import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured = props
    return (
      <div data-testid="mission-card">
        <span data-testid="title">{props.card?.title}</span>
        {props.onAction && <button data-testid="open" onClick={props.onAction}>open</button>}
        {props.onClose && <button data-testid="close" onClick={props.onClose}>close</button>}
      </div>
    )
  },
}))

import MissionCard from '../features/gameplay/cards/MissionCard'
import images from '../data/images.json'

describe('MissionCard (Step 37)', () => {
  it("is the registry card's neighbour: same shape, one footer action", () => {
    render(<MissionCard onOpen={vi.fn()} count={0} />)

    expect(screen.getByTestId('title').textContent).toBe('game.missions.title')
    expect(captured.entityType).toBe('missions')
    expect(captured.actionLabel).toBe('game.missions.openAction')
    const missions = images.find(i => i.id === 'missions')
    expect(missions).toBeTruthy()
    expect(captured.card.urlImage).toBe(missions.urlImage)
  })

  it('badges the OPEN missions, since a count of closed ones reports nothing', () => {
    render(<MissionCard onOpen={vi.fn()} count={2} total={2} />)

    expect(captured.statistics).toEqual([
      { key: 'missions', value: '2', label: 'game.missions.open' },
    ])
  })

  it('adds the total beside it only when some missions are already closed', () => {
    render(<MissionCard onOpen={vi.fn()} count={1} total={4} />)

    expect(captured.statistics.map(s => s.value)).toEqual(['1', '4'])
  })

  it('shows a zero rather than nothing: no mission open is the state worth reporting', () => {
    render(<MissionCard onOpen={vi.fn()} count={0} total={0} />)

    expect(captured.bonusBadgeShowZeros).toBe(true)
    expect(captured.statistics[0].value).toBe('0')
  })

  it('becomes the left reading page, with a way back and no lens', () => {
    const onClose = vi.fn()
    render(<MissionCard variant="page" onClose={onClose} count={1} total={1} />)

    expect(captured.variant).toBe('page')
    expect(captured.hidePreview).toBe(true)
    screen.getByTestId('close').click()
    expect(onClose).toHaveBeenCalled()
  })
})
