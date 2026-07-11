import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({ default: () => <div data-testid="bonus-list" /> }))
vi.mock('../components/layout/CardCreditsBar', () => ({ default: () => <div data-testid="credits-bar" /> }))

import Card from '../components/layout/Card'

describe('Card', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the card title, falling back to the placeholder icon without an image', () => {
    render(<Card card={{ title: 'Mage' }} />)
    expect(screen.getByText('Mage')).toBeInTheDocument()
    expect(document.querySelector('.gc-placeholder')).toBeTruthy()
  })

  it('renders the image when a urlImage is provided', () => {
    render(<Card card={{ title: 'Hero', urlImage: 'http://x/h.png' }} imageAlt="hero" />)
    const img = screen.getByAltText('hero')
    expect(img.getAttribute('src')).toBe('http://x/h.png')
  })

  it('flagInformationCard wires the info button to onPreview', () => {
    const onPreview = vi.fn()
    render(<Card card={{ title: 'Info' }} flagInformationCard onPreview={onPreview} />)
    fireEvent.click(screen.getByLabelText('card.info'))
    expect(onPreview).toHaveBeenCalled()
  })

  it('renders an info-only button when only onPreview is given', () => {
    const onPreview = vi.fn()
    render(<Card card={{ title: 'Prev' }} onPreview={onPreview} />)
    fireEvent.click(screen.getByLabelText('card.info'))
    expect(onPreview).toHaveBeenCalled()
  })

  it('renders a select button and fires onSelect', () => {
    const onSelect = vi.fn()
    render(<Card card={{ title: 'Pick' }} onSelect={onSelect} selectLabel="Choose" />)
    fireEvent.click(screen.getByText('Choose'))
    expect(onSelect).toHaveBeenCalled()
  })

  it('renders an action button and fires onAction', () => {
    const onAction = vi.fn()
    render(<Card card={{ title: 'Act' }} onAction={onAction} actionLabel="Change" />)
    fireEvent.click(screen.getByText('Change'))
    expect(onAction).toHaveBeenCalled()
  })

  it('shows the locked coming-soon label with its reason', () => {
    render(<Card card={{ title: 'Locked' }} locked lockedReason="soon" lockInfo="LVL5" />)
    expect(screen.getByText('LVL5')).toBeInTheDocument()
  })

  it('renders the copyright view link when enabled and not disabled', () => {
    render(
      <Card
        card={{ title: 'Art', linkCopyright: 'http://author', description: 'by author' }}
        showLinkCopyright
      />,
    )
    const link = screen.getByText('by author').closest('a')
    expect(link.getAttribute('href')).toBe('http://author')
    fireEvent.click(link) // exercises stopPropagation handler
  })

  it('renders the children overlay over the image', () => {
    render(<Card card={{ title: 'Ov' }} childrenIntoImage={<span data-testid="overlay" />} />)
    expect(screen.getByTestId('overlay')).toBeInTheDocument()
  })

  it('renders the entityType badge in the title bar on non-page cards', () => {
    const { container } = render(<Card card={{ title: 'Mage' }} entityType="character" />)
    const badge = container.querySelector('.gc-type-badge')
    expect(badge).toBeTruthy()
    // missing translation key falls back to the raw entityType
    expect(badge.textContent).toBe('character')
  })

  it('does not render the entityType badge when entityType is absent', () => {
    const { container } = render(<Card card={{ title: 'Mage' }} />)
    expect(container.querySelector('.gc-type-badge')).toBeFalsy()
  })

  it('does not render the entityType badge on page variant', () => {
    const { container } = render(
      <Card variant="page" card={{ title: 'Cave' }} entityType="story" />,
    )
    expect(container.querySelector('.gc-type-badge')).toBeFalsy()
  })

  describe('variant="page"', () => {
    it('renders the book page body with title, image and description', () => {
      const card = { title: 'Cave', description: '<b>Dark</b>', urlImage: 'http://x/c.png' }
      const { container } = render(<Card variant="page" card={card} story={{ card }} />)
      expect(screen.getByText('Cave')).toBeInTheDocument()
      expect(container.querySelector('.book-page-content')).toBeTruthy()
      expect(container.querySelector('img.book-page-img')).toBeTruthy()
      expect(container.querySelector('.book-page-desc')).toBeTruthy()
    })

    it('shows the loading spinner and fires onClose from the back button', () => {
      const onClose = vi.fn()
      const { container } = render(
        <Card variant="page" card={{ title: 'T' }} loading onClose={onClose} />
      )
      expect(container.querySelector('.fa-spinner')).toBeTruthy()
      fireEvent.click(screen.getByLabelText('card.back'))
      expect(onClose).toHaveBeenCalled()
    })

    it('renders the back button (left arrow) with the card.back aria-label', () => {
      const { container } = render(<Card variant="page" card={{ title: 'T' }} onClose={vi.fn()} />)
      const btn = container.querySelector('.book-page-nav--back')
      expect(btn).toBeTruthy()
      expect(btn.querySelector('i.fa-arrow-left')).toBeTruthy()
      expect(btn.getAttribute('aria-label')).toBe('card.back')
    })

    it('renders the forward button (right arrow) and fires onForward', () => {
      const onForward = vi.fn()
      const { container } = render(<Card variant="page" card={{ title: 'T' }} onForward={onForward} />)
      const btn = container.querySelector('.book-page-nav--forward')
      expect(btn).toBeTruthy()
      expect(btn.querySelector('i.fa-arrow-right')).toBeTruthy()
      fireEvent.click(screen.getByLabelText('card.forward'))
      expect(onForward).toHaveBeenCalled()
    })

    it('omits the forward button when onForward is absent', () => {
      const { container } = render(<Card variant="page" card={{ title: 'T' }} />)
      expect(container.querySelector('.book-page-nav--forward')).toBeNull()
    })
  })
})
