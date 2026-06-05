import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/layout/GameCard', () => ({
  default: ({ card, icon, imageAlt }) => (
    <div data-testid="game-card" data-icon={icon} data-alt={imageAlt}>
      {card?.title}
    </div>
  ),
}))

import LocationCard from '../features/gameplay/LocationCard'

describe('LocationCard', () => {
  it('returns null when no location is provided', () => {
    const { container } = render(<LocationCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a GameCard for the location', () => {
    const loc = { name: 'Forest', title: 'Forest', awesomeIcon: 'fas fa-tree' }
    render(<LocationCard location={loc} />)
    expect(screen.getByTestId('game-card')).toBeInTheDocument()
    expect(screen.getByTestId('game-card')).toHaveAttribute('data-icon', 'fas fa-tree')
  })

  it('shows description when present', () => {
    const loc = { name: 'Cave', description: 'A dark cave.' }
    render(<LocationCard location={loc} />)
    expect(screen.getByText('A dark cave.')).toBeInTheDocument()
  })

  it('hides description paragraph when absent', () => {
    const loc = { name: 'Cave' }
    render(<LocationCard location={loc} />)
    expect(screen.queryByRole('paragraph')).toBeNull()
  })

  it('falls back to default icon when awesomeIcon is missing', () => {
    const loc = { name: 'Ruins' }
    render(<LocationCard location={loc} />)
    expect(screen.getByTestId('game-card')).toHaveAttribute('data-icon', 'fas fa-map-marker-alt')
  })
})
