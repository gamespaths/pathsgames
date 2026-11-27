import { Component, createContext, useContext } from 'react'
import { canAnimate } from './pageTurn'
import {
  TABLESS, coverText, routeTransition, runOpening, runRouteTurn, runSwap, swapSnapshot, swapTimings, turnSnapshot,
} from './bookSwap'
import { isMobileViewport } from '@/features/gameplay/js/mobileView'

/* RouteBook — step 15: the routes' book. A change of book closes this one and opens the next, a page of the same book
   turns; the shown route waits while the book is busy (its own change or turn, the Book's play, hold or turn). */

// Longest wait of a pending route for the book (a play that never answers): then it is shown anyway.
export const NAV_WAIT_MAX_MS = 15000

const RouteBookContext = createContext(null)
// The mounted routes' book: the navbar, outside it, asks what it shows.
let mountedBook = null

/** `{ busy, pathname, report(token, busy) }` of the routes' book, or null outside it (isolated renders). */
export function useRouteBook() {
  return useContext(RouteBookContext)
}

const IDENTITY = key => key

/** The same page (pathname): a new state or query of the shown page, applied at once (a pending route is dropped). */
export function samePath(a, b) {
  return !!a && !!b && a.pathname === b.pathname
}

/** What a route change runs now: 'swap', 'forward', 'back' or null (flag off, reduced motion, no WAAPI). */
export function routePlan(anim, kind) {
  if (!kind || !anim || anim.reduced || !canAnimate()) return null
  if (kind === 'swap') return anim.cover ? 'swap' : null
  return anim.turn ? kind : null
}

function opens(anim) {
  return !!anim?.cover && !anim?.reduced && canAnimate()
}

/** No change or turn of its own running and no Book busy: a route can be shown. */
function free(state) {
  return !state.busy && !state.bookBusy
}

/** `{ pathname, settled }` of the routes' book: its shown page, and nothing running or waiting; null without one. */
export function routeBookStatus() {
  if (!mountedBook) return null
  const { shown, pending } = mountedBook.state
  return { pathname: shown.pathname, settled: free(mountedBook.state) && !pending }
}

/** The state that shows `next`: its plan, and busy from the first render of the new page (inert, deal held). */
function adopt(props, state, next) {
  const plan = routePlan(props.anim, routeTransition(state.shown, next))
  return { shown: next, pending: null, plan, busy: !!plan || (state.opening && opens(props.anim)) }
}

