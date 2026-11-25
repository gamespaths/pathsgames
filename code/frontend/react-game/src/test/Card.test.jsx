import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

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

  it('leaves the credits bar to decide: a page with no image link still credits the story', () => {
    render(<Card variant="page" card={{ title: 'T' }} story={{ author: 'Alice' }} />)
    expect(screen.getByTestId('credits-bar')).toBeInTheDocument()
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

  it('v1.11.0 never renders a javascript: copyright link', () => {
    render(
      <Card
        card={{ title: 'Art', linkCopyright: 'javascript:alert(1)', description: 'by author' }}
        showLinkCopyright
      />,
    )
    expect(document.querySelector('a.credits-view-btn')).toBeNull()
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
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

    it('halves the blank lines of the page description (Step 40)', () => {
      const card = { title: 'Cave', description: 'Dark.<br /><br />Cold.' }
      const { container } = render(<Card variant="page" card={card} />)
      expect(container.querySelectorAll('.book-page-desc .book-page-gap')).toHaveLength(1)
      expect(container.querySelectorAll('.book-page-desc br')).toHaveLength(0)
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

describe('Card — page navigation test ids', () => {
  it('marks the back and forward arrows of a reading page', () => {
    render(<Card variant="page" card={{ title: 'T' }} onClose={vi.fn()} onForward={vi.fn()} />)
    expect(screen.getByTestId('page-back')).toBeInTheDocument()
    expect(screen.getByTestId('page-forward')).toBeInTheDocument()
    // v1.13.0 — the arrows' drawn tooltip is their aria-label
    expect(screen.getByTestId('page-back')).toHaveAttribute('data-tip', screen.getByTestId('page-back').getAttribute('aria-label'))
    expect(screen.getByTestId('page-forward')).toHaveAttribute('data-tip', screen.getByTestId('page-forward').getAttribute('aria-label'))
  })
})

describe('Card — step 14 faces', () => {
  const front = c => c.querySelector('.pg-card > .pg-card__face.pg-card__front')
  const back = c => c.querySelector('.pg-card > .pg-card__face.pg-card__back')

  it('a non-page card: the front with today\'s content, then an aria-hidden back with only the d20', () => {
    const { container } = render(<Card card={{ title: 'Mage' }} selected additionalCardClasses="story-netflix-card extra" />)
    const root = container.firstChild
    expect(root).toHaveClass('pg-card', 'pg-card--grid', 'config-card-selected', 'story-netflix-card', 'extra')
    expect(root.children).toHaveLength(2)
    expect(root.children[0]).toBe(front(container))
    expect(root.children[1]).toBe(back(container))
    expect(front(container)).toHaveTextContent('Mage')
    expect(back(container)).toHaveAttribute('aria-hidden', 'true')
    expect(back(container).children).toHaveLength(1)
    expect(back(container).querySelector('svg.pg-d20')).toBeInTheDocument()
    expect(back(container).textContent).toBe('')
  })

  it('every special component lives in the front, none in the back', async () => {
    let done
    const onAction = vi.fn(() => new Promise(r => { done = r }))
    const { container } = render(
      <Card card={{ title: 'Hero', urlImage: 'h.png' }} entityType="class" testId="hero"
        statistics={[{ key: 'dex', value: 1 }]} flagShowFullStatistics titleStatistics={[{ key: 'x', value: 1 }]}
        childrenIntoImage={<span data-testid="overlay">o</span>}
        onPreview={vi.fn()} flagInformationCard onAction={onAction} actionLabel="Go"
        actionsList={[{ label: 'Drop', icon: 'fa-trash', onAction: vi.fn(), testId: 'drop' }]}>
        <span data-testid="child">c</span>
      </Card>,
    )
    const f = front(container)
    expect(f.querySelector('.gc-title .gc-type-badge')).toHaveTextContent('class')
    expect(f.querySelectorAll('[data-testid="bonus-list"]')).toHaveLength(2)
    expect(f).toContainElement(screen.getByTestId('overlay'))
    expect(f).toContainElement(screen.getByTestId('child'))
    expect(f).toContainElement(screen.getByAltText('Hero'))
    expect(f).toContainElement(screen.getByLabelText('card.info'))
    expect(f).toContainElement(screen.getByTestId('hero-action'))
    expect(f).toContainElement(screen.getByTestId('drop'))
    await act(async () => { fireEvent.click(screen.getByTestId('hero-action')) })
    expect(f.querySelector('.gc-footer .fa-spinner')).toBeInTheDocument()
    await act(async () => { done() })
    const b = back(container)
    expect(b.querySelector('.gc-title, .gc-footer, img, button, [data-testid]')).toBeNull()
  })

  it('the locked label and the select button (selected state) sit in the front', () => {
    const locked = render(<Card card={{ title: 'L' }} locked lockedIcon="fas fa-lock" lockInfo={{ label: 'Soon' }} />)
    const lockLabel = locked.container.querySelector('.pg-card__front .gc-footer__cards-buttons')
    expect(lockLabel).toHaveTextContent('Soon')
    expect(lockLabel.querySelector('.fa-lock')).toBeInTheDocument()
    locked.unmount()
    const { container } = render(<Card card={{ title: 'S' }} onSelect={vi.fn()} selected selectLabel="Pick" testId="opt" />)
    const select = screen.getByTestId('opt-select')
    expect(front(container)).toContainElement(select)
    expect(select).toHaveClass('gc-footer__btn--selected')
  })

  it('the page variant has no faces and no back', () => {
    const { container } = render(<Card variant="page" card={{ title: 'Page', description: 'D' }} />)
    expect(container.firstChild).toHaveClass('book-page-content')
    expect(container.querySelector('.pg-card__face, .pg-back, .pg-card')).toBeNull()
    expect(container.querySelector('h2.book-page-title')).toHaveTextContent('Page')
  })

  it('titleTag sets the page title element (default h2)', () => {
    render(<Card variant="page" card={{ title: 'Welcome' }} titleTag="h1" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('book-page-title')
    expect(h1).toHaveTextContent('Welcome')
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })

  it('afterDescription rides inside the page description, right after its text', () => {
    const { container } = render(<Card variant="page" card={{ title: 'Welcome', description: 'Intro text' }}
      afterDescription={<p data-testid="after-desc">Checked</p>} extraContent={<span>foot</span>} />)
    const desc = container.querySelector('.book-page-desc')
    expect(desc).toContainElement(screen.getByTestId('after-desc'))
    expect(desc).toHaveTextContent(/^Intro text\s*Checked$/)
    expect(container.querySelector('.book-page-extra [data-testid="after-desc"]')).toBeNull()
  })
})

