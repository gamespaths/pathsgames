import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'

// Unit cover for the pieces GameBook was split into: the view reducer, the bookmark builder,
// the bag summary and the two page renderers. The board's own suites drive them end to end;
// these hit the branches an end-to-end click cannot reach cheaply.

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import useBookView, { bookViewReducer } from '../features/gameplay/js/useBookView'
import { buildBookmarksLeft, BOOKMARKS_RIGHT } from '../features/gameplay/js/bookmarks'
import { bagSummaryProps } from '../features/gameplay/js/boardProps'
import PageLeft from '../features/gameplay/PageLeft'
import PageRight from '../features/gameplay/PageRight'

const BASE = {
  view: 'board', previewLeft: null, previewRight: null, previewModal: null,
  pendingChoices: null, counterZero: null, mapSelected: null, sleepCardForced: false,
}

describe('bookViewReducer', () => {
  it('closes every open page but keeps the news and the mobile modal', () => {
    const open = { ...BASE, view: 'map', previewLeft: { card: {} }, previewRight: { kind: 'weather' },
      mapSelected: { id: 2 }, sleepCardForced: true, previewModal: { card: {} },
      pendingChoices: { choices: [] }, counterZero: [{ idLocation: 1 }] }
    const next = bookViewReducer(open, { type: 'closeAll' })
    expect(next).toMatchObject({ view: 'board', previewLeft: null, previewRight: null,
      mapSelected: null, sleepCardForced: false })
    expect(next.previewModal).toEqual({ card: {} })
    expect(next.pendingChoices).toEqual({ choices: [] })
    expect(next.counterZero).toHaveLength(1)
  })

  it('drops the mobile modal too when the board reloads', () => {
    const next = bookViewReducer({ ...BASE, previewModal: { card: {} } }, { type: 'resetForReload' })
    expect(next.previewModal).toBeNull()
  })

  it('makes the tabbed views exclusive', () => {
    const preview = { card: { title: 'i' }, type: 'information' }
    const info = bookViewReducer({ ...BASE, view: 'items' }, { type: 'openInfo', preview })
    expect(info).toMatchObject({ view: 'info', previewLeft: preview })
    expect(bookViewReducer(info, { type: 'openItems' })).toMatchObject({ view: 'items', previewLeft: null })
    expect(bookViewReducer(info, { type: 'openMap' })).toMatchObject({ view: 'map', previewLeft: null })
  })

  it('accepts an updater for the right page, so the weather can decorate what is there', () => {
    const state = { ...BASE, previewRight: { kind: 'preview', card: { title: 'effect' } } }
    const next = bookViewReducer(state, { type: 'previewRight',
      value: prev => ({ ...prev, decorated: prev.card.title }) })
    expect(next.previewRight.decorated).toBe('effect')
  })

  it('covers the remaining transitions and ignores an unknown action', () => {
    expect(bookViewReducer(BASE, { type: 'previewModal', value: { card: {} } }).previewModal).toEqual({ card: {} })
    expect(bookViewReducer(BASE, { type: 'previewLeft', value: { card: {} } }).previewLeft).toEqual({ card: {} })
    expect(bookViewReducer({ ...BASE, previewRight: { kind: 'weather' } },
      { type: 'setChoices', value: { choices: [1] } })).toMatchObject({ previewRight: null })
    expect(bookViewReducer({ ...BASE, pendingChoices: { choices: [] } },
      { type: 'closeChoices' }).pendingChoices).toBeNull()
    expect(bookViewReducer(BASE, { type: 'counterZero', value: [1] }).counterZero).toEqual([1])
    expect(bookViewReducer(BASE, { type: 'mapSelected', value: { id: 3 } }).mapSelected).toEqual({ id: 3 })
    expect(bookViewReducer(BASE, { type: 'forceSleepCard' }).sleepCardForced).toBe(true)
    expect(bookViewReducer(BASE, { type: 'nope' })).toBe(BASE)
  })
})

