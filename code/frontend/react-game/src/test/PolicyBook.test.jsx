import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook, POLICY_KINDS } from '../context/PolicyBookContext'
import PolicyBook, { creditCard } from '../components/modals/PolicyBook'
import images from '../data/images.json'

vi.mock('@/consent/cookieConsent', () => ({ openCookiePreferences: vi.fn() }))
import { openCookiePreferences } from '@/consent/cookieConsent'

function Opener({ kind }) {
  const { openPolicyBook } = usePolicyBook()
  return <button onClick={() => openPolicyBook(kind)}>open-{kind}</button>
}

function renderBook(kind) {
  const utils = render(
    <LanguageProvider>
      <PolicyBookProvider>
        <Opener kind={kind} />
        <PolicyBook />
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
    expect(POLICY_KINDS).toEqual(['privacy', 'terms', 'cookies', 'credits'])
  })

  it('is inert outside a provider', () => {
    const { result } = renderHook(() => usePolicyBook())
    expect(result.current.policyBook).toBeNull()
    expect(() => result.current.openPolicyBook('terms')).not.toThrow()
    expect(() => result.current.closePolicyBook()).not.toThrow()
  })
})

describe('PolicyBook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing while closed', () => {
    const { container } = render(
      <LanguageProvider><PolicyBookProvider><PolicyBook /></PolicyBookProvider></LanguageProvider>
    )
    expect(container.querySelector('.book-overlay')).toBeNull()
  })

  it.each([
    ['privacy', 'home-privacy-policy', 11],
    ['terms', 'home-terms-conditions', 12],
    ['cookies', 'home-cookies-policy', 6],
  ])('%s: same title on both pages and every section', (kind, imgId, sections) => {
    const { container } = renderBook(kind)
    const title = titleOf(imgId)
    // desktop left + right, plus the mobile stack copies
    expect(container.querySelectorAll('.book-page-title').length).toBe(4)
    const left = container.querySelector('.book-page-left')
    expect(left.querySelector('.book-page-title').textContent).toContain('paths.games')
    expect(left.querySelector('.book-page-desc').textContent).toContain('open')
    expect(container.querySelector('.book-page-right .book-page-title').textContent).toContain(title)
    expect(container.querySelectorAll('.book-page-left .policy-book-text h6').length).toBe(0)
    expect(container.querySelectorAll('.book-page-right .policy-book-text h6').length).toBe(sections)
    expect(container.querySelector('.policy-book-overlay')).toBeTruthy()
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

  it('credits: the right page is the grid of image cards, (i) opens the image page, arrow goes back', () => {
    const { container } = renderBook('credits')
    const right = container.querySelector('.book-page-right')
    // no page card wrapping the grid: the grid IS the page
    expect(right.querySelector('.book-page-content')).toBeNull()
    expect(right.querySelectorAll('.credits-cards .pg-card--grid').length).toBe(images.length)
    // (i) of the first credit card (the privacy home card)
    fireEvent.click(right.querySelectorAll('.credits-cards .gc-footer__btn')[0])
    expect(right.querySelector('.credits-cards')).toBeNull()
    expect(right.querySelector('.book-page-title').textContent).toContain(titleOf('home-privacy-policy'))
    fireEvent.click(right.querySelector('.book-page-nav--back'))
    expect(right.querySelector('.credits-cards')).toBeTruthy()
  })

  it('close resets the credits preview', () => {
    const { container } = renderBook('credits')
    fireEvent.click(container.querySelectorAll('.credits-cards .gc-footer__btn')[0])
    fireEvent.click(container.querySelector('.book-close-btn'))
    expect(container.querySelector('.book-overlay')).toBeNull()
    fireEvent.click(screen.getByText('open-credits'))
    expect(container.querySelector('.book-page-right .credits-cards')).toBeTruthy()
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
