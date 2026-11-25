import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'

vi.mock('@/pages/HomePage', () => ({ default: () => <div data-testid="page">home</div> }))
vi.mock('@/pages/PlayerPage', () => ({ default: () => <div data-testid="page">player</div> }))
vi.mock('@/pages/StoryPage', () => ({ default: () => <div data-testid="page">story</div> }))
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
