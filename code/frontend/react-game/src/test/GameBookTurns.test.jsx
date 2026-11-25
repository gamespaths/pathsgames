import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Step 15 — GameBook with the real Book and turn engine (WAAPI stubbed): which change turns how,
// the hold of an answer, the end game in the same Book, and the close card from a policy chapter.

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('@/features/guest-user/GuestUserContext', () => ({
  useGuestUser: () => ({ user: { accessToken: 'tok' } }),
}))
vi.mock('../api/matches', () => ({
  endMatch: vi.fn(),
  getMatchClock: vi.fn(() => Promise.resolve(null)),
  getMatchWeather: vi.fn(() => Promise.resolve(null)),
  getMatchLocations: vi.fn(() => Promise.resolve({ matchUuid: 'm1', locations: [] })),
  getInventory: vi.fn(() => Promise.resolve({ items: [] })),
}))
vi.mock('../api/stories', () => ({ getStoriesCatalog: vi.fn(() => Promise.resolve([])) }))
const home = vi.hoisted(() => ({ handler: null }))
vi.mock('@/context/HomeButtonContext', () => ({
  useHomeButtonHandler: (fn) => { home.handler = typeof fn === 'function' ? fn : null },
  useHomeButton: () => ({ run: () => false, hasHandler: () => false }),
}))
vi.mock('../features/gameplay/PageLeft', () => ({
  default: ({ view, previewLeft, onBack, onCloseItems, onCloseRegistry, onCloseMissions, onCloseExp }) => (
    <div data-testid="left">left:{view}{previewLeft ? ':preview' : ''}
      <button data-testid="left-back" onClick={onBack}>back</button>
      <button data-testid="close-items" onClick={onCloseItems}>items</button>
      <button data-testid="close-registry" onClick={onCloseRegistry}>registry</button>
      <button data-testid="close-missions" onClick={onCloseMissions}>missions</button>
      <button data-testid="close-exp" onClick={onCloseExp}>exp</button></div>
  ),
}))
vi.mock('../features/gameplay/PageRight', async () => {
  const { usePlay } = await import('../features/gameplay/play/PlayContext')
  // The end-game card as the board shows it: its action plays the card (step 15), then ends the match.
  function PlayedEnd({ onEndGame }) {
    const play = usePlay()
    return (
      <div className="pg-card" data-testid="end-card">
        <button data-testid="end-played" onClick={e => {
          play.begin('end:e1', e.currentTarget.closest('.pg-card'))
          onEndGame({ uuid: 'e1' })
        }}>end</button>
      </div>
    )
  }
  return { default: ({ view, previewRight, onOpenMap, onOpenItems, onPreview, onCloseRight, onMoved, onEndGame }) => (
    <div data-testid="right">right:{view}:{previewRight?.kind ?? '-'}
      <PlayedEnd onEndGame={onEndGame} />
      <button data-testid="open-map" onClick={onOpenMap}>map</button>
      <button data-testid="open-items" onClick={onOpenItems}>bag</button>
      <button data-testid="preview" onClick={() => onPreview({ card: { title: 'c' }, type: 'action', side: 'right' })}>i</button>
      <button data-testid="close-right" onClick={onCloseRight}>x</button>
      <button data-testid="moved" onClick={() => onMoved({})}>move</button>
      <button data-testid="end" onClick={() => onEndGame({ uuid: 'e1' })}>end</button>
    </div>
  ) }
})
vi.mock('../features/gameplay/EndGameBook', async (orig) => {
  const real = await orig()
  return { ...real, default: () => null }
})

import GameBook from '../features/gameplay/GameBook'
import { PolicyBookProvider, usePolicyBook } from '../context/PolicyBookContext'
import { endMatch, getMatchWeather } from '../api/matches'
import { installWaapi } from './fixtures/waapi'
import { PreferencesProvider } from '../preferences/PreferencesContext'

const GAME_DATA = { actualLocationCard: { title: 'Here' }, playerStats: { life: 5 }, locations: [], actions: [],
  endGameCard: { title: 'The End' }, info: { missions: [] } }
const STORY = { uuid: 's1', title: 'Story', card: { title: 'Story' } }

const wrapper = () => document.querySelector('.book-wrapper')
const layer = () => document.querySelector('.book-turn-layer')
const key = () => wrapper().getAttribute('data-page-key')
const direction = () => wrapper().getAttribute('data-direction')

/** The hold is released one task after the answer's news effects. */
const tick = () => act(async () => { await new Promise(res => setTimeout(res, 0)) })
const stage = () => document.querySelector('.book-stage')

let chapter = null
function Probe() { chapter = usePolicyBook(); return null }

