import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({
  default: ({ className }) => <div data-testid="bonus-list" className={className} />,
}))
vi.mock('../components/layout/CardCreditsBar', () => ({ default: () => <div data-testid="credits-bar" /> }))

import Card from '../components/layout/Card'

/**
 * Card renders four variants over data that may name none of the style columns:
 * the story author fills `styleImageLarge/Medium/Little` only when they want a
 * per-size look, and most cards carry none of them.
 */

describe('Card variants and fallbacks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the large image style for the big variant and the medium one for medium', () => {
    const card = {
      title: 'Hero', urlImage: 'h.png', styleDetail: 'detail',
      styleImageLarge: 'large-style', styleImageMedium: 'medium-style', styleImageLittle: 'little-style',
    }

    const { rerender } = render(<Card card={card} variant="big" imageAlt="hero" />)
    expect(screen.getByAltText('hero').className).toContain('large-style')

    rerender(<Card card={card} variant="medium" imageAlt="hero" />)
    expect(screen.getByAltText('hero').className).toContain('medium-style')

    rerender(<Card card={card} variant="small" imageAlt="hero" />)
    expect(screen.getByAltText('hero').className).toContain('little-style')
  })

  it('falls back to no image style at all when the card names none', () => {
    const card = { title: 'Plain', urlImage: 'p.png' }

    const { rerender } = render(<Card card={card} variant="big" imageAlt="plain" />)
    expect(screen.getByAltText('plain').className).toBe('gc-img')

    rerender(<Card card={card} variant="medium" imageAlt="plain" />)
    expect(screen.getByAltText('plain').className).toBe('gc-img')
  })

  it('names the card by the entity when the card itself has no title', () => {
    render(<Card card={{}} entity={{ name: 'From the entity' }} />)
    expect(screen.getByText('From the entity')).toBeInTheDocument()
  })

  it('falls back to a dash when nothing names the card', () => {
    render(<Card card={{}} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('uses the alternative image when the main one is missing', () => {
    render(<Card card={{ title: 'Alt', alternativeImage: 'alt.png' }} imageAlt="alt" />)
    expect(screen.getByAltText('alt').getAttribute('src')).toBe('alt.png')
  })

  it('ignores the info button when no preview handler is wired', () => {
    render(<Card card={{ title: 'Info' }} flagInformationCard />)
    fireEvent.click(screen.getByLabelText('card.info'))
    expect(screen.getByText('Info')).toBeInTheDocument()   // nothing blew up, nothing opened
  })

  it('labels the copyright link with the card description when it has one', () => {
    render(<Card
      card={{ title: 'Art', linkCopyright: 'http://example.com', description: 'By the artist' }}
      showLinkCopyright />)

    expect(screen.getByRole('link', { name: /By the artist/ })).toBeInTheDocument()
  })

  it('hides the copyright link on a disabled card', () => {
    render(<Card card={{ title: 'Art', linkCopyright: 'http://example.com' }} showLinkCopyright disabled />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the raw entity type when the translation is missing', () => {
    render(<Card card={{ title: 'Typed' }} entityType="klass" />)
    expect(screen.getByText('klass')).toBeInTheDocument()
  })

  it('puts the badge list over the image only when the full statistics are asked for', () => {
    const statistics = [{ key: 'life', label: 'Life', value: 2 }]

    const { rerender } = render(<Card card={{ title: 'S' }} statistics={statistics} />)
    expect(screen.getByTestId('bonus-list').className).toContain('float-right')

    rerender(<Card card={{ title: 'S' }} statistics={statistics} flagShowFullStatistics bonusBadgeListLittleIntoImage />)
    expect(screen.getByTestId('bonus-list').className).toContain('gc-img__overlay')
  })

  it('renders no badge list at all for an empty statistics array', () => {
    render(<Card card={{ title: 'S' }} statistics={[]} />)
    expect(screen.queryByTestId('bonus-list')).not.toBeInTheDocument()
  })

  it('renders the page variant with its description, extra content and stat items', () => {
    render(<Card
      variant="page"
      card={{ title: 'Chapter', description: 'Once upon a time' }}
      entity={{ name: 'Chapter', description: 'entity description' }}
      entityType="location"
      statItemsToPageContent={[{ key: 'life', label: 'Life', value: 3 }]}
      extraContent={<span>extra</span>}
      extraContentClassName="extra-class"
      additionalCardClasses="more-classes" />)

    expect(screen.getByText('Once upon a time')).toBeInTheDocument()
    expect(screen.getByText('extra')).toBeInTheDocument()
    expect(document.querySelector('.extra-class')).toBeTruthy()
    expect(document.querySelector('.more-classes')).toBeTruthy()
  })

  it('falls back to the entity description on a page whose card has none', () => {
    render(<Card variant="page" card={{ title: 'Chapter' }} entity={{ description: 'entity description' }} />)
    expect(screen.getByText('entity description')).toBeInTheDocument()
  })
})
