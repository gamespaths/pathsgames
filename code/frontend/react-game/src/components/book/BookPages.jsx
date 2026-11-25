import { Component, createContext, useContext } from 'react'
import BookPageLeft from './BookPageLeft'
import BookPageRight from './BookPageRight'
import { canAnimate, holdPages, pickStrategy } from './pageTurn'
import { isMobileViewport } from '@/features/gameplay/js/mobileView'

/* BookPages — step 15: spine, the two pages and the turn layer React never fills. The old pages are cloned
   before the commit (getSnapshotBeforeUpdate) and turned over the new ones after it (componentDidUpdate).
   Step 16 — phones take the `mobile` strategy (mobileTurn.js): its copy lives on <body> and leaves by `dispose`. */

export const HOLD_SAFETY_MS = 10000

const BookTurningContext = createContext(false)

/** True while a turn or a hold covers the pages: the dealt lists wait (DealtList `hold`). */
export function useBookTurning() {
  return useContext(BookTurningContext)
}

/** What a prop change asks for: 'hold', 'release', a direction, or null (the page's own key wins over the chapter). */
export function turnRequest(prev, next) {
  if (next.holdTurn && !prev.holdTurn) return 'hold'
  if (!next.holdTurn && prev.holdTurn) return 'release'
  if (next.holdTurn) return null
  if (next.pageKey !== prev.pageKey) return next.direction ?? null
  if (next.chapterKind !== prev.chapterKind) return next.chapterKind ? 'forward' : 'back'
  return null
}

function strategyFor(props, direction) {
  return pickStrategy({ direction, turnMode: props.anim?.turnMode, mobile: isMobileViewport() })
}

/** Whether the strategy turns for this request (phones: no Book fade, FadeIn fades the previews). */
function wants(props, request) {
  const strategy = strategyFor(props, request === 'hold' ? 'fade' : request)
  return strategy?.wants ? strategy.wants(request) : true
}

/** The engine runs only with the turn flag on, no reduced motion, WAAPI and a strategy for the layout. */
function engineOn(props) {
  return !!props.anim?.turn && !props.anim?.reduced && canAnimate() && !!strategyFor(props, 'fade')
}

export default class BookPages extends Component {
  constructor(props) {
    super(props)
    this.state = { turning: false, seen: props }
    this.layer = null
    this.held = null
    this.running = null
    this.safety = null
    this.mounted = false
    this.setLayer = el => { this.layer = el }
  }

  static getDerivedStateFromProps(props, state) {
    if (props === state.seen) return null
    const request = turnRequest(state.seen, props)
    const starts = !!request && request !== 'release' && engineOn(props) && wants(props, request)
    return { seen: props, turning: state.turning || starts }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
    if (this.state.turning) this.props.onTurningChange?.(false)
    this.discard(this.held)
    this.clearHold()
    this.finishRunning()
    this.layer?.replaceChildren()
  }

  bookEl() {
    return this.layer?.parentElement ?? null
  }

  getSnapshotBeforeUpdate(prevProps) {
    const request = turnRequest(prevProps, this.props)
    if (!request) return null
    if (request === 'release') return this.held ? { request } : null
    this.finishRunning()
    if (!engineOn(this.props) || !this.layer || !wants(this.props, request)) return null
    const strategy = strategyFor(this.props, request === 'hold' ? 'fade' : request)
    const snapshot = strategy.snapshot(this.bookEl(), request)
    return snapshot ? { request, snapshot, strategy } : null
  }

  componentDidUpdate(prevProps, prevState, shot) {
    // Book makes the whole book busy (inert) while the pages turn or hold, its tabs included.
    if (prevState.turning !== this.state.turning) this.props.onTurningChange?.(this.state.turning)
    if (!shot) {
      this.settle()
      return
    }
    if (shot.request === 'hold') {
      this.startHold(shot.snapshot, shot.strategy)
      return
    }
    if (shot.request === 'release') {
      const snapshot = this.held
      this.clearHold()
      this.runTurn(this.props.direction, snapshot)
      return
    }
    this.runTurn(shot.request, shot.snapshot)
  }

  startHold(snapshot, strategy) {
    ;(strategy.hold ?? holdPages)(this.layer, snapshot)
    this.held = snapshot
    this.safety = setTimeout(() => this.dropHold(), HOLD_SAFETY_MS)
  }

  clearHold() {
    clearTimeout(this.safety)
    this.safety = null
    this.held = null
  }

  /** The 10 s safety: a hold never outlives a reload that does not answer. */
  dropHold() {
    this.discard(this.held)
    this.clearHold()
    this.settle()
  }

  /** A copy that will not turn: off the layer, and off <body> for a phone sheet. */
  discard(snapshot) {
    snapshot?.dispose?.()
    this.layer?.replaceChildren()
  }

  runTurn(direction, snapshot) {
    const strategy = direction ? strategyFor(this.props, direction) : null
    // A copy taken on the other layout (the phone turned past the breakpoint during a hold) cannot turn.
    if (!strategy || !this.layer || !!snapshot?.mobile !== !!strategy.mobile) {
      this.discard(snapshot)
      this.settle()
      return
    }
    const handle = strategy.run({ snapshot, bookEl: this.bookEl(), layer: this.layer, direction,
      timings: this.props.anim.timings, turnMode: this.props.anim.turnMode })
    this.running = handle
    handle.finished.then(() => {
      if (this.running !== handle) return
      this.running = null
      this.settle()
    })
  }

  /** A new change during a running turn finishes it at once. */
  finishRunning() {
    const handle = this.running
    this.running = null
    handle?.finish()
  }

  /** `turning` goes off once nothing covers the pages. */
  settle() {
    if (this.mounted && this.state.turning && !this.held && !this.running) this.setState({ turning: false })
  }

  render() {
    const { left, right, deck = false } = this.props
    return (
      <BookTurningContext.Provider value={this.state.turning}>
        <div className="book-spine" />
        <BookPageLeft>{left}</BookPageLeft>
        <BookPageRight deck={deck}>{right}</BookPageRight>
        <div className="book-turn-layer" ref={this.setLayer} aria-hidden="true" />
      </BookTurningContext.Provider>
    )
  }
}
