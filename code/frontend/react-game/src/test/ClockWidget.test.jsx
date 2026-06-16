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
  it('renders no clock bar without a clock', () => {
    const { container } = render(<ClockWidget clock={null} />)
    expect(container.querySelector('.player-stats-bar')).toBeNull()
  })

  it('renders the clock value and the story label when clock > 1', () => {
    render(<ClockWidget clock={clock({ currentClock: 2 })} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('hour')).toBeInTheDocument()
  })

  it('uses the singular label when the clock is 1', () => {
    render(<ClockWidget clock={clock({ currentClock: 1 })} />)
    expect(screen.getByText('hour')).toBeInTheDocument()
  })

  it('falls back to "Clock N" when the story has no clock labels', () => {
    render(<ClockWidget clock={clock({ currentClock: 5, clockLabelSingular: null, clockLabelPlural: null })} />)
    expect(screen.getByText('Clock 5')).toBeInTheDocument()
  })

  it('uses the story singular clock label as the badge tooltip (any clock value)', () => {
    const { container } = render(<ClockWidget clock={clock({ currentClock: 5, clockLabelSingular: 'hour' })} />)
    expect(container.querySelector('.stat-badge').getAttribute('title')).toBe('hour')
  })

  it('falls back to game.clock.title for the tooltip when the story has no singular label', () => {
    const { container } = render(<ClockWidget clock={clock({ clockLabelSingular: null })} />)
    expect(container.querySelector('.stat-badge').getAttribute('title')).toBe('game.clock.title')
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
