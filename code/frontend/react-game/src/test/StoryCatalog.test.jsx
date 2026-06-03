import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import StoryCatalog from '../features/home/StoryCatalog'

const STORIES = [
  { uuid: 's1', title: 'Forest Path',  category: 'Adventure', card: { urlImage: null } },
  { uuid: 's2', title: 'Dragon Keep',  category: 'Adventure', card: { urlImage: null } },
  { uuid: 's3', title: 'Ocean Depths', category: 'Mystery',   card: { urlImage: null } },
]

describe('StoryCatalog', () => {
  it('renders empty state when no stories', () => {
    render(<StoryCatalog stories={[]} onStoryClick={vi.fn()} />)
    expect(screen.getByText('home.noStories')).toBeInTheDocument()
  })

  it('renders empty state when stories is undefined', () => {
    render(<StoryCatalog onStoryClick={vi.fn()} />)
    expect(screen.getByText('home.noStories')).toBeInTheDocument()
  })

  it('renders stories grouped by category', () => {
    render(<StoryCatalog stories={STORIES} onStoryClick={vi.fn()} />)
    expect(screen.getByText('Forest Path')).toBeInTheDocument()
    expect(screen.getByText('Dragon Keep')).toBeInTheDocument()
    expect(screen.getByText('Ocean Depths')).toBeInTheDocument()
    expect(screen.getAllByText('Adventure').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mystery').length).toBeGreaterThan(0)
  })

  it('calls onStoryClick with the correct story when a card is clicked', () => {
    const onStoryClick = vi.fn()
    render(<StoryCatalog stories={STORIES} onStoryClick={onStoryClick} />)
    fireEvent.click(screen.getByText('Forest Path').closest('.pg-card'))
    expect(onStoryClick).toHaveBeenCalledWith(STORIES[0])
  })

  it('shows each category as a section label', () => {
    render(<StoryCatalog stories={STORIES} onStoryClick={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
  })

  it('renders a single category when all stories share one', () => {
    const single = STORIES.slice(0, 2)
    render(<StoryCatalog stories={single} onStoryClick={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
  })

  it('badges stories from the matches: Resume for active, Completed for ended', () => {
    const matches = [
      { uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }, // → Resume
      { uuid: 'm2', storyUuid: 's2', status: 'ENDED' },   // → Completed
      // s3 → no badge
    ]
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={matches} onStoryClick={vi.fn()} />
    )
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.getByText('home.badgeCompleted')).toBeInTheDocument()
    expect(container.querySelectorAll('.story-card-status')).toHaveLength(2)
  })
})
