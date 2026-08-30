import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import StoryCatalog from '../features/catalog/StoryCatalog'

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

  it('calls onStoryClick with the correct story when the card button is clicked', () => {
    const onStoryClick = vi.fn()
    render(
      <StoryCatalog stories={STORIES} matches={[]} matchesStatus="ready" onStoryClick={onStoryClick} />
    )
    fireEvent.click(screen.getByText('Forest Path').closest('.pg-card').querySelector('.gc-footer__btn'))
    expect(onStoryClick).toHaveBeenCalledWith(STORIES[0])
  })

  it('spins in the footer until the matches answer, then shows Play / Resume', () => {
    const matches = [{ uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }]
    const { container, rerender } = render(
      <StoryCatalog stories={STORIES} onStoryClick={vi.fn()} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(0)
    expect(container.querySelectorAll('.gc-footer__coming-soon .fa-spinner')).toHaveLength(3)
    expect(screen.getAllByText('home.loadingMatches')).toHaveLength(3)
    rerender(
      <StoryCatalog stories={STORIES} matches={matches} matchesStatus="ready" onStoryClick={vi.fn()} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(3)
    expect(container.querySelectorAll('.fa-spinner')).toHaveLength(0)
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.getAllByText('home.badgePlay')).toHaveLength(2)
  })

  it('shows the buttons too when the match list failed, so the story stays clickable', () => {
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={null} matchesStatus="error" onStoryClick={vi.fn()} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(3)
    expect(screen.getAllByText('home.badgePlay')).toHaveLength(3)
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

  it('badges stories from the matches: Resume button for active, Completed badge for ended', () => {
    const matches = [
      { uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }, // → Resume button
      { uuid: 'm2', storyUuid: 's2', status: 'ENDED' },   // → Completed badge
      // s3 → no badge
    ]
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={matches} matchesStatus="ready" onStoryClick={vi.fn()} />
    )
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.getByText('home.badgeCompleted')).toBeInTheDocument()
    // The completed badge is the only overlay one, with its green check.
    expect(container.querySelectorAll('.story-card-status')).toHaveLength(1)
    expect(container.querySelectorAll('.story-card-status__check')).toHaveLength(1)
  })

  it('badges a PAUSED match with its own label, not Resume (v0.32.1)', () => {
    const matches = [{ uuid: 'm1', storyUuid: 's1', status: 'PAUSED' }]
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={matches} matchesStatus="ready" onStoryClick={vi.fn()} />
    )
    expect(screen.getAllByText('home.badgePaused').length).toBeGreaterThan(0)
    expect(screen.queryByText('home.badgeResume')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.story-card-status--paused')).toHaveLength(1)
  })

  it('marks only the clicked story as pending while its match list loads (v0.32.1)', () => {
    const { container } = render(
      <StoryCatalog stories={STORIES} pendingStoryUuid="s2" onStoryClick={vi.fn()} />
    )
    const pending = container.querySelectorAll('.story-card--pending')
    expect(pending).toHaveLength(1)
    expect(pending[0].textContent).toContain('Dragon Keep')
    expect(container.querySelectorAll('.story-card-pending-overlay')).toHaveLength(1)
  })
})