function renderBoard(props = {}) {
  const all = { gameData: GAME_DATA, matchUuid: 'm1', story: STORY, onClose: vi.fn(), onReload: vi.fn(() => Promise.resolve()), ...props }
  const utils = render(<PolicyBookProvider><Probe /><GameBook {...all} /></PolicyBookProvider>)
  return { ...utils, rerenderBoard: (more) => utils.rerender(<PolicyBookProvider><Probe /><GameBook {...all} {...more} /></PolicyBookProvider>) }
}

let waapi
beforeEach(() => {
  waapi = installWaapi()
  home.handler = null
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  waapi.restore()
  vi.clearAllMocks()
})

describe('GameBook — the turns of the board (step 15)', () => {
  it('a tab turns forward, back to the board turns back, an (i) fades in and out', async () => {
    renderBoard()
    expect(key()).toBe('0:board')
    fireEvent.click(screen.getByTestId('open-map'))
    expect(key()).toBe('1:board')
    expect(direction()).toBe('forward')
    expect(layer().querySelector('.page-flipper.is-fwd')).not.toBeNull()
    await act(async () => { waapi.finishAll() })
    fireEvent.click(screen.getByTestId('left-back'))
    expect(direction()).toBe('back')
    expect(layer().querySelector('.page-flipper.is-back')).not.toBeNull()
    await act(async () => { waapi.finishAll() })
    fireEvent.click(screen.getByTestId('preview'))
    expect(direction()).toBe('fade')
    expect(layer().querySelector('.page-flipper')).toBeNull()
    expect(layer().children).toHaveLength(2)
    await act(async () => { waapi.finishAll() })
    fireEvent.click(screen.getByTestId('close-right'))
    expect(direction()).toBe('fade')
  })

  it('no Bootstrap preview modal is rendered any more', () => {
    renderBoard()
    expect(document.getElementById('cardPreviewModal')).toBeNull()
    expect(document.querySelector('.modal')).toBeNull()
  })

  it('a transient error page comes and goes with a fade', () => {
    const { rerenderBoard } = renderBoard()
    rerenderBoard({ error: { status: 500, message: 'boom' } })
    expect(key()).toBe('0:error')
    expect(direction()).toBe('fade')
    expect(screen.getByText('boom')).toBeInTheDocument()
    rerenderBoard({ error: null })
    expect(key()).toBe('0:board')
    expect(direction()).toBe('fade')
  })

  it('an answer holds the old pages while the board reloads, then turns ONE page forward', async () => {
    let finishReload
    const onReload = vi.fn(() => new Promise(res => { finishReload = res }))
    renderBoard({ onReload })
    await act(async () => { fireEvent.click(screen.getByTestId('moved')) })
    expect(layer().children).toHaveLength(2) // the held copy of the old spread
    expect(layer().querySelector('.page-flipper')).toBeNull()
    // the whole book is inert while held: the tabs above its edge too (keyboard included)
    expect(stage()).toHaveAttribute('inert')
    expect(stage()).toHaveClass('is-busy')
    expect(stage().querySelector('.book-bookmarks--left')).not.toBeNull()
    await act(async () => { finishReload() })
    await tick()
    expect(direction()).toBe('forward')
    expect(layer().querySelector('.page-flipper.is-fwd')).not.toBeNull()
    expect(stage()).toHaveAttribute('inert')
    await act(async () => { waapi.finishAll() })
    expect(stage()).not.toHaveAttribute('inert')
    expect(stage()).not.toHaveClass('is-busy')
  })

  // Step 15 (6.2) — the weather call answering last still lands inside the ONE turn: no fade cuts the flip.
  it('a weather change of the same answer is part of the one forward turn', async () => {
    getMatchWeather.mockResolvedValueOnce({ uuid: 'w1' })
    let answerWeather
    getMatchWeather.mockImplementationOnce(() => new Promise(res => { answerWeather = res }))
    renderBoard()
    await act(async () => {})
    await act(async () => { fireEvent.click(screen.getByTestId('moved')) })
    await tick()
    expect(layer().querySelector('.page-flipper')).toBeNull() // still held: the weather is on its way
    // the answer, the settled chrome and the release request reach React in ONE batch (as in a browser)
    await act(async () => {
      answerWeather({ uuid: 'w2' })
      for (let i = 0; i < 10; i += 1) await Promise.resolve()
    })
    await tick()
    expect(screen.getByTestId('right')).toHaveTextContent('right:board:weather')
    const flips = waapi.animations.filter(a => a.target.classList.contains('page-flipper'))
    expect(flips).toHaveLength(1)
    expect(flips[0].finish).not.toHaveBeenCalled()
    expect(direction()).toBe('forward')
  })

  it('a refetch releases a hold with no turn', async () => {
    const onReload = vi.fn(() => new Promise(() => {}))
    const { rerenderBoard } = renderBoard({ onReload })
    await act(async () => { fireEvent.click(screen.getByTestId('moved')) })
    expect(layer().children).toHaveLength(2)
    await act(async () => { rerenderBoard({ onReload, reloadKey: 1 }) })
    expect(layer()).toBeEmptyDOMElement()
    expect(direction()).toBeNull()
  })

  it('home tab with a policy chapter open: ONE fade to the close card, no back turn', async () => {
    renderBoard()
    await act(async () => { chapter.openPolicyBook('privacy') })
    expect(key()).toBe('policy:privacy')
    await act(async () => { waapi.finishAll() })
    const before = waapi.animations.length
    await act(async () => { home.handler() })
    expect(chapter.policyBook).toBeNull()
    expect(screen.getByTestId('right')).toHaveTextContent('right:board:close')
    const fresh = waapi.animations.slice(before)
    expect(fresh).toHaveLength(2)
    fresh.forEach(a => expect(a.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]))
    expect(layer().querySelector('.page-flipper')).toBeNull()
  })

  it('the end game is a forward turn of the SAME book, not a second book opening', async () => {
    endMatch.mockResolvedValue({ status: 'ENDED' })
    renderBoard()
    const stage = document.querySelector('.book-stage')
    await act(async () => { fireEvent.click(screen.getByTestId('end')) })
    expect(document.querySelector('.book-stage')).toBe(stage)
    expect(wrapper()).toHaveClass('end-game-wrapper')
    expect(key()).toBe('end:1')
    expect(direction()).toBe('forward')
    expect(screen.getByText('The End')).toBeInTheDocument()
    expect(document.querySelector('.book-bookmarks--left')).toBeNull()
    expect(home.handler).toBeNull()
  })

  it('the played end-game card lands first (fall, flight), then the end pages turn in', async () => {
    endMatch.mockResolvedValue({ status: 'ENDED' })
    renderBoard()
    await act(async () => { fireEvent.click(screen.getByTestId('end-played')) })
    expect(document.querySelector('.book-stage')).toHaveClass('is-busy')
    expect(document.querySelector('.flying-card')).not.toBeNull()
    expect(key()).toBe('0:board')
    await act(async () => { waapi.finishAll() })
    expect(document.querySelector('.flying-card')).toBeNull()
    expect(key()).toBe('end:1')
    expect(direction()).toBe('forward')
    // the play is over, the end pages are turning in: still busy until the sheet lands
    expect(stage()).toHaveClass('is-busy')
    await act(async () => { waapi.finishAll() })
    expect(stage()).not.toHaveClass('is-busy')
    expect(stage()).not.toHaveAttribute('inert')
  })

  it('the back arrows of the bag, registry, missions and training pages turn back to the board', () => {
    renderBoard()
    for (const id of ['close-items', 'close-registry', 'close-missions', 'close-exp']) {
      fireEvent.click(screen.getByTestId('open-map'))
      fireEvent.click(screen.getByTestId(id))
      expect(direction()).toBe('back')
      expect(screen.getByTestId('left')).toHaveTextContent('left:board')
    }
  })

  it('a refused end game stays on the board and says why', async () => {
    endMatch.mockRejectedValue(new Error('end-refused'))
    renderBoard()
    await act(async () => { fireEvent.click(screen.getByTestId('end')) })
    expect(key()).toBe('0:board')
    expect(wrapper()).not.toHaveClass('end-game-wrapper')
  })
})

