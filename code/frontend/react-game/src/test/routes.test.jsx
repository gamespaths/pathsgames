import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'

// Step 15 — the Home can say it is busy (as a Book in a play) and the story page records the chapter it mounts with.
const seen = vi.hoisted(() => ({ story: [] }))
vi.mock('@/pages/HomePage', async () => {
  const { useEffect, useRef, useState } = await import('react')
  const { useRouteBook } = await import('../components/book/RouteBook')
  return {
    default: function HomePage() {
      const report = useRouteBook()?.report
      const token = useRef({})
      const [busy, setBusy] = useState(false)
      useEffect(() => { report?.(token.current, busy) }, [report, busy])
      useEffect(() => () => report?.(token.current, false), [report])
      return <div data-testid="page">home<button onClick={() => setBusy(b => !b)}>busy</button></div>
    },
  }
})
vi.mock('@/pages/PlayerPage', () => ({ default: () => <div data-testid="page">player</div> }))
vi.mock('@/pages/StoryPage', async () => {
  const { usePolicyChapter } = await import('../components/book/PolicyChapter')
  return {
    default: function StoryPage() {
      seen.story.push(usePolicyChapter()?.kind ?? 'none')
      return <div data-testid="page">story</div>
    },
  }
})
vi.mock('@/pages/StartMatchPage', () => ({ default: () => <div data-testid="page">start-match</div> }))
vi.mock('@/pages/GamePage', () => ({ default: () => <div data-testid="page">game</div> }))

import AppRoutes from '../app/routes'

function Probe() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { policyBook, openPolicyBook } = usePolicyBook()
  return (
    <>
      <span data-testid="url">{pathname}{search}</span>
      <span data-testid="chapter">{policyBook ?? 'none'}</span>
      <button onClick={() => openPolicyBook('terms')}>open</button>
      <button onClick={() => navigate('/story/s1')}>to-story</button>
      <button onClick={() => navigate('/', { replace: true, state: { any: 1 } })}>same-path</button>
    </>
  )
}

function renderAt(entry) {
  return render(
    <PolicyBookProvider>
      <MemoryRouter initialEntries={[entry]}>
        <AppRoutes />
        <Probe />
      </MemoryRouter>
    </PolicyBookProvider>,
  )
}

describe('AppRoutes (v1.13.0)', () => {
  it('serves /player and /story/:id', () => {
    const { unmount } = renderAt('/player')
    expect(screen.getByTestId('page')).toHaveTextContent('player')
    unmount()
    renderAt('/story/abc')
    expect(screen.getByTestId('page')).toHaveTextContent('story')
  })

  it('serves the existing routes', () => {
    for (const [path, page] of [['/', 'home'], ['/start-match/s1', 'start-match'], ['/play/s1', 'game']]) {
      const { unmount } = renderAt(path)
      expect(screen.getByTestId('page')).toHaveTextContent(page)
      unmount()
    }
  })

  it('a mistyped URL redirects to the Home, keeping the query string and the deep-link chapter', () => {
    window.history.replaceState(null, '', '/nope?policy=privacy')
    renderAt('/nope?policy=privacy')
    expect(screen.getByTestId('url')).toHaveTextContent('/?policy=privacy')
    expect(screen.getByTestId('page')).toHaveTextContent('home')
    expect(screen.getByTestId('chapter')).toHaveTextContent('privacy')
    window.history.replaceState(null, '', '/')
  })

  it('the first render keeps the ?policy= chapter open', () => {
    window.history.replaceState(null, '', '/?policy=cookies')
    renderAt('/?policy=cookies')
    expect(screen.getByTestId('chapter')).toHaveTextContent('cookies')
    window.history.replaceState(null, '', '/')
  })

  it('a route change closes an open chapter and starts the page at the top', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo')
    renderAt('/')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('chapter')).toHaveTextContent('terms')
    scrollTo.mockClear()
    await act(async () => { fireEvent.click(screen.getByText('to-story')) })
    expect(screen.getByTestId('chapter')).toHaveTextContent('none')
    // no restore of the old page's position: only the jump to the top of the new page
    expect(scrollTo.mock.calls).toEqual([[0, 0]])
    scrollTo.mockRestore()
  })

  it('a navigation on the same path (router state only) keeps the chapter', () => {
    renderAt('/')
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('same-path'))
    expect(screen.getByTestId('chapter')).toHaveTextContent('terms')
  })

  it('a scrollTo that throws is ignored', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => { throw new Error('nope') })
    renderAt('/')
    await act(async () => { fireEvent.click(screen.getByText('to-story')) })
    expect(screen.getByTestId('page')).toHaveTextContent('story')
    scrollTo.mockRestore()
  })

  it('without window.scrollTo the route change still closes the chapter', async () => {
    const original = window.scrollTo
    delete window.scrollTo
    try {
      renderAt('/')
      fireEvent.click(screen.getByText('open'))
      await act(async () => { fireEvent.click(screen.getByText('to-story')) })
      expect(screen.getByTestId('chapter')).toHaveTextContent('none')
    } finally {
      window.scrollTo = original
    }
  })
})

describe('AppRoutes — step 15: the shown route (book change, waiting)', () => {
  it('while the book is busy the URL changes at once, the page, its chapter and the scroll wait; then all follow', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo')
    renderAt('/')
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('busy'))
    scrollTo.mockClear()
    await act(async () => { fireEvent.click(screen.getByText('to-story')) })
    expect(screen.getByTestId('url')).toHaveTextContent('/story/s1')
    expect(screen.getByTestId('page')).toHaveTextContent('home')
    expect(screen.getByTestId('chapter')).toHaveTextContent('terms')
    expect(scrollTo).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByText('busy')) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(screen.getByTestId('page')).toHaveTextContent('story')
    expect(screen.getByTestId('chapter')).toHaveTextContent('none')
    expect(scrollTo.mock.calls).toEqual([[0, 0]])
    scrollTo.mockRestore()
  })

  it('the new page mounts without the old page chapter (no back turn under the incoming cover)', async () => {
    seen.story.length = 0
    renderAt('/')
    fireEvent.click(screen.getByText('open'))
    await act(async () => { fireEvent.click(screen.getByText('to-story')) })
    expect(seen.story.length).toBeGreaterThan(0)
    expect(seen.story.every(kind => kind === 'none')).toBe(true)
  })

  it('a deep-link chapter belongs to the page it lands on: kept there, not carried to the next route', async () => {
    seen.story.length = 0
    window.history.replaceState(null, '', '/?policy=cookies')
    renderAt('/?policy=cookies')
    expect(screen.getByTestId('chapter')).toHaveTextContent('cookies')
    await act(async () => { fireEvent.click(screen.getByText('to-story')) })
    expect(seen.story.every(kind => kind === 'none')).toBe(true)
    expect(screen.getByTestId('chapter')).toHaveTextContent('none')
    window.history.replaceState(null, '', '/')
  })
})
