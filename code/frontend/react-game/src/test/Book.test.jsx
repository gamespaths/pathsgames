import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Book from '../components/book/Book'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import { HomeButtonProvider, useHomeButtonHandler } from '../context/HomeButtonContext'

vi.mock('../api/stories', () => ({ getStoriesCatalog: vi.fn(() => Promise.resolve([])) }))

function Where() { return <span data-testid="where">{useLocation().pathname}</span> }

/** Book inside a router (the home tab shows), at /page, with a Home route to land on. */
function inRouter(ui, { handler = null } = {}) {
  function Page() { useHomeButtonHandler(handler); return ui }
  return render(
    <LanguageProvider>
      <PolicyBookProvider>
        <HomeButtonProvider>
          <MemoryRouter initialEntries={['/page']}>
            <Routes>
              <Route path="/" element={<Where />} />
              <Route path="/page" element={<><Page /><Where /></>} />
            </Routes>
          </MemoryRouter>
        </HomeButtonProvider>
      </PolicyBookProvider>
    </LanguageProvider>,
  )
}

const homeTabs = (container) => container.querySelectorAll('.book-bookmark--home')
const rowHome = (container) => container.querySelector('.book-wrapper .book-bookmarks--right .book-bookmark:last-child')

describe('Book', () => {
  it('renders left and right content', () => {
    render(<Book left={<span>Left content</span>} right={<span>Right content</span>} />)
    expect(screen.getByText('Left content')).toBeInTheDocument()
    expect(screen.getByText('Right content')).toBeInTheDocument()
  })

  it('v1.13.0 — no overlay and no close button: an in-flow stage, a shell, then the wrapper', () => {
    const { container } = render(<Book left={null} right={null} />)
    expect(container.querySelector('.book-overlay')).toBeNull()
    expect(container.querySelector('.book-close-btn')).toBeNull()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(container.querySelector('.book-stage > .book-shell > .book-wrapper')).toBeInTheDocument()
  })

  it('applies stageClass and wrapperClass', () => {
    const { container } = render(
      <Book left={null} right={null} stageClass="custom-stage" wrapperClass="book-wrapper custom-wrapper" />
    )
    expect(container.querySelector('.book-stage.custom-stage')).toBeInTheDocument()
    expect(container.querySelector('.book-shell > .custom-wrapper')).toBeInTheDocument()
  })

  it('renders mobile slot when provided', () => {
    render(<Book left={null} right={null} mobile={<div>mobile-ui</div>} />)
    expect(screen.getByText('mobile-ui')).toBeInTheDocument()
  })

  it('slots the bookmarks into the wrapper, one row per page', () => {
    const { container } = render(<Book left={null} right={null}
      bookmarksLeft={[{ key: 'information', label: 'Info' }]}
      bookmarksRight={[{ key: 'items', label: 'Bag' }]} />)

    // Inside .book-wrapper on purpose: the mobile rule hides the wrapper and the tabs with it.
    expect(container.querySelector('.book-wrapper .book-bookmarks--left')).toBeInTheDocument()
    expect(container.querySelector('.book-wrapper .book-bookmarks--right')).toBeInTheDocument()
    expect(screen.getByLabelText('Info')).toBeInTheDocument()
  })

  it('showBookmarks=false takes the tabs away without touching the pages', () => {
    const { container } = render(<Book left={<span>Left content</span>} right={null} showBookmarks={false}
      bookmarksLeft={[{ key: 'information', label: 'Info' }]} />)

    expect(container.querySelector('.book-bookmarks')).toBeNull()
    expect(screen.getByText('Left content')).toBeInTheDocument()
  })

  it('renders no tab row when a book passes no bookmarks at all', () => {
    const { container } = render(<Book left={null} right={null} />)
    expect(container.querySelector('.book-bookmarks')).toBeNull()
  })

  it('renders book-spine inside the wrapper', () => {
    const { container } = render(<Book left={null} right={null} />)
    expect(container.querySelector('.book-wrapper .book-spine')).toBeInTheDocument()
  })

  it('draws the cover ornaments as hidden, inert decorations', () => {
    const { container } = render(<Book left={null} right={null} />)
    const ornaments = container.querySelectorAll('.book-wrapper .book-ornament')
    expect(ornaments.length).toBe(7)
    ornaments.forEach(el => expect(el).toHaveAttribute('aria-hidden', 'true'))
    expect(container.querySelectorAll('.book-corner').length).toBe(4)
    expect(container.querySelectorAll('.book-headband').length).toBe(2)
    expect(container.querySelector('.book-ribbon')).toBeInTheDocument()
  })

  it('writes pageKey and direction on .book-wrapper only', () => {
    const { container } = render(<Book left={null} right={null} pageKey="board" direction="forward" />)
    const wrapper = container.querySelector('.book-wrapper')
    expect(wrapper).toHaveAttribute('data-page-key', 'board')
    expect(wrapper).toHaveAttribute('data-direction', 'forward')
    expect(container.querySelector('.book-stage')).not.toHaveAttribute('data-page-key')
    const plain = render(<Book left={null} right={null} />).container.querySelector('.book-wrapper')
    expect(plain).not.toHaveAttribute('data-page-key')
    expect(plain).not.toHaveAttribute('data-direction')
  })

  it('no tab at all (outside a router, no bookmarks): book-stage--no-tabs', () => {
    const { container } = render(<Book left={null} right={null} />)
    expect(container.querySelector('.book-stage')).toHaveClass('book-stage--no-tabs')
    expect(homeTabs(container).length).toBe(0)
  })

  it('a game tab drops book-stage--no-tabs', () => {
    const { container } = render(<Book left={null} right={null} bookmarksLeft={[{ key: 'a', label: 'A' }]} />)
    expect(container.querySelector('.book-stage')).not.toHaveClass('book-stage--no-tabs')
  })
})

