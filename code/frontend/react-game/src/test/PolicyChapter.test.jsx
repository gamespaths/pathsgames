import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook, POLICY_KINDS } from '../context/PolicyBookContext'
import Book from '../components/book/Book'
import { usePolicyChapter } from '../components/book/PolicyChapter'
import { creditCard } from '../utils/credits'
import images from '../data/images.json'
import shipped from '../data/stories.json'
import en from '../i18n/en.json'

// The credits book lists the catalog stories too; the API answers with the shipped teasers.
vi.mock('../api/stories', () => ({ getStoriesCatalog: vi.fn(async () => shipped) }))

vi.mock('@/consent/cookieConsent', () => ({ openCookiePreferences: vi.fn() }))
import { openCookiePreferences } from '@/consent/cookieConsent'

function Opener({ kind }) {
  const { openPolicyBook } = usePolicyBook()
  return <button onClick={() => openPolicyBook(kind)}>open-{kind}</button>
}

// v1.13.0 — the chapter is shown by the current page's Book, over its own (covered) pages.
function renderBook(kind) {
  const utils = render(
    <LanguageProvider>
      <PolicyBookProvider>
        <Opener kind={kind} />
        <Book left={<span>own-left</span>} right={<span>own-right</span>} />
      </PolicyBookProvider>
    </LanguageProvider>
  )
  fireEvent.click(screen.getByText(`open-${kind}`))
  return utils
}

const titleOf = id => images.find(x => x.id === id).title

describe('PolicyBookContext', () => {
  it('opens only known kinds and closes', () => {
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    expect(result.current.policyBook).toBeNull()
    act(() => result.current.openPolicyBook('privacy'))
    expect(result.current.policyBook).toBe('privacy')
    act(() => result.current.openPolicyBook('nope'))
    expect(result.current.policyBook).toBeNull()
    act(() => result.current.openPolicyBook('credits'))
    act(() => result.current.closePolicyBook())
    expect(result.current.policyBook).toBeNull()
    expect(POLICY_KINDS).toEqual(['privacy', 'terms', 'cookies', 'credits', 'roadmap'])
  })

  it('is inert outside a provider', () => {
    const { result } = renderHook(() => usePolicyBook())
    expect(result.current.policyBook).toBeNull()
    expect(() => result.current.openPolicyBook('terms')).not.toThrow()
    expect(() => result.current.closePolicyBook()).not.toThrow()
  })
})