describe('GameBook — step 16: a played card vibrates the phone', () => {
  afterEach(() => {
    delete navigator.vibrate
    localStorage.clear()
  })

  it('once, inside the tap that plays the card (game board only); not with the vibration choice off', async () => {
    navigator.vibrate = vi.fn(() => true)
    endMatch.mockResolvedValue({ status: 'ENDED' })
    const first = renderBoard()
    await act(async () => { fireEvent.click(screen.getByTestId('end-played')) })
    expect(navigator.vibrate).toHaveBeenCalledOnce()
    expect(navigator.vibrate).toHaveBeenCalledWith(15)
    await act(async () => { waapi.finishAll() })
    first.unmount()
    navigator.vibrate.mockClear()
    localStorage.setItem('pathsgames.preferences', JSON.stringify({ v: 1, vibration: false }))
    render(<PreferencesProvider env={{}}><PolicyBookProvider><GameBook gameData={GAME_DATA} matchUuid="m1"
      story={STORY} onClose={vi.fn()} onReload={vi.fn(() => Promise.resolve())} /></PolicyBookProvider></PreferencesProvider>)
    await act(async () => { fireEvent.click(screen.getByTestId('end-played')) })
    expect(navigator.vibrate).not.toHaveBeenCalled()
    await act(async () => { waapi.finishAll() })
  })
})
