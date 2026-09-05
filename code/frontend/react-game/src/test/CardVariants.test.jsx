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

/**
 * The page variant places the bonus badges in one of three slots, and the title/extra
 * slots have their own on/off props. Each combination is a branch nothing else takes.
 */
describe('Card — the page variant and its badge slots', () => {
  const CARD = { uuid: 'card-1', title: 'Chapter', description: 'A long description', urlImage: 'p.png' }
  const ITEMS = [{ key: 'life', label: 'Life', value: 3 }]

  it('puts the badges in the description slot', () => {
    render(<Card card={CARD} variant="page" positionBonusBadge="desc" statItemsToPageContent={ITEMS} />)
    const badge = screen.getByTestId('bonus-list')
    expect(badge.className).toContain('book-page-stats')
    expect(badge.closest('.book-page-desc')).not.toBeNull()
  })

  it('puts the badges in the extra slot, with the class the caller named', () => {
    render(<Card card={CARD} variant="page" positionBonusBadge="extra"
                 statItemsToPageContent={ITEMS} extraContentClassName="my-extra" />)
    const extra = screen.getByTestId('bonus-list').closest('.book-page-extra')
    expect(extra.className).toContain('my-extra')
  })

  it('renders the extra slot with no class when the caller names none', () => {
    render(<Card card={CARD} variant="page" positionBonusBadge="extra"
                 extraContent={<span data-testid="extra-content" />} />)
    expect(screen.getByTestId('extra-content')).toBeInTheDocument()
    expect(screen.queryByTestId('bonus-list')).toBeNull()
  })

  it('overlays the badges on the image and keeps the large image style', () => {
    render(<Card card={{ ...CARD, styleImageLarge: 'large-style' }} variant="page"
                 statItemsToPageContent={ITEMS} imageAlt="page" />)
    expect(screen.getByAltText('page').className).toContain('large-style')
    expect(screen.getByTestId('bonus-list').closest('.book-page-img-badge-overlay')).not.toBeNull()
  })

  it('a page with no bonus items shows no badge at all', () => {
    render(<Card card={CARD} variant="page" statItemsToPageContent={[]} />)
    expect(screen.queryByTestId('bonus-list')).toBeNull()
  })

  it('the back and forward buttons appear only when their handler is given', () => {
    const onClose = vi.fn()
    const onForward = vi.fn()
    const { rerender } = render(<Card card={CARD} variant="page" />)
    expect(screen.queryByLabelText('card.back')).toBeNull()
    expect(screen.queryByLabelText('card.forward')).toBeNull()

    rerender(<Card card={CARD} variant="page" onClose={onClose} onForward={onForward} />)
    fireEvent.click(screen.getByLabelText('card.back'))
    fireEvent.click(screen.getByLabelText('card.forward'))
    expect(onClose).toHaveBeenCalled()
    expect(onForward).toHaveBeenCalled()
  })
})

describe('Card — title badges and the image overlay', () => {
  it('titleStatistics ride in the title whatever flagShowFullStatistics says', () => {
    render(<Card card={{ title: 'Hero' }} titleStatistics={[{ key: 'life', value: 1 }]}
                 flagShowFullStatistics />)
    expect(screen.getByTestId('bonus-list').className).toContain('config-total-bonus')
  })

  it('the full-statistics overlay takes the little class only when asked', () => {
    const stats = [{ key: 'life', value: 1 }]
    const { rerender } = render(<Card card={{ title: 'Hero' }} statistics={stats} flagShowFullStatistics />)
    expect(screen.getByTestId('bonus-list').className).not.toContain('config-total-bonus-little')

    rerender(<Card card={{ title: 'Hero' }} statistics={stats} flagShowFullStatistics
                   bonusBadgeListLittleIntoImage />)
    expect(screen.getByTestId('bonus-list').className).toContain('config-total-bonus-little')
  })

  it('the entity-type badge falls back to the raw type when there is no translation', () => {
    render(<Card card={{ title: 'Hero' }} entityType="items" />)
    // The mocked t() echoes the key, so the component reads it as "untranslated".
    expect(screen.getByText('items')).toBeInTheDocument()
  })

  it('the copyright link shows the card description when it has one', () => {
    render(<Card card={{ title: 'Hero', linkCopyright: 'http://cc.example', description: 'Photo by Ada' }}
                 showLinkCopyright />)
    expect(screen.getByText(/Photo by Ada/)).toBeInTheDocument()
  })

  it('the copyright link falls back to the generic label with no description', () => {
    render(<Card card={{ title: 'Hero', linkCopyright: 'http://cc.example' }} showLinkCopyright />)
    expect(screen.getByText(/card.viewOriginal/)).toBeInTheDocument()
  })
})