describe('PolicyChapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no chapter: the Book shows its own pages, no overlay', () => {
    const { container } = render(
      <LanguageProvider><PolicyBookProvider><Book left={<span>own-left</span>} right={null} /></PolicyBookProvider></LanguageProvider>
    )
    expect(container.querySelector('.book-overlay')).toBeNull()
    expect(container.querySelector('.book-content--chapter')).toBeNull()
    expect(screen.getByText('own-left')).toBeVisible()
  })

  it('the left page\'s back arrow closes the chapter: the page comes back exactly as it was', () => {
    const { container } = renderBook('terms')
    expect(container.querySelector('.book-content--covered')).toBeTruthy()
    fireEvent.click(container.querySelector('.book-page-left [data-testid="page-back"]'))
    expect(container.querySelector('.book-content--chapter')).toBeNull()
    expect(container.querySelector('.book-content--covered')).toBeNull()
    expect(screen.getByText('own-left')).toBeInTheDocument()
  })

  it.each([
    ['privacy', 'home-privacy-policy', 12], // v1.2.0 + 2.1 Google sign-in,
    ['terms', 'home-terms-conditions', 15], // v1.2.0 + 3.1 Google accounts,
    ['cookies', 'home-cookies-policy', 6],
  ])('%s: same title on both pages and every section', (kind, imgId, sections) => {
    const { container } = renderBook(kind)
    const title = titleOf(imgId)
    // v1.14.0 one tree: left + right, no mobile copies
    expect(container.querySelectorAll('.book-page-title').length).toBe(2)
    const left = container.querySelector('.book-page-left')
    expect(left.querySelector('.book-page-title').textContent).toContain('paths.games')
    expect(left.querySelector('.book-page-desc').textContent).toContain('open')
    expect(container.querySelector('.book-page-right .book-page-title').textContent).toContain(title)
    expect(container.querySelectorAll('.book-page-left .policy-book-text h6').length).toBe(0)
    expect(container.querySelectorAll('.book-page-right .policy-book-text h6').length).toBe(sections)
    expect(container.querySelector('.policy-book-overlay')).toBeNull()
    expect(container.querySelector('.policy-chapter-mobile, .book-mobile-layout')).toBeNull()
  })

  it('cookies: the manage action opens the consent preferences', () => {
    renderBook('cookies')
    fireEvent.click(screen.getAllByText('Cookie settings')[0])
    expect(openCookiePreferences).toHaveBeenCalled()
  })

  it('privacy has no manage action', () => {
    renderBook('privacy')
    expect(screen.queryByText('Cookie settings')).toBeNull()
  })

  it('credits: the stories first, then every image, each with its type and credit badges', async () => {
    const { container } = renderBook('credits')
    const right = container.querySelector('.book-page-right')
    // no page card wrapping the grid: the grid IS the page
    expect(right.querySelector('.book-page-content')).toBeNull()
    const cards = await waitFor(() => {
      const found = right.querySelectorAll('.credits-cards .pg-card--grid')
      expect(found.length).toBe(images.length + shipped.length)
      return found
    })
    // The stories open the book: their type badge, then the images'.
    expect(cards[0].querySelector('[data-testid="credit-type-story"]').textContent).toBe('Story')
    expect(cards[0].querySelector('[data-testid="credit-copy"]').textContent).toBe('PathsGames')
    expect(cards[shipped.length].querySelector('[data-testid="credit-type-image"]').textContent).toBe('Image')
    // Both badges wear the shared stat-badge pill, never a credits-only look.
    for (const card of cards) {
      for (const testId of ['credit-type-story', 'credit-type-image']) {
        const badge = card.querySelector(`[data-testid="${testId}"]`)
        if (badge) expect(badge.className).toContain('stat-badge bonus-badge')
      }
      const copy = card.querySelector('[data-testid="credit-copy"]')
      if (copy) expect(copy.className).toContain('stat-badge bonus-badge')
    }
  })

  it('credits: the credit button opens the source in a new tab, and there is no (i) any more', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = renderBook('credits')
    const right = container.querySelector('.book-page-right')
    await waitFor(() => expect(right.querySelectorAll('.credits-cards .pg-card--grid').length).toBeGreaterThan(0))
    const idx = images.findIndex(x => x.id === 'home-privacy-policy')
    const card = right.querySelectorAll('.credits-cards .pg-card--grid')[shipped.length + idx]
    const btn = card.querySelector('.gc-footer__btn')
    expect(btn.querySelector('i.fa-external-link-alt')).toBeTruthy()
    expect(btn.textContent).toContain(en.modals.credits.openCredit)
    fireEvent.click(btn)
    expect(open).toHaveBeenCalledWith(images[idx].linkCopyright, '_blank', 'noopener,noreferrer')
    // No preview lens left, so the big-image page is gone too.
    expect(card.querySelector('.card-info-btn')).toBeNull()
    expect(right.querySelector('.book-page-nav--back')).toBeNull()
    open.mockRestore()
  })

  it('credits: an item with no source link gets no button, and keeps its credit badge', async () => {
    const idx = images.findIndex(x => !creditCard(x).linkCopyright)
    expect(idx).toBeGreaterThanOrEqual(0)
    const { container } = renderBook('credits')
    const right = container.querySelector('.book-page-right')
    await waitFor(() => expect(right.querySelectorAll('.credits-cards .pg-card--grid').length).toBeGreaterThan(0))
    const card = right.querySelectorAll('.credits-cards .pg-card--grid')[shipped.length + idx]
    expect(card.querySelector('.gc-footer__btn')).toBeNull()
    // It still shows its type badge, and its credit when it has one.
    expect(card.querySelector('[data-testid="credit-type-image"]')).toBeTruthy()
    const credit = card.querySelector('[data-testid="credit-copy"]')
    credit ? expect(credit.textContent).toBe(creditCard(images[idx]).copyrightText)
           : expect(creditCard(images[idx]).copyrightText).toBeNull()
  })
})

