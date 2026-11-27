import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import RouteBook from '../components/book/RouteBook'
import Book from '../components/book/Book'
import { HomeButtonProvider } from '../context/HomeButtonContext'
import { installWaapi } from './fixtures/waapi'

// Step 15 review — the brand reloads only with the Home shown and settled; during a change to it, nothing.

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: key => key, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/context/HomeStatusContext', () => ({ useHomeStatus: () => ({ error: null, setError: vi.fn() }) }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { username: 'guest' }, loading: false, setMatches: vi.fn() }),
}))

const TIMINGS = { open: 650, close: 260, fade: 200, flip: 900, slide: 600, sheet: 620, simple: 520, zoom: 320 }
const ANIM = { cover: true, turn: true, turnMode: 'full', reduced: false, coverMax: 10, timings: TIMINGS }
const holds = {}
let shownKey = null

function Probe() {
  const location = useLocation()
  shownKey = location.key
  return <span data-testid="url">{location.pathname}</span>
}

function Page({ name }) {
  const [held, setHeld] = useState(false)
  holds[name] = setHeld
  return <Book left={<p data-testid="page">{name}</p>} right={null} holdTurn={held} coverTitle={name} />
}

function renderAt(path) {
  return render(
    <HomeButtonProvider>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
        <Probe />
        <Harness />
      </MemoryRouter>
    </HomeButtonProvider>,
  )
}

function Harness() {
  const location = useLocation()
  return (
    <RouteBook location={location} anim={ANIM}>
      {shown => (
        <Routes location={shown}>
          <Route path="/" element={<Page name="home" />} />
          <Route path="/story/:id" element={<Page name="story" />} />
        </Routes>
      )}
    </RouteBook>
  )
}

let waapi
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
async function step(times = 1) {
  for (let i = 0; i < times; i += 1) await act(async () => { waapi.finishAll(); await settle() })
}
const page = () => screen.getByTestId('page').textContent
const swapLayer = () => document.querySelector('body > .book-swap')

/** Clicks the brand and says whether the link's own load (the reload) was stopped. */
async function clickBrand() {
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  await act(async () => { screen.getByText('nav.brand').closest('a').dispatchEvent(click) })
  return click.defaultPrevented
}

beforeEach(() => { waapi = installWaapi() })
afterEach(() => {
  waapi.restore()
  document.querySelectorAll('body > .book-swap').forEach(n => n.remove())
})

describe('Navbar brand and the routes book', () => {
  it('during the first-load opening of the Home: no reload, no navigation; once settled it reloads', async () => {
    renderAt('/')
    const key = shownKey
    expect(await clickBrand()).toBe(true)
    expect(shownKey).toBe(key)
    await step(2) // v1.15.0: the opening, then the tabs fading in
    expect(await clickBrand()).toBe(false)
  })

  it('a second click during the running change to the Home: no reload, no extra navigation', async () => {
    renderAt('/story/s1')
    await step(2) // v1.15.0: the opening, then the tabs fading in
    expect(await clickBrand()).toBe(true)
    expect(screen.getByTestId('url')).toHaveTextContent('/')
    expect(page()).toBe('home')
    const layer = swapLayer()
    expect(layer).not.toBeNull()
    const key = shownKey
    expect(await clickBrand()).toBe(true)
    expect(shownKey).toBe(key)
    expect(swapLayer()).toBe(layer)
    await step(8)
    expect(swapLayer()).toBeNull()
    expect(await clickBrand()).toBe(false)
  })

  it('a second click while the change to the Home waits (the story book holds): nothing, then the change runs', async () => {
    renderAt('/story/s1')
    await step(2) // v1.15.0: the opening, then the tabs fading in
    act(() => { holds.story(true) })
    expect(await clickBrand()).toBe(true)
    expect(screen.getByTestId('url')).toHaveTextContent('/')
    expect(page()).toBe('story')
    const key = shownKey
    expect(await clickBrand()).toBe(true)
    expect(shownKey).toBe(key)
    expect(page()).toBe('story')
    act(() => { holds.story(false) })
    await act(async () => { await settle() })
    expect(page()).toBe('home')
    expect(swapLayer()).not.toBeNull()
    await step(8)
    expect(await clickBrand()).toBe(false)
  })
})
