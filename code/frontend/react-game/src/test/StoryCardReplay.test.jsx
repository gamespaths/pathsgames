import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import StoryCard from '../features/catalog/StoryCard'

const STORY = { uuid: 's1', title: 'Forest Path', category: 'Adventure', card: { urlImage: null } }

/** v0.36.2 — a story the player has already finished offers Replay, not Play. */
describe('StoryCard — the replay button', () => {
  const renderCard = (badge) => render(
    <StoryCard story={STORY} badge={badge} showActions onClick={vi.fn()} />
  )

  it('says Play on a story never started', () => {
    renderCard(null)
    expect(screen.getByText('home.badgePlay')).toBeInTheDocument()
  })

  it('says Replay once the story has been finished', () => {
    const { container } = renderCard('completed')
    expect(screen.getByText('home.badgeReplay')).toBeInTheDocument()
    expect(screen.queryByText('home.badgePlay')).not.toBeInTheDocument()
    expect(container.querySelector('.fa-rotate-right')).toBeTruthy()
  })

  it('still says Resume on a story with a live match, not Replay', () => {
    renderCard('active')
    expect(screen.getByText('home.badgeResume')).toBeInTheDocument()
    expect(screen.queryByText('home.badgeReplay')).not.toBeInTheDocument()
  })

  it('still says Paused on an admin-paused match', () => {
    const { container } = renderCard('paused')
    expect(container.querySelector('.fa-pause')).toBeTruthy()
    expect(screen.queryByText('home.badgeReplay')).not.toBeInTheDocument()
  })

  it('starts a new match from the replay button — the same click as Play', () => {
    const onClick = vi.fn()
    render(<StoryCard story={STORY} badge="completed" showActions onClick={onClick} />)

    fireEvent.click(screen.getByText('home.badgeReplay'))

    expect(onClick).toHaveBeenCalledWith(STORY)
  })
})
