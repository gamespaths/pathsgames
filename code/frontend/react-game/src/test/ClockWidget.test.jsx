import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (k) => (k === 'game.clock.fallback' ? 'Clock {n}' : k),
    lang: 'en',
    setLang: vi.fn(),
  }),
}))

import ClockWidget from '../features/gameplay/ClockWidget'

const clock = (over = {}) => ({
  matchUuid: 'm1',
  currentClock: 2,
  clockLabelSingular: 'hour',
  clockLabelPlural: 'hours',
  anyCharacterSleeping: false,
  characters: [],
  ...over,
})

describe('ClockWidget', () => {
  it('renders nothing without a clock', () => {
    const { container } = render(<ClockWidget clock={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the clock value and plural label when clock > 1', () => {
    render(<ClockWidget clock={clock({ currentClock: 2 })} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('hours')).toBeInTheDocument()
  })

  it('uses the singular label when the clock is 1', () => {
    render(<ClockWidget clock={clock({ currentClock: 1 })} />)
    expect(screen.getByText('hour')).toBeInTheDocument()
  })

  it('falls back to "Clock N" when the story has no clock labels', () => {
    render(<ClockWidget clock={clock({ currentClock: 5, clockLabelSingular: null, clockLabelPlural: null })} />)
    expect(screen.getByText('Clock 5')).toBeInTheDocument()
  })

  it('shows a sleeping badge when any character is sleeping', () => {
    render(<ClockWidget clock={clock({ anyCharacterSleeping: true })} />)
    expect(screen.getByText('game.sleep.sleeping')).toBeInTheDocument()
  })

  it('hides the sleeping badge when nobody is sleeping', () => {
    render(<ClockWidget clock={clock({ anyCharacterSleeping: false })} />)
    expect(screen.queryByText('game.sleep.sleeping')).not.toBeInTheDocument()
  })
})