describe('Book — home tab (v1.13.0)', () => {
  it('ends the right row with the home icon, after the page\'s own right tabs', () => {
    const { container } = inRouter(<Book left={null} right={null} bookmarksRight={[{ key: 'mp', label: 'MP' }]} />)
    const last = rowHome(container)
    expect(last).toHaveClass('book-bookmark--home')
    expect(last.querySelector('i')).toHaveClass('fas', 'fa-home')
    expect(last).toHaveAttribute('aria-label', 'Back to the home page')
    expect(last).toHaveAttribute('data-tip', 'Back to the home page')
    expect(last.previousSibling).toHaveAttribute('aria-label', 'MP')
    // its mobile copy sits at the top of the stage, above the stack
    expect(container.querySelector('.book-stage > .book-mobile-home .book-bookmark--home')).toBeInTheDocument()
    expect(container.querySelector('.book-stage')).not.toHaveClass('book-stage--no-tabs')
  })

  it('goes home with navigate("/") when no handler is registered', () => {
    const { container } = inRouter(<Book left={null} right={null} />)
    fireEvent.click(rowHome(container))
    expect(screen.getByTestId('where')).toHaveTextContent('/')
  })

  it('runs the registered handler instead of going home', () => {
    const handler = vi.fn()
    const { container } = inRouter(<Book left={null} right={null} />, { handler })
    fireEvent.click(homeTabs(container)[0])
    expect(handler).toHaveBeenCalledOnce()
    expect(screen.getByTestId('where')).toHaveTextContent('/page')
  })

  it('is not tied to showBookmarks, and absent with homeTab={false}', () => {
    const shown = inRouter(<Book left={null} right={null} showBookmarks={false} bookmarksLeft={[{ key: 'a', label: 'A' }]} />)
    expect(homeTabs(shown.container).length).toBe(2)
    expect(shown.container.querySelector('.book-bookmarks--left')).toBeNull()
    shown.unmount()

    const none = inRouter(<Book left={null} right={null} homeTab={false} />)
    expect(homeTabs(none.container).length).toBe(0)
    expect(none.container.querySelector('.book-stage')).toHaveClass('book-stage--no-tabs')
  })
})

describe('Book — policy chapter (v1.13.0)', () => {
  function Opener({ kind = 'privacy' }) {
    const { openPolicyBook } = usePolicyBook()
    return <button data-testid="open-chapter" onClick={() => openPolicyBook(kind)}>open</button>
  }
  const own = (
    <Book left={<span data-testid="own-left">own-left</span>} right={<span data-testid="own-right">own-right</span>}
      mobile={<span data-testid="own-mobile">own-mobile</span>}
      bookmarksLeft={[{ key: 'map', label: 'Map' }]} bookmarksRight={[{ key: 'mp', label: 'MP' }]} />
  )

  it('shows the chapter pages, keeps the own pages mounted but covered, hides the tabs but the home tab', async () => {
    const { container } = inRouter(<><Opener />{own}</>)
    await act(async () => { fireEvent.click(screen.getByTestId('open-chapter')) })

    expect(container.querySelectorAll('.book-content--chapter').length).toBe(3)
    expect(screen.getAllByText('Privacy Policy').length).toBeGreaterThan(0)
    // own content: still in the DOM (no unmount, no display:none), only covered
    const covered = container.querySelectorAll('.book-content--covered')
    expect(covered.length).toBe(3)
    covered.forEach(el => expect(el).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.getByTestId('own-left').closest('.book-content--covered')).not.toBeNull()
    expect(screen.getByTestId('own-mobile').closest('.book-content--covered')).not.toBeNull()
    // the page's tabs go, the home tab stays (last and only of the right row)
    expect(screen.queryByLabelText('Map')).toBeNull()
    expect(screen.queryByLabelText('MP')).toBeNull()
    expect(rowHome(container)).toHaveClass('book-bookmark--home')
    expect(container.querySelector('.book-wrapper')).toHaveAttribute('data-page-key', 'policy:privacy')

    // the back arrow of the chapter's left page returns to the page exactly as it was
    fireEvent.click(screen.getAllByTestId('page-back')[0])
    expect(container.querySelector('.book-content--covered')).toBeNull()
    expect(screen.getByLabelText('Map')).toBeInTheDocument()
  })

  it('the Home host (no tab at all, also with a chapter open) keeps book-stage--no-tabs', async () => {
    const { container } = inRouter(<><Opener kind="terms" /><Book left={null} right={null} homeTab={false} /></>)
    await act(async () => { fireEvent.click(screen.getByTestId('open-chapter')) })
    expect(container.querySelector('.book-stage')).toHaveClass('book-stage--no-tabs')
    expect(container.querySelector('.book-content--chapter')).toBeInTheDocument()
  })

  it('outside a match the home tab goes home, also with a chapter open', async () => {
    const { container } = inRouter(<><Opener />{own}</>)
    await act(async () => { fireEvent.click(screen.getByTestId('open-chapter')) })
    fireEvent.click(rowHome(container))
    expect(screen.getByTestId('where')).toHaveTextContent('/')
  })

  it('without a language provider the home tab still names itself (the key)', () => {
    const { container } = render(<MemoryRouter><Book left={null} right={null} /></MemoryRouter>)
    expect(container.querySelector('.book-bookmarks--right .book-bookmark--home')).toHaveAttribute('aria-label', 'nav.backHome')
  })
})
