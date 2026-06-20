import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// LocationCard delegates the layout to BookPageContent (card + icon + imageAlt)
// and renders the description paragraph below it. Mock BookPageContent so the
// test focuses on what LocationCard passes/renders.
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, icon, imageAlt, statItemsToPageContent }) => (
    <div data-testid="page-content" data-icon={icon} data-alt={imageAlt}>
      {card?.title}
      {card?.description}
      {statItemsToPageContent?.map(s => (
        <span key={s.key} data-testid={`stat-${s.key}`}>{s.label}:{s.value}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import LocationCard from '../features/gameplay/cards/LocationCard'

describe('LocationCard', () => {
  it('returns null when no location is provided', () => {
    const { container } = render(<LocationCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the location card content', () => {
    const card = { title: 'Forest', awesomeIcon: 'fas fa-tree' }
    render(<LocationCard location={{ name: 'Forest' }} card={card} />)
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toHaveAttribute('data-icon', 'fas fa-tree')
    expect(screen.getByText('Forest')).toBeInTheDocument()
  })

  it('shows the card description when present', () => {
    // The description now lives on the card (rendered by BookPageContent),
    // not on the location object.
    render(<LocationCard location={{ name: 'Cave' }} card={{ description: 'A dark cave.' }} />)
    expect(screen.getByText('A dark cave.')).toBeInTheDocument()
  })

  it('hides description paragraph when absent', () => {
    render(<LocationCard location={{ name: 'Cave' }} card={{}} />)
    expect(screen.queryByRole('paragraph')).toBeNull()
  })

  it('falls back to default icon when awesomeIcon is missing', () => {
    render(<LocationCard location={{ name: 'Ruins' }} card={{}} />)
    expect(screen.getByTestId('page-content')).toHaveAttribute('data-icon', 'fas fa-map-marker-alt')
  })

  it('shows the clock counter as a statistic when greater than zero', () => {
    render(<LocationCard location={{ name: 'Yard', clockCounter: 3 }} card={{ title: 'Yard' }} />)
    expect(screen.getByTestId('stat-clockCounter')).toHaveTextContent('3')
  })

  it('hides the clock counter when zero or missing', () => {
    render(<LocationCard location={{ name: 'Yard', clockCounter: 0 }} card={{ title: 'Yard' }} />)
    expect(screen.queryByTestId('stat-clockCounter')).toBeNull()
    render(<LocationCard location={{ name: 'Hall' }} card={{ title: 'Hall' }} />)
    expect(screen.queryByTestId('stat-clockCounter')).toBeNull()
  })
})
