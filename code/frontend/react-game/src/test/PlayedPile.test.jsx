import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// v1.15.0 — the face-up pile: the story's card at the bottom, at most five played cards, the last on top; pictures only.

const i18n = vi.hoisted(() => ({ value: { t: k => (k === 'game.playedPile.last' ? 'Last played: {title}' : k) } }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => i18n.value }))

import PlayedPile, { PLAYED_SHOWN } from '../components/book/PlayedPile'

const STORY = { title: 'The Story', image: 'story.png' }
const played = n => Array.from({ length: n }, (_, i) => ({ title: `card ${i + 1}`, image: `c${i + 1}.png` }))
const cards = c => [...c.querySelectorAll('.played-pile > .played-card')]

describe('PlayedPile', () => {
  it('the story card alone before any play: its picture, gold frame class, its title as the tip', () => {
    const { container } = render(<PlayedPile story={STORY} />)
    const [story] = cards(container)
    expect(cards(container)).toHaveLength(1)
    expect(story).toHaveClass('played-card', 'played-card--story')
    expect(story).toHaveAttribute('aria-hidden', 'true')
    expect(story.querySelector('img.played-card__img')).toHaveAttribute('src', 'story.png')
    expect(story.querySelector('.played-card__title')).toHaveTextContent('The Story')
    const pile = container.querySelector('.played-pile')
    expect(pile).toHaveAttribute('data-tip', 'The Story')
    expect(pile).toHaveAttribute('aria-label', 'The Story')
  })

  it('at most five played cards over the story card, the last one on top; the tip names it', () => {
    expect(PLAYED_SHOWN).toBe(5)
    const { container } = render(<PlayedPile story={STORY} played={played(7)} />)
    const all = cards(container)
    expect(all).toHaveLength(6)
    expect(all[0]).toHaveClass('played-card--story')
    expect(all.slice(1).map(c => c.textContent)).toEqual(['card 3', 'card 4', 'card 5', 'card 6', 'card 7'])
    expect(all.filter(c => c.classList.contains('played-card--top'))).toEqual([all[5]])
    expect(container.querySelector('.played-pile')).toHaveAttribute('data-tip', 'Last played: card 7')
    // no text, badge or button on a pile card
    expect(container.querySelector('button, .bonus-badge, .gc-footer')).toBeNull()
  })

  it('v1.15.0 — the title bar on the story card and on every played card, over the picture', () => {
    const { container } = render(<PlayedPile story={STORY} played={played(3)} />)
    const titles = cards(container).map(c => c.querySelector(':scope > .played-card__title')?.textContent)
    expect(titles).toEqual(['The Story', 'card 1', 'card 2', 'card 3'])
    cards(container).forEach(c => expect(c.lastElementChild).toHaveClass('played-card__title'))
  })

  it('a card with no picture or title shows the bare card; no story and no plays: no tip; no translator: the key', () => {
    i18n.value = null
    const { container } = render(<PlayedPile played={[{ title: null, image: null }]} />)
    const [story, top] = cards(container)
    expect(story.childElementCount).toBe(0)
    expect(top).toHaveClass('played-card--top')
    expect(top.childElementCount).toBe(0)
    expect(container.querySelector('.played-pile')).toHaveAttribute('data-tip', 'game.playedPile.last')
    const empty = render(<PlayedPile played={null} />)
    expect(empty.container.querySelector('.played-pile')).not.toHaveAttribute('data-tip')
    expect(cards(empty.container)).toHaveLength(1)
  })
})
