import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { scrollMobileIntoView } from './mobileView'
import { turnFor } from './bookTurns'

/**
 * useBookView — what the two reading pages are showing, as ONE state.
 *
 * The tabbed views (board / information / backpack / map) are mutually exclusive, so they
 * are a single `view` field instead of four booleans that used to be reset by hand in three
 * places that had drifted apart. Choices and the wake-up list live beside it: they are news
 * the board owes the player and survive a reload on purpose.
 * Step 15 — every change also says how the book turns (`turn`, bookTurns.js); `hold` keeps the old pages up.
 */
const INITIAL = {
  view: 'board',        // 'board' | 'info' | 'items' | 'registry' | 'missions' | 'missionSteps' | 'map' | 'exp'
  previewLeft: null,    // { card, type, ... } | { kind: 'coma' | 'sad' } | null
  previewRight: null,   // { kind, ... } | null
  pendingChoices: null, // { card, choices } | null
  counterZero: null,    // CounterZeroItem[] | null
  mapSelected: null,    // the node clicked on the map | null
  missionSelected: null,// the mission whose steps fill the right page | null
  sleepCardForced: false,
  turn: { key: 0, direction: null }, // step 15: the Book's page key and turn direction
  hold: false,                       // step 15: the old pages stay on screen until released
}

// Back to the board itself: every open page put away. Choices and the wake-up list are
// deliberately left alone — see `resetForReload` for the wider sweep.
function closeAll(state) {
  return { ...state, view: 'board', previewLeft: null, previewRight: null,
    mapSelected: null, missionSelected: null, sleepCardForced: false }
}

function viewReducer(state, action) {
  switch (action.type) {
    case 'closeAll':
      return closeAll(state)
    // A board reload puts the pages away; the news (choices, wake-up list) is written right
    // after by the handler that owns the answer.
    case 'resetForReload':
      return closeAll(state)
    case 'openInfo':
      return { ...closeAll(state), view: 'info', previewLeft: action.preview }
    case 'openItems':
      return { ...closeAll(state), view: 'items' }
    case 'openRegistry':
      return { ...closeAll(state), view: 'registry' }
    case 'openMissions':
      return { ...closeAll(state), view: 'missions' }
    // v0.37.1 — one mission opened from the grid: its card takes the LEFT page and its steps
    // the right one, the way the bag and the registry already split the book.
    case 'openMission':
      return { ...closeAll(state), view: 'missionSteps',
        previewLeft: action.preview, missionSelected: action.mission }
    case 'openMap':
      return { ...closeAll(state), view: 'map' }
    // Step 38 — training: the experience card takes the LEFT page, one card per stat the right.
    case 'openExp':
      return { ...closeAll(state), view: 'exp' }
    case 'clearPreview':
      return { ...state, previewLeft: null, previewRight: null }
    case 'previewLeft':
      return { ...state, previewLeft: action.value }
    case 'previewRight':
      return { ...state,
        previewRight: typeof action.value === 'function'
          ? action.value(state.previewRight) : action.value }
    case 'setChoices':
      return { ...state, previewRight: null, pendingChoices: action.value }
    case 'closeChoices':
      return { ...state, previewRight: null, pendingChoices: null }
    case 'counterZero':
      return { ...state, counterZero: action.value }
    case 'mapSelected':
      return { ...state, mapSelected: action.value }
    case 'forceSleepCard':
      return { ...state, sleepCardForced: true }
    default:
      return state
  }
}

const PAGE_FIELDS = ['view', 'previewLeft', 'previewRight', 'pendingChoices', 'counterZero', 'mapSelected',
  'missionSelected', 'sleepCardForced']
const samePages = (a, b) => PAGE_FIELDS.every(key => a[key] === b[key])

/** The view reducer plus the turn: an action's own `direction` overrides turnFor; no page change, no turn. */
export function bookViewReducer(state, action) {
  const turn = state.turn ?? INITIAL.turn
  if (action.type === 'holdTurn') return state.hold ? state : { ...state, hold: true }
  if (action.type === 'releaseTurn') {
    return state.hold ? { ...state, hold: false, turn: { key: turn.key + 1, direction: action.direction ?? null } } : state
  }
  const next = viewReducer(state, action)
  if (next === state || samePages(state, next)) return next
  const direction = action.direction !== undefined ? action.direction : turnFor(state, action, next)
  if (direction === undefined) return next
  return { ...next, turn: { key: turn.key + 1, direction } }
}

// A direction given by the caller ('forward' | 'back' | 'fade' | null); a click event is not one.
const given = d => (d === null || typeof d === 'string' ? d : undefined)

export default function useBookView() {
  const [state, dispatch] = useReducer(bookViewReducer, INITIAL)

  // Mobile: a right-page preview (the close prompt, an endgame, a right-routed card (i))
  // renders on the lower page of the stacked book, so bring it into view. Weather is excluded:
  // it can fire together with a sleep reload and would fight the scroll-to-top.
  useEffect(() => {
    if (state.previewRight && state.previewRight.kind !== 'weather') {
      scrollMobileIntoView('.book-page-right')
    }
  }, [state.previewRight])

  /**
   * openPreview — the ONE way a card asks for a reading page.
   *
   * `side: 'right'` renders on the right page (phones: the lower page); a left preview on the
   * left page (phones: the top card, v1.14.0 one tree). A null card closes whatever is open.
   */
  const openPreview = useCallback((options = {}) => {
    const { card = null, type = null, lockedReason = null, stats = null,
      props = null, side = 'left' } = options
    if (!card) {
      dispatch({ type: 'clearPreview' })
      return
    }
    const preview = { card, type, lockedReason,
      statItemsToPageContent: stats, additionalProps: props ?? {} }
    if (side === 'right') {
      dispatch({ type: 'previewRight', value: { kind: 'preview', ...preview } })
    } else {
      dispatch({ type: 'previewLeft', value: preview })
      // The left reading page scrolls its own content back to the top; a phone scrolls to it.
      document.querySelector('.book-page-left .page-inner')?.scrollTo?.({ top: 0, behavior: 'smooth' })
      scrollMobileIntoView('.book-page-left')
    }
  }, [])

  const actions = useMemo(() => ({
    openPreview,
    closeAll: direction => dispatch({ type: 'closeAll', direction: given(direction) }),
    resetForReload: () => dispatch({ type: 'resetForReload' }),
    // Step 15 — the hold of an answer: the old pages stay until `releaseTurn` turns ONE page.
    holdTurn: () => dispatch({ type: 'holdTurn' }),
    releaseTurn: direction => dispatch({ type: 'releaseTurn', direction: given(direction) }),
    // The (i) view: the information page on the left, the statistics list on the right.
    // Shared by the info card's lens and by the (i) bookmark — one door, two handles.
    openInfo: card => {
      dispatch({ type: 'openInfo',
        preview: { card, type: 'information', lockedReason: null,
          statItemsToPageContent: [], additionalProps: {} } })
      document.querySelector('.book-page-left .page-inner')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    },
    openMission: ({ mission, card, stats = [] }) => {
      dispatch({ type: 'openMission', mission,
        preview: { card, type: 'missions', lockedReason: null,
          statItemsToPageContent: stats, additionalProps: {} } })
      scrollMobileIntoView('.book-page-right')
    },
    openItems: direction => { dispatch({ type: 'openItems', direction: given(direction) }); scrollMobileIntoView('.book-page-right') },
    openRegistry: () => { dispatch({ type: 'openRegistry' }); scrollMobileIntoView('.book-page-right') },
    openMissions: () => { dispatch({ type: 'openMissions' }); scrollMobileIntoView('.book-page-right') },
    openMap: () => { dispatch({ type: 'openMap' }); scrollMobileIntoView('.book-page-left') },
    openExp: () => { dispatch({ type: 'openExp' }); scrollMobileIntoView('.book-page-right') },
    setPreviewLeft: (value, direction) => dispatch({ type: 'previewLeft', value, direction: given(direction) }),
    setPreviewRight: (value, direction) => dispatch({ type: 'previewRight', value, direction: given(direction) }),
    setChoices: value => dispatch({ type: 'setChoices', value }),
    closeChoices: () => dispatch({ type: 'closeChoices' }),
    setCounterZero: value => dispatch({ type: 'counterZero', value }),
    selectMapNode: value => { dispatch({ type: 'mapSelected', value }); scrollMobileIntoView('.book-page-right') },
    forceSleepCard: () => dispatch({ type: 'forceSleepCard' }),
  }), [openPreview])

  return [state, actions]
}
