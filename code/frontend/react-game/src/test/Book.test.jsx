import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Book from '../components/book/Book'
import { LanguageProvider } from '../i18n/context'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import { HomeButtonProvider, useHomeButtonHandler } from '../context/HomeButtonContext'
import { AnimationProvider } from '../context/AnimationContext'
import { PlayProvider } from '../features/gameplay/play/PlayContext'
import { installWaapi } from './fixtures/waapi'
import TooltipLayer, { LONG_PRESS_MS } from '../components/ui/TooltipLayer'

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

  it('v1.14.0 — one tree: each page rendered once, no mobile slot under the shell', () => {
    const { container } = render(<Book left={<span>L</span>} right={<span>R</span>} mobile={<div>mobile-ui</div>} />)
    expect(screen.queryByText('mobile-ui')).toBeNull()
    expect(screen.getAllByText('L')).toHaveLength(1)
    expect(screen.getAllByText('R')).toHaveLength(1)
    expect(container.querySelector('.book-stage').children).toHaveLength(1)
    expect(container.querySelector('.book-mobile-layout, .book-mobile-home')).toBeNull()
  })

  it('step 15 — the pages sit with an empty turn layer; the stage is busy while a card is played', () => {
    const { container, rerender } = render(<Book left={null} right={null} pageKey={3} direction="fade" />)
    expect(container.querySelector('.book-wrapper > .book-turn-layer')).toBeEmptyDOMElement()
    expect(container.querySelector('.book-wrapper')).toHaveAttribute('data-page-key', '3')
    expect(container.querySelector('.book-wrapper')).toHaveAttribute('data-direction', 'fade')
    expect(container.querySelector('.book-stage')).not.toHaveClass('is-busy')
    expect(container.querySelector('.book-stage')).not.toHaveAttribute('inert')
    const playing = { state: { playId: 'a', phase: 'lift', small: true }, api: {} }
    rerender(<PlayProvider controller={playing}><Book left={null} right={null} /></PlayProvider>)
    // inert, not only the mouse: a focused button cannot be pressed with the keyboard either
    expect(container.querySelector('.book-stage')).toHaveClass('is-busy')
    expect(container.querySelector('.book-stage')).toHaveAttribute('inert')
    expect(container.querySelector('.book-stage')).toHaveAttribute('aria-busy', 'true')
  })

  it('step 15 — while the pages turn (simple mode too: the live pages swing) the book, tabs included, is inert', async () => {
    const waapi = installWaapi()
    try {
      const env = { VITE_ANIM_TURN_MODE: 'simple' }
      const book = key => (
        <AnimationProvider env={env}>
          <Book left={<span>L</span>} right={<span>R</span>} pageKey={key} direction="forward"
            bookmarksLeft={[{ key: 'map', label: 'Map' }]} />
        </AnimationProvider>
      )
      const { container, rerender } = render(book(0))
      const stage = container.querySelector('.book-stage')
      rerender(book(1))
      expect(container.querySelector('.book-turn-layer')).toBeEmptyDOMElement()
      expect(stage).toHaveAttribute('inert')
      expect(stage.querySelector('.book-bookmarks--left')).not.toBeNull()
      await act(async () => { waapi.finishAll() })
      expect(stage).not.toHaveAttribute('inert')
      expect(stage).not.toHaveClass('is-busy')
    } finally {
      waapi.restore()
    }
  })

  it('slots the bookmarks into the wrapper, one row per page', () => {
    const { container } = render(<Book left={null} right={null}
      bookmarksLeft={[{ key: 'information', label: 'Info' }]}
      bookmarksRight={[{ key: 'items', label: 'Bag' }]} />)

    // Inside .book-wrapper on purpose: the tabs belong to the cover.
    expect(container.querySelector('.book-wrapper .book-bookmarks--left')).toBeInTheDocument()
    expect(container.querySelector('.book-wrapper .book-bookmarks--right')).toBeInTheDocument()
    expect(screen.getByLabelText('Info')).toBeInTheDocument()
  })

  it('step 16 — both rows inside one .book-bookmarks-row (the phone pills), the right row last', () => {
    const { container } = inRouter(<Book left={null} right={null}
      bookmarksLeft={[{ key: 'information', label: 'Info', active: true }, { key: 'map', label: 'Map' }]}
      bookmarksRight={[{ key: 'mp', label: 'MP' }]} />)
    const rows = container.querySelectorAll('.book-bookmarks-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].parentElement).toHaveClass('book-wrapper')
    expect([...rows[0].children].map(c => c.className)).toEqual([
      'book-bookmarks book-bookmarks--left', 'book-bookmarks book-bookmarks--right'])
    // the home tab ends the merged row: last pill of the last row
    const pills = rows[0].querySelectorAll('.book-bookmark')
    expect(pills[pills.length - 1]).toHaveClass('book-bookmark--home')
    expect(homeTabs(container)).toHaveLength(1)
    // only the active pill carries its label (shown by the phone layout only)
    expect(container.querySelectorAll('.book-bookmark__label')).toHaveLength(1)
    expect(screen.getByLabelText('Info').querySelector('.book-bookmark__label')).toHaveTextContent('Info')
  })

  it('step 16 — a long press on a pill or on the home tab shows the drawn tooltip and never opens it; a tap opens', () => {
    vi.useFakeTimers()
    try {
      const onMap = vi.fn()
      inRouter(<><TooltipLayer /><Book left={null} right={null} bookmarksLeft={[{ key: 'map', label: 'Map', onClick: onMap }]} /></>)
      const longPress = el => {
        fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 5, clientY: 5 })
        act(() => { vi.advanceTimersByTime(LONG_PRESS_MS) })
        fireEvent.pointerUp(el, { pointerType: 'touch' })
        fireEvent.click(el)
      }
      longPress(screen.getByLabelText('Map'))
      expect(screen.getByTestId('pg-tooltip')).toHaveTextContent('Map')
      expect(onMap).not.toHaveBeenCalled()
      longPress(screen.getByLabelText('Back to the home page'))
      expect(screen.getByTestId('pg-tooltip')).toHaveTextContent('Back to the home page')
      expect(screen.getByTestId('where')).toHaveTextContent('/page')
      fireEvent.pointerDown(screen.getByLabelText('Map'), { pointerType: 'touch', clientX: 5, clientY: 5 })
      fireEvent.pointerUp(screen.getByLabelText('Map'), { pointerType: 'touch' })
      fireEvent.click(screen.getByLabelText('Map'))
      expect(onMap).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('step 16 — a page with only the home tab: the row holds it alone; no tab at all, no row', () => {
    const { container } = inRouter(<Book left={null} right={null} />)
    const row = container.querySelector('.book-bookmarks-row')
    expect(row.querySelectorAll('.book-bookmark')).toHaveLength(1)
    expect(row.querySelector('.book-bookmarks--left')).toBeNull()
    const bare = render(<Book left={null} right={null} />)
    expect(bare.container.querySelector('.book-bookmarks-row')).toBeNull()
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

describe('Book — the decks (step 14)', () => {
  // An explicit env: the build's .env.test never decides these tests.
  const withEnv = ui => render(<AnimationProvider env={{}}>{ui}</AnimationProvider>)

  it('lays the table pile inside .book-shell, after and outside .book-wrapper', () => {
    const { container } = withEnv(<Book left={null} right={null} />)
    const pile = container.querySelector('.book-shell > .deck-pile')
    expect(pile).toBeInTheDocument()
    expect(pile.previousElementSibling).toHaveClass('book-wrapper')
    expect(container.querySelector('.book-wrapper .deck-pile')).toBeNull()
    expect(pile.querySelectorAll('.deck-pile__card')).toHaveLength(10)
  })

  it('closes the right page with the page deck', () => {
    const { container } = withEnv(<Book left={<span>L</span>} right={<span>R</span>} />)
    const deck = container.querySelector('.book-page-right > .deck')
    expect(deck).toBeInTheDocument()
    expect(deck.previousElementSibling).toHaveClass('page-inner')
    expect(container.querySelector('.book-page-left .deck')).toBeNull()
  })

  it('none with deck={false}, nor while the deal is off', () => {
    const off = withEnv(<Book left={null} right={null} deck={false} />)
    expect(off.container.querySelector('.deck-pile, .deck')).toBeNull()
    off.unmount()
    const { container } = render(<AnimationProvider env={{ VITE_ANIM_DEAL: 'false' }}><Book left={null} right={null} /></AnimationProvider>)
    expect(container.querySelector('.deck-pile, .deck')).toBeNull()
  })

  it('the pile lies under or over the cover as the deck setting says', () => {
    const { container } = render(<AnimationProvider env={{ VITE_ANIM_DECK: 'over' }}><Book left={null} right={null} /></AnimationProvider>)
    expect(container.querySelector('.deck-pile')).toHaveAttribute('data-place', 'over')
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
    // one tree (v1.14.0): no mobile copy of the home tab, the row's one is the only one
    expect(homeTabs(container)).toHaveLength(1)
    expect(container.querySelector('.book-mobile-home')).toBeNull()
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
    expect(homeTabs(shown.container).length).toBe(1)
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
      bookmarksLeft={[{ key: 'map', label: 'Map' }]} bookmarksRight={[{ key: 'mp', label: 'MP' }]} />
  )

  it('shows the chapter pages, keeps the own pages mounted but covered, hides the tabs but the home tab', async () => {
    const { container } = inRouter(<><Opener />{own}</>)
    await act(async () => { fireEvent.click(screen.getByTestId('open-chapter')) })

    expect(container.querySelectorAll('.book-content--chapter').length).toBe(2)
    expect(screen.getAllByText('Privacy Policy').length).toBeGreaterThan(0)
    // own content: still in the DOM (no unmount, no display:none), only covered
    const covered = container.querySelectorAll('.book-content--covered')
    expect(covered.length).toBe(2)
    covered.forEach(el => expect(el).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.getByTestId('own-left').closest('.book-content--covered')).not.toBeNull()
    expect(screen.getByTestId('own-right').closest('.book-content--covered')).not.toBeNull()
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