describe('PolicyBookContext v1.13.0 — the page scroll', () => {
  let scrollTo
  beforeEach(() => {
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 })
  })
  afterEach(() => {
    scrollTo.mockRestore()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })

  it('opening stores the scroll and goes to the top; closing restores it', () => {
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.openPolicyBook('privacy'))
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
    act(() => result.current.closePolicyBook())
    expect(scrollTo).toHaveBeenLastCalledWith(0, 420)
  })

  it('a chapter opened from another keeps the first position', () => {
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.openPolicyBook('roadmap'))
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    act(() => result.current.openPolicyBook('credits'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    act(() => result.current.closePolicyBook())
    expect(scrollTo).toHaveBeenLastCalledWith(0, 420)
  })

  it('a route change closes without restoring; closing nothing scrolls nothing', () => {
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.closePolicyBook())
    expect(scrollTo).not.toHaveBeenCalled()
    act(() => result.current.openPolicyBook('terms'))
    scrollTo.mockClear()
    act(() => result.current.closePolicyBook({ restoreScroll: false }))
    expect(result.current.policyBook).toBeNull()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('an unknown kind closes without any scroll', () => {
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.openPolicyBook('nope'))
    expect(result.current.policyBook).toBeNull()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('a scrollTo that throws (no real scroll) is ignored', () => {
    scrollTo.mockImplementation(() => { throw new Error('not implemented') })
    const { result } = renderHook(() => usePolicyBook(), { wrapper: PolicyBookProvider })
    act(() => result.current.openPolicyBook('privacy'))
    act(() => result.current.closePolicyBook())
    expect(result.current.policyBook).toBeNull()
  })
})

describe('usePolicyChapter', () => {
  it('null while no chapter is open, or outside a provider', () => {
    expect(renderHook(() => usePolicyChapter()).result.current).toBeNull()
    expect(renderHook(() => usePolicyChapter(), { wrapper: PolicyBookProvider }).result.current).toBeNull()
  })

  it('the deep-link chapter as { kind, left, right }, keys as text without a language provider', () => {
    window.history.replaceState(null, '', '/?policy=terms')
    const { result } = renderHook(() => usePolicyChapter(), { wrapper: PolicyBookProvider })
    expect(result.current.kind).toBe('terms')
    expect(result.current.left).toBeTruthy()
    expect(result.current.right).toBeTruthy()
    expect(result.current.mobile).toBeUndefined()
    window.history.replaceState(null, '', '/')
  })
})

describe('creditCard', () => {
  it('normalises both images.json shapes', () => {
    expect(creditCard({ id: 'a', title: 'A', urlImage: 'u', copyrightText: 'c', linkCopyright: 'l', description: 'd', styleImageLarge: 'x' }))
      .toEqual({ urlImage: 'u', title: 'A', copyrightText: 'c', linkCopyright: 'l', description: 'd', styleImageLarge: 'x' })
    expect(creditCard({ id: 'b', url: 'u2', author: 'Bob', authorLink: 'l2' }))
      .toEqual({ urlImage: 'u2', title: 'b', copyrightText: 'Bob', linkCopyright: 'l2', description: 'Photo by Bob', styleImageLarge: '' })
    expect(creditCard({ id: 'c' })).toEqual({ urlImage: null, title: 'c', copyrightText: null, linkCopyright: null, description: null, styleImageLarge: '' })
  })
})

// Step 14 — every card grid is a DealtList: its cards are dealt from the deck.
describe('PolicyChapter — dealt grids (step 14)', () => {
  it('the credits list carries pg-dealt', () => {
    const { container } = renderBook('credits')
    expect(container.querySelector('.book-page-right .credits-cards.selection-list.pg-dealt')).toBeInTheDocument()
  })
  it('the roadmap list carries pg-dealt', () => {
    const { container } = renderBook('roadmap')
    expect(container.querySelector('.book-page-right .roadmap-cards.selection-list.pg-dealt')).toBeInTheDocument()
  })
})
