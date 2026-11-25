import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import StoryCatalog, { catalogOrder } from '../features/catalog/StoryCatalog'

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

  it('step 14 — renders every story in one dealt list, no category rows', () => {
    const { container } = render(<StoryCatalog stories={STORIES} onStoryClick={vi.fn()} />)
    const list = container.querySelector('.config-view-wrap > .config-cards-area.selection-list.home-stories.pg-dealt')
    expect(list).toBeInTheDocument()
    expect(list.querySelectorAll(':scope > .pg-card')).toHaveLength(3)
    expect(container.querySelectorAll('.selection-list')).toHaveLength(1)
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
    expect(container.querySelector('.stories-section, .section-label, .stories-grid')).toBeNull()
  })

  it('calls onStoryClick with the correct story when the card button is clicked', () => {
    const onStoryClick = vi.fn()
    render(
      <StoryCatalog stories={STORIES} matches={[]} footerState="ready" onStoryClick={onStoryClick} />
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
    expect(container.querySelectorAll('.gc-footer__cards-buttons .fa-spinner')).toHaveLength(3)
    expect(screen.getAllByText('home.loadingMatches')).toHaveLength(3)
    rerender(
      <StoryCatalog stories={STORIES} matches={matches} footerState="ready" onStoryClick={vi.fn()} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(3)
    expect(container.querySelectorAll('.fa-spinner')).toHaveLength(0)
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.getAllByText('home.badgePlay')).toHaveLength(2)
  })

  it('locks every card with "error" when the match list failed (v0.37.6)', () => {
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={null} footerState="error" onStoryClick={vi.fn()} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(0)
    expect(screen.getAllByText('home.footerError')).toHaveLength(3)
    expect(container.querySelectorAll('.gc-footer__cards-buttons .fa-exclamation-triangle')).toHaveLength(3)
  })

  it('locks every card with "blocked" when the antibot check failed (v0.37.6)', () => {
    const onStoryClick = vi.fn()
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={[]} footerState="blocked" onStoryClick={onStoryClick} />
    )
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(0)
    expect(screen.getAllByText('home.footerBlocked')).toHaveLength(3)
    expect(container.querySelectorAll('.gc-footer__cards-buttons .fa-ban')).toHaveLength(3)
    expect(onStoryClick).not.toHaveBeenCalled()
  })

  it('step 14 — keeps the order of today: categories in first-seen order, each story inside its own', () => {
    const mixed = [
      { uuid: 'a', title: 'A1', category: 'Adventure', card: {} },
      { uuid: 'b', title: 'M1', category: 'Mystery', card: {} },
      { uuid: 'c', title: 'A2', category: 'Adventure', card: {} },
    ]
    const { container } = render(<StoryCatalog stories={mixed} onStoryClick={vi.fn()} />)
    const titles = [...container.querySelectorAll('.gc-title__text')].map(el => el.textContent)
    expect(titles).toEqual(['A1', 'A2', 'M1'])
    expect(catalogOrder(mixed).map(s => s.uuid)).toEqual(['a', 'c', 'b'])
  })

  it('step 14 — shows the category badge on each card', () => {
    const { container } = render(<StoryCatalog stories={STORIES} onStoryClick={vi.fn()} />)
    const badges = [...container.querySelectorAll('.pg-card__front .story-card-badge')].map(el => el.textContent)
    expect(badges).toEqual(['Adventure', 'Adventure', 'Mystery'])
  })

  it('badges stories from the matches: Resume button for active, Completed badge for ended', () => {
    const matches = [
      { uuid: 'm1', storyUuid: 's1', status: 'RUNNING' }, // → Resume button
      { uuid: 'm2', storyUuid: 's2', status: 'ENDED' },   // → Completed badge
      // s3 → no badge
    ]
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={matches} footerState="ready" onStoryClick={vi.fn()} />
    )
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.getByText('home.badgeCompleted')).toBeInTheDocument()
    // The completed badge is the only overlay one, with its green check.
    expect(container.querySelectorAll('.story-card-status')).toHaveLength(1)
    expect(container.querySelectorAll('.story-card-status__check')).toHaveLength(1)
    expect(container.querySelectorAll('.story-card-status.stat-badge.bonus-badge')).toHaveLength(1)
  })

  it('badges a PAUSED match with its own label, not Resume (v0.32.1)', () => {
    const matches = [{ uuid: 'm1', storyUuid: 's1', status: 'PAUSED' }]
    const { container } = render(
      <StoryCatalog stories={STORIES} matches={matches} footerState="ready" onStoryClick={vi.fn()} />
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
