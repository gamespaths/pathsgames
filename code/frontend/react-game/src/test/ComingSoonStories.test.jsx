import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import { comingSoonStories, withComingSoonStories } from '../utils/comingSoonStories'
import StoryCatalog from '../features/catalog/StoryCatalog'
import shipped from '../data/stories.json'

const API_STORY = { uuid: 's1', title: 'Forest Path', category: 'Adventure', card: { urlImage: null } }

describe('comingSoonStories', () => {
  it('ships the teasers of the data file, each flagged comingSoon and drawable', () => {
    const list = comingSoonStories('en')
    expect(list).toHaveLength(shipped.length)
    expect(list.every(s => s.comingSoon === true)).toBe(true)
    expect(list.every(s => s.uuid && s.category && s.card?.urlImage)).toBe(true)
  })

  it('takes the translated title when the language has one, the default otherwise', () => {
    expect(comingSoonStories('it')[0].title).toBe(shipped[0].translations.it.title)
    expect(comingSoonStories('en')[0].title).toBe(shipped[0].title)
    expect(comingSoonStories('fr')[0].title).toBe(shipped[0].title)
    // the raw translations map never reaches the card
    expect(comingSoonStories('it')[0].translations).toBeUndefined()
  })

  it('withComingSoonStories appends them only when asked', () => {
    expect(withComingSoonStories([API_STORY], 'en', false)).toEqual([API_STORY])
    const added = withComingSoonStories([API_STORY], 'en', true)
    expect(added).toHaveLength(4)
    expect(added[0]).toBe(API_STORY)
  })

  it('survives a catalog that is not an array', () => {
    expect(withComingSoonStories(null, 'en', false)).toEqual([])
    expect(withComingSoonStories(undefined, 'en', true)).toHaveLength(3)
  })
})

describe('StoryCard — a coming-soon story', () => {
  it('shows the Coming Soon label instead of a button and cannot be clicked', () => {
    const onStoryClick = vi.fn()
    const stories = withComingSoonStories([API_STORY], 'en', true)
    const { container } = render(
      <StoryCatalog stories={stories} matches={[]} matchesStatus="ready" onStoryClick={onStoryClick} />
    )
    // only the API story keeps a footer button
    expect(container.querySelectorAll('.gc-footer__btn')).toHaveLength(1)
    expect(screen.getAllByText('book.comingSoon')).toHaveLength(3)
    expect(container.querySelectorAll('.story-card--soon')).toHaveLength(3)
    expect(onStoryClick).not.toHaveBeenCalled()
  })

  it('keeps its Coming Soon label while the matches are still loading', () => {
    const stories = withComingSoonStories([API_STORY], 'en', true)
    const { container } = render(<StoryCatalog stories={stories} onStoryClick={vi.fn()} />)
    expect(screen.getAllByText('book.comingSoon')).toHaveLength(shipped.length)
    // only the playable story waits for the match list
    expect(screen.getAllByText('home.loadingMatches')).toHaveLength(1)
    expect(container.querySelectorAll('.fa-hourglass-half')).toHaveLength(shipped.length)
  })

  it('files each teaser under its own category section', () => {
    const stories = withComingSoonStories([API_STORY], 'en', true)
    render(<StoryCatalog stories={stories} matchesStatus="ready" onStoryClick={vi.fn()} />)
    // One section per distinct category, teasers merged into the API ones they share.
    const categories = new Set(stories.map(s => s.category))
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(categories.size)
  })
})
