import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

import MissionCards from '../features/gameplay/cards/MissionCards'
import MissionStepsCards from '../features/gameplay/cards/MissionStepsCards'

/**
 * v0.37.1 — the authored cards of a mission and of its steps, through the REAL Card: every
 * other mission test mocks it away, so nothing until now proved the picture reaches the page.
 */
const MISSION = {
  uuid: 'm-1', name: 'raw name', status: 'ACTIVE',
  card: { title: 'The Journey', description: 'Set out.', urlImage: 'http://x/mission.jpg' },
  steps: [
    { uuid: 's-1', step: 1, name: 'raw step', done: true,
      card: { title: 'Reach the hills', description: 'Walk north.',
              urlImage: 'http://x/step.jpg' } },
    { uuid: 's-2', step: 2, name: 'Climb the peak', done: false },
  ],
}

describe('mission and step cards, rendered', () => {
  it('shows the mission its author wrote: title, picture and the labelled step badge', () => {
    render(<MissionCards missions={[MISSION]} />)

    expect(screen.getByText('The Journey')).toBeInTheDocument()
    expect(screen.getByAltText('The Journey').getAttribute('src')).toBe('http://x/mission.jpg')
    // The badge is full-size on a mission card, so the label reads beside the value.
    const badge = screen.getByTitle('game.missions.progress')
    expect(badge.textContent).toContain('game.missions.progress')
    expect(badge.textContent).toContain('1/2')
  })

  it('shows each step as its own card, the closed one flagged', () => {
    render(<MissionStepsCards mission={MISSION} />)

    expect(screen.getByText('Reach the hills')).toBeInTheDocument()
    expect(screen.getByAltText('Reach the hills').getAttribute('src')).toBe('http://x/step.jpg')
    // A step the author gave no card still renders, under its own name — it is the first
    // one still open, and v0.37.1 shows exactly that one of the open ones.
    expect(screen.getByText('Climb the peak')).toBeInTheDocument()
    expect(screen.getAllByText('game.missions.status.COMPLETED').length).toBeGreaterThan(0)
    // v0.37.1 — every step card carries the (i) that opens its own page on the right.
    expect(screen.getAllByLabelText('card.info')).toHaveLength(2)
  })
})