export default class RouteBook extends Component {
  constructor(props) {
    super(props)
    // `opening`: the first-load opening still waits for the first book (a redirect page has none).
    this.state = { seen: props.location, shown: props.location, pending: null, plan: null,
      busy: opens(props.anim), opening: true, bookBusy: false }
    this.root = null
    this.running = null
    this.tick = null
    this.wait = null
    this.mounted = false
    this.ctx = null
    this.reporters = new Set()
    this.setRoot = el => { this.root = el }
    this.report = (token, busy) => {
      if (!!busy === this.reporters.has(token)) return
      if (busy) this.reporters.add(token)
      else this.reporters.delete(token)
      this.syncBookBusy()
    }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.location === state.seen) return null
    const next = props.location
    if (samePath(next, state.shown)) return { seen: next, shown: next, pending: null }
    if (!free(state)) return { seen: next, pending: next }
    return { seen: next, ...adopt(props, state, next) }
  }

  componentDidMount() {
    this.mounted = true
    mountedBook = this
    this.syncBookBusy()
    this.firstBook()
  }

  componentWillUnmount() {
    this.mounted = false
    if (mountedBook === this) mountedBook = null
    clearTimeout(this.tick)
    clearTimeout(this.wait)
    this.tick = null
    this.wait = null
    const handle = this.running
    this.running = null
    handle?.finish()
  }

  getSnapshotBeforeUpdate(prevProps, prevState) {
    if (samePath(prevState.shown, this.state.shown) || !this.state.plan) return null
    const old = this.liveBook()
    return old ? this.snapshot(old, prevState.shown) : null
  }

  componentDidUpdate(prevProps, prevState, shot) {
    if (!samePath(prevState.shown, this.state.shown)) this.afterRoute(shot)
    this.watchWait()
    if (this.state.pending && free(this.state)) this.schedule()
  }

  t() {
    return this.props.t ?? IDENTITY
  }

  /** The live book of the shown page (its `.book-wrapper`), or null. */
  liveBook() {
    return this.root?.querySelector('.book-wrapper') ?? null
  }

  syncBookBusy() {
    const bookBusy = this.reporters.size > 0
    if (this.mounted) this.setState(state => (state.bookBusy === bookBusy ? null : { bookBusy }))
  }

  /** Before the commit: the old book copied for a change, or its pages for a turn. */
  snapshot(old, from) {
    const { plan } = this.state
    const phone = isMobileViewport()
    if (plan === 'swap') {
      const text = coverText({ pathname: from.pathname, attr: old.getAttribute('data-cover-title'), state: from.state,
        t: this.t() })
      return { plan, phone, shot: swapSnapshot(old, { phone, text }) }
    }
    const shot = turnSnapshot(old, { direction: plan, turnMode: this.props.anim.turnMode, phone })
    return shot ? { plan, phone, shot } : null
  }

  afterRoute(snap) {
    if (snap) {
      this.setState({ opening: false })
      this.track(snap.plan === 'swap' ? this.swap(snap) : this.turn(snap))
      return
    }
    if (this.state.opening) this.firstBook()
    else if (this.state.busy) this.setState({ busy: false })
  }

  swap({ shot, phone }) {
    const { anim } = this.props
    const shown = this.state.shown
    const timings = swapTimings(anim.timings, { layout: phone ? 'phone' : 'desktop', mode: anim.turnMode,
      maxMs: (anim.coverMax ?? 0) * 1000 })
    return runSwap(shot, {
      timings,
      mode: anim.turnMode,
      liveBook: () => this.liveBook(),
      nextText: live => coverText({ pathname: shown.pathname, attr: live?.getAttribute('data-cover-title'),
        state: shown.state, t: this.t() }),
      hide: () => this.root?.classList.add('is-swapping'),
      reveal: () => this.root?.classList.remove('is-swapping'),
      ...this.tabs(),
    })
  }

  /** v1.15.0 — the live book's tabs hidden while it closes or opens, shown again when it is open and still. */
  tabs() {
    return {
      hideTabs: () => this.root?.classList.add(TABLESS),
      showTabs: () => this.root?.classList.remove(TABLESS),
    }
  }

  turn({ shot }) {
    const { anim } = this.props
    return runRouteTurn(shot, { liveBook: () => this.liveBook(), timings: anim.timings, turnMode: anim.turnMode })
  }

  /** The first book shown (first load, or after a redirect): it opens when `cover` is on, scaled by the speed; tabs after. */
  firstBook() {
    const book = this.liveBook()
    if (book) this.setState({ opening: false })
    if (book && opens(this.props.anim)) {
      this.track(runOpening({ timings: this.props.anim.timings, liveBook: () => this.liveBook(), ...this.tabs() }))
    } else if (this.state.busy) this.setState({ busy: false })
  }

  /** The book is busy until the handle ends; a pending route is applied on the next tick. */
  track(handle) {
    this.running = handle
    handle.finished.then(() => {
      if (this.running !== handle) return
      this.running = null
      this.setState({ busy: false })
    })
  }

  schedule() {
    clearTimeout(this.tick)
    this.tick = setTimeout(() => {
      this.tick = null
      this.setState((state, props) => (state.pending && free(state) ? adopt(props, state, state.pending) : null))
    }, 0)
  }

  /** The wait limit runs from the first pending route (a later one does not extend it) until none is left. */
  watchWait() {
    if (this.state.pending && !this.wait) this.wait = setTimeout(() => this.force(), NAV_WAIT_MAX_MS)
    else if (!this.state.pending && this.wait) {
      clearTimeout(this.wait)
      this.wait = null
    }
  }

  /** The wait limit passed: its own run ends and the Book's reports go (as an unmount), the latest route is shown. */
  force() {
    this.wait = null
    const handle = this.running
    this.running = null
    handle?.finish()
    this.reporters.clear()
    this.setState((state, props) => (state.pending
      ? { ...adopt(props, { ...state, busy: false }, state.pending), bookBusy: false }
      : null))
  }

  render() {
    const { busy, shown } = this.state
    if (!this.ctx || this.ctx.busy !== busy || this.ctx.pathname !== shown.pathname) {
      this.ctx = { busy, pathname: shown.pathname, report: this.report }
    }
    return (
      <RouteBookContext.Provider value={this.ctx}>
        <div className="route-book" ref={this.setRoot}>{this.props.children(shown)}</div>
      </RouteBookContext.Provider>
    )
  }
}
