import { describe, it, expect } from 'vitest'
import { creditCard, creditStories, creditImages, creditsEntries } from '../utils/credits'
import images from '../data/images.json'
import shipped from '../data/stories.json'

describe('creditCard', () => {
  it('normalises both images.json shapes', () => {
    expect(creditCard({ id: 'a', title: 'A', urlImage: 'u', copyrightText: 'c', linkCopyright: 'l', description: 'd', styleImageLarge: 'x' }))
      .toEqual({ urlImage: 'u', title: 'A', copyrightText: 'c', linkCopyright: 'l', description: 'd', styleImageLarge: 'x' })
    expect(creditCard({ id: 'b', url: 'u2', author: 'Bob', authorLink: 'l2' }))
      .toEqual({ urlImage: 'u2', title: 'b', copyrightText: 'Bob', linkCopyright: 'l2', description: 'Photo by Bob', styleImageLarge: '' })
    expect(creditCard({ id: 'c' })).toEqual({ urlImage: null, title: 'c', copyrightText: null, linkCopyright: null, description: null, styleImageLarge: '' })
  })
})

describe('creditStories', () => {
  it('keeps every story once: the service list first, then the shipped teasers', () => {
    const first = shipped[0]
    const entries = creditStories([first, { uuid: 'from-service', title: 'X', author: 'Bob',
      card: { urlImage: 'img', linkCopyright: 'link' } }], 'en')
    expect(entries.length).toBe(shipped.length + 1)
    // A uuid present in both lists is credited once, service side wins.
    expect(entries.filter(e => e.key === `story:${first.uuid}`).length).toBe(1)
    expect(entries[0].kind).toBe('story')
    expect(entries[0].card.copyrightText).toBe('PathsGames')
    expect(entries[0].card.linkCopyright).toBe(first.card.linkCopyright)
    // The service list comes before the shipped teasers.
    expect(entries[1].card.title).toBe('X')
    expect(entries[1].card.copyrightText).toBe('Bob')
  })

  it('translates the shipped teasers and survives a broken service list', () => {
    expect(creditStories(null, 'it')[0].card.title).toBe(shipped[0].translations.it.title)
    expect(creditStories(undefined, 'en').length).toBe(shipped.length)
    // A story with nothing but a uuid still gets a card, never a crash.
    const [bare] = creditStories([{ uuid: 'bare' }], 'en')
    expect(bare.card.title).toBe('bare')
    expect(bare.card.urlImage).toBeNull()
    expect(bare.card.copyrightText).toBeNull()
    expect(bare.card.linkCopyright).toBeNull()
  })
})

describe('creditsEntries', () => {
  it('lists the stories before every image, each keyed by kind', () => {
    const entries = creditsEntries({ stories: shipped, lang: 'en' })
    expect(entries.length).toBe(shipped.length + images.length)
    // The teasers come from both lists here, so they are credited once: 3 stories + 43 images.
    expect(entries.slice(0, shipped.length).every(e => e.kind === 'story')).toBe(true)
    expect(entries.slice(shipped.length).every(e => e.kind === 'image')).toBe(true)
    expect(new Set(entries.map(e => e.key)).size).toBe(entries.length)
  })

  it('creditImages wraps every image.json entry', () => {
    const entries = creditImages()
    expect(entries.length).toBe(images.length)
    expect(entries[0]).toEqual({ key: `image:${images[0].id}`, kind: 'image', card: creditCard(images[0]) })
    expect(creditImages(null)).toEqual([])
  })
})