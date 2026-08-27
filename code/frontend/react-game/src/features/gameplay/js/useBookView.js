import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { isMobileViewport, scrollMobileIntoView } from './mobileView'

/**
 * useBookView — what the two reading pages are showing, as ONE state.
 *
 * The tabbed views (board / information / backpack / map) are mutually exclusive, so they
 * are a single `view` field instead of four booleans that used to be reset by hand in three
 * places that had drifted apart. Choices and the wake-up list live beside it: they are news
 * the board owes the player and survive a reload on purpose.
 */
const INITIAL = {
  view: 'board',        // 'board' | 'info' | 'items' | 'map'
  previewLeft: null,    // { card, type, ... } | { kind: 'coma' | 'sad' } | null
  previewRight: null,   // { kind, ... } | null
  previewModal: null,   // the mobile (i) modal payload | null
  pendingChoices: null, // { card, choices } | null
  counterZero: null,    // CounterZeroItem[] | null
  mapSelected: null,    // the node clicked on the map | null
  sleepCardForced: false,
}

// Back to the board itself: every open page put away. Choices, the wake-up list and the
// mobile (i) modal are deliberately left alone — see `resetForReload` for the wider sweep.
function closeAll(state) {
  return { ...state, view: 'board', previewLeft: null, previewRight: null,
    mapSelected: null, sleepCardForced: false }
}

export function bookViewReducer(state, action) {
  switch (action.type) {
    case 'closeAll':
      return closeAll(state)
    // A board reload puts the pages away AND drops the mobile modal; the news (choices,
    // wake-up list) is written right after by the handler that owns the answer.
    case 'resetForReload':
      return { ...closeAll(state), previewModal: null }
    case 'openInfo':
      return { ...closeAll(state), view: 'info', previewLeft: action.preview }
    case 'openItems':
      return { ...closeAll(state), view: 'items' }
    case 'openMap':
      return { ...closeAll(state), view: 'map' }
    case 'clearPreview':
      return { ...state, previewLeft: null, previewRight: null, previewModal: null }
    case 'previewLeft':
      return { ...state, previewModal: null, previewLeft: action.value }
    case 'previewRight':
      return { ...state, previewModal: null,
        previewRight: typeof action.value === 'function'
          ? action.value(state.previewRight) : action.value }
    case 'previewModal':
      return { ...state, previewModal: action.value }
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

/** Hide the Bootstrap (i) modal, whatever opened it. */
function hideCardModal() {
  const el = document.getElementById('cardPreviewModal')
  const Modal = window.bootstrap?.Modal
  if (el && Modal) Modal.getOrCreateInstance(el).hide()
}

export default function useBookView() {
  const [state, dispatch] = useReducer(bookViewReducer, INITIAL)

  // Mobile: a right-page preview (the close prompt, an endgame, a right-routed card (i))
  // renders at the bottom of the stacked column, so bring it into view. Weather is excluded:
  // it can fire together with a sleep reload and would fight the scroll-to-top.
  useEffect(() => {
    if (state.previewRight && state.previewRight.kind !== 'weather') {
      scrollMobileIntoView('.book-mobile-right')
    }
  }, [state.previewRight])

  /**
   * openPreview — the ONE way a card asks for a reading page.
   *
   * `side: 'right'` always renders inline (desktop right page / bottom of the mobile stack);
   * a left preview opens the Bootstrap (i) modal on mobile and the left reading page on
   * desktop. A null card closes whatever is open.
   */
  const openPreview = useCallback((options = {}) => {
    const { card = null, type = null, lockedReason = null, stats = null,
      modal = true, props = null, side = 'left' } = options
    if (!card) {
      dispatch({ type: 'clearPreview' })
      return
    }
    const preview = { card, type, lockedReason,
      statItemsToPageContent: stats, additionalProps: props ?? {} }
    if (side === 'right') {
      dispatch({ type: 'previewRight', value: { kind: 'preview', ...preview } })
    } else if (modal && isMobileViewport()) {
      dispatch({ type: 'previewModal', value: preview })
      const el = document.getElementById('cardPreviewModal')
      const Modal = window.bootstrap?.Modal
      if (el && Modal) Modal.getOrCreateInstance(el).show()
    } else {
      dispatch({ type: 'previewLeft', value: preview })
      // The left reading page scrolls its own content back to the top.
      document.querySelector('.book-page-left .page-inner')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const actions = useMemo(() => ({
    openPreview,
    closeAll: () => dispatch({ type: 'closeAll' }),
    resetForReload: () => { hideCardModal(); dispatch({ type: 'resetForReload' }) },
    // The (i) view: the information page on the left, the statistics list on the right.
    // Shared by the info card's lens and by the (i) bookmark — one door, two handles.
    openInfo: card => {
      dispatch({ type: 'openInfo',
        preview: { card, type: 'information', lockedReason: null,
          statItemsToPageContent: [], additionalProps: {} } })
      document.querySelector('.book-page-left .page-inner')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    },
    openItems: () => { dispatch({ type: 'openItems' }); scrollMobileIntoView('.book-mobile-right') },
    openMap: () => { dispatch({ type: 'openMap' }); scrollMobileIntoView('.book-mobile-left') },
    setPreviewLeft: value => dispatch({ type: 'previewLeft', value }),
    setPreviewRight: value => dispatch({ type: 'previewRight', value }),
    setChoices: value => dispatch({ type: 'setChoices', value }),
    closeChoices: () => dispatch({ type: 'closeChoices' }),
    setCounterZero: value => dispatch({ type: 'counterZero', value }),
    selectMapNode: value => { dispatch({ type: 'mapSelected', value }); scrollMobileIntoView('.book-mobile-right') },
    forceSleepCard: () => dispatch({ type: 'forceSleepCard' }),
  }), [openPreview])

  return [state, actions]
}
