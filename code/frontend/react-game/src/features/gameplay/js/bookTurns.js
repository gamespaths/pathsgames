/* bookTurns — step 15: the page turn each useBookView action asks for. A direction ('forward' | 'back' |
   'fade'), null for a change with no turn, undefined when the pages do not change at all. */

// The bookmarks' order, left to right: a tab to the right turns forward, one to the left back.
export const TAB_ORDER = Object.freeze(['board', 'info', 'items', 'map', 'missions'])

function tabTurn(from, to) {
  if (from === to) return undefined
  if (from === 'missionSteps' && to === 'missions') return 'back'
  const a = TAB_ORDER.indexOf(from)
  const b = TAB_ORDER.indexOf(to)
  if (a < 0 || b < 0) return 'forward'
  return b > a ? 'forward' : 'back'
}

const EDGE_KINDS = ['coma', 'sad']

/** Back to the board: a turn from any other view, a fade when only previews close, nothing when all is shut. */
function closeAllTurn(state) {
  if (state.view !== 'board') return 'back'
  return state.previewLeft || state.previewRight || state.mapSelected || state.sleepCardForced ? 'fade' : undefined
}

/** The match history turns forward and back; every other right-page change (news, (i), close card) fades. */
function previewRightTurn(state, next) {
  const before = state.previewRight ?? null
  const after = next?.previewRight ?? null
  if (after === before) return undefined
  if (after?.kind === 'matchlog' && before?.kind !== 'matchlog') return 'forward'
  if (!after && before?.kind === 'matchlog') return 'back'
  return 'fade'
}

/** The turn of `action` from `state`; `next` (the reducer's result) is read by the right-page updater. */
export function turnFor(state, action, next = null) {
  switch (action?.type) {
    case 'openInfo': return tabTurn(state.view, 'info') ?? 'fade'
    case 'openItems': return tabTurn(state.view, 'items')
    case 'openMap': return tabTurn(state.view, 'map')
    case 'openMissions': return tabTurn(state.view, 'missions')
    case 'openRegistry':
    case 'openExp':
    case 'openMission':
    case 'setChoices':
      return 'forward'
    case 'closeAll': return closeAllTurn(state)
    case 'closeChoices': return 'back'
    case 'resetForReload': return null
    case 'clearPreview':
    case 'mapSelected':
    case 'forceSleepCard':
    case 'counterZero':
      return 'fade'
    case 'previewLeft':
      return !action.value && EDGE_KINDS.includes(state.previewLeft?.kind) ? 'back' : 'fade'
    case 'previewRight': return previewRightTurn(state, next)
    default: return undefined
  }
}