describe('useBookView — openPreview', () => {
  afterEach(() => { delete window.matchMedia; delete window.bootstrap })

  it('routes a right preview inline, whatever the viewport', () => {
    const { result } = renderHook(() => useBookView())
    act(() => result.current[1].openPreview({ card: { title: 'c' }, type: 'item', side: 'right' }))
    expect(result.current[0].previewRight).toMatchObject({ kind: 'preview', type: 'item' })
    expect(result.current[0].previewModal).toBeNull()
  })

  it('opens the Bootstrap (i) modal for a left preview on mobile', () => {
    const show = vi.fn()
    window.matchMedia = vi.fn(() => ({ matches: true }))
    window.bootstrap = { Modal: { getOrCreateInstance: () => ({ show, hide: vi.fn() }) } }
    const el = document.createElement('div')
    el.id = 'cardPreviewModal'
    document.body.appendChild(el)
    const { result } = renderHook(() => useBookView())
    act(() => result.current[1].openPreview({ card: { title: 'c' }, type: 'trait' }))
    expect(result.current[0].previewModal).toMatchObject({ type: 'trait' })
    expect(show).toHaveBeenCalled()
    document.body.removeChild(el)
  })

  it('falls back to the left reading page when the (i) modal is opted out', () => {
    const { result } = renderHook(() => useBookView())
    act(() => result.current[1].openPreview({ card: { title: 'c' }, type: 'trait', modal: false }))
    expect(result.current[0].previewLeft).toMatchObject({ type: 'trait' })
  })

  it('closes every preview when asked for a null card', () => {
    const { result } = renderHook(() => useBookView())
    act(() => result.current[1].openPreview({ card: { title: 'c' }, side: 'right' }))
    act(() => result.current[1].openPreview({ card: null }))
    expect(result.current[0].previewRight).toBeNull()
  })

  it('hides the (i) modal instance when the board reloads', () => {
    const hide = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: () => ({ show: vi.fn(), hide }) } }
    const el = document.createElement('div')
    el.id = 'cardPreviewModal'
    document.body.appendChild(el)
    const { result } = renderHook(() => useBookView())
    act(() => result.current[1].resetForReload())
    expect(hide).toHaveBeenCalled()
    document.body.removeChild(el)
  })
})

describe('bookmarks', () => {
  const t = k => k
  it('marks the board tab active only while the board is what is showing', () => {
    const board = buildBookmarksLeft({ t, view: 'board', previewLeft: null, playerStats: {} })
    expect(board[0].active).toBe(true)
    const previewing = buildBookmarksLeft({ t, view: 'board', previewLeft: { type: 'trait' }, playerStats: {} })
    expect(previewing[0].active).toBe(false)
  })

  it('lights the tab of the open page and reddens a critical one', () => {
    const items = buildBookmarksLeft({ t, view: 'items', previewLeft: null,
      playerStats: { weight: 12, weightMax: 10, life: 0 } })
    expect(items.find(b => b.key === 'items')).toMatchObject({ active: true, danger: true })
    expect(items.find(b => b.key === 'information').danger).toBe(true)
    expect(buildBookmarksLeft({ t, view: 'map', previewLeft: null, playerStats: {} })
      .find(b => b.key === 'map').active).toBe(true)
    expect(buildBookmarksLeft({ t, view: 'board', previewLeft: { type: 'information' }, playerStats: {} })
      .find(b => b.key === 'information').active).toBe(true)
    expect(BOOKMARKS_RIGHT).toEqual([])
  })
})

describe('bagSummaryProps', () => {
  it('reads the bag once, for every render point', () => {
    expect(bagSummaryProps({ items: [1, 2], weight: 4, weightMax: 9, food: 1, magic: 2, coins: 3 }))
      .toEqual({ count: 2, weight: 4, weightMax: 9, food: 1, magic: 2, coins: 3 })
    expect(bagSummaryProps(undefined).count).toBe(0)
  })
})

describe('PageLeft', () => {
  it('titles a choice-event page even when the option carries no card', () => {
    render(<PageLeft view="board" pendingChoices={{ card: null, choices: [] }}
      t={k => k} story={{}} onCloseChoices={vi.fn()} />)
    expect(screen.getByText('game.choices.title')).toBeInTheDocument()
  })

  it('renders the sadness page from the left preview', () => {
    render(<PageLeft view="board" previewLeft={{ kind: 'sad' }} t={k => k} story={{}}
      playerStats={{ constitution: 2 }} onCloseLeft={vi.fn()} />)
    expect(screen.getByText('game.sad.title')).toBeInTheDocument()
  })

  it('renders nothing when there is no location and no story card', () => {
    const { container } = render(<PageLeft view="board" t={k => k} story={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PageRight', () => {
  const base = { view: 'board', story: {}, t: k => k, playerStats: { constitution: 4 } }

  it('renders the coma page on the right', () => {
    render(<PageRight {...base} previewRight={{ kind: 'coma', allPlayers: true, card: null }} />)
    expect(screen.getByText('game.allComa.title')).toBeInTheDocument()
  })

  it('renders the sadness page on the right', () => {
    render(<PageRight {...base} previewRight={{ kind: 'sad' }} />)
    expect(screen.getByText('game.sad.title')).toBeInTheDocument()
  })

  it('renders the end-game reading page', () => {
    render(<PageRight {...base} previewRight={{ kind: 'endgame' }}
      activeAction={{ uuid: 'a1', card: { title: 'The End' } }}
      onEndGame={vi.fn()} onEndGamePreview={vi.fn()} />)
    expect(screen.getByText('The End')).toBeInTheDocument()
  })

  it('renders nothing for a preview kind it does not know', () => {
    const { container } = render(<PageRight {...base} previewRight={{ kind: 'zzz' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
