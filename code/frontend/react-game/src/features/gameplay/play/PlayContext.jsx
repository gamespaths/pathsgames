import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useAnimationSettings } from '@/context/AnimationContext'
import { canAnimate, cleanClone } from '@/components/book/pageTurn'
import { deckGoal } from '@/components/book/mobileTurn'
import { PLAYED_SHOWN } from '@/components/book/PlayedPile'
import { isMobileViewport } from '@/features/gameplay/js/mobileView'

/* PlayContext — step 15: the played card lifts and glows during the API call, then the other small cards fall
   and a fixed clone flies onto the face-up pile (v1.15.0; phones: the page deck). WAAPI only moves. */

export const FALL_MAX_STAGGER = 8
// v1.15.0 — a pile card is 84px wide (as a deck card) times the pile's scale; it lands on the pile tilted.
export const PILE_CARD_W = 84
const PILE_W = 160

const PlayStateContext = createContext(null)
const PlayApiContext = createContext(null)
const NOOP = () => {}

/** `{ playId, el, phase: 'lift' | 'land', small }` while a card is played, else null (also without a provider). */
export function usePlayState() {
  return useContext(PlayStateContext)
}

/** `{ begin, land, cancel, end, onPlayStart }`, or null outside a game book. */
export function usePlay() {
  return useContext(PlayApiContext)
}

/** `{ x, y, width, rotate, stays }`: v1.15.0 the face-up pile (stays), phones the page deck, else the left page picture. */
export function flightTarget(bookEl) {
  if (isMobileViewport()) return { ...deckGoal(bookEl), rotate: -6, stays: false }
  const pile = bookEl?.parentElement?.querySelector(':scope > .played-pile')?.getBoundingClientRect()
  if (pile?.width) {
    return { x: pile.left + pile.width / 2, y: pile.top + pile.height / 2, width: PILE_CARD_W * (pile.width / PILE_W),
      rotate: -4, stays: true }
  }
  const spot = bookEl?.querySelector('.book-page-left .book-page-img') ?? bookEl?.querySelector('.book-page-left')
  const r = spot?.getBoundingClientRect()
  const centre = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  return { ...centre, width: 0, rotate: -16, stays: false }
}

/** A fixed clone of `source` flying in an arc to `target` (concept flyOut); the clone stays until removed. */
export function flyOut(source, target, timings) {
  const from = source.getBoundingClientRect()
  const end = target.width && from.width ? target.width / from.width : 0.3
  const { node } = cleanClone(source)
  node.classList.remove('is-playing')
  node.classList.add('flying-card')
  Object.assign(node.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`,
    height: `${from.height}px` })
  document.body.appendChild(node)
  const dx = target.x - (from.left + from.width / 2)
  const dy = target.y - (from.top + from.height / 2)
  const anim = node.animate([
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) rotate(-10deg) scale(${target.width ? Math.max(end, 0.7) : 0.9})`,
      opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${target.rotate}deg) scale(${end})`, opacity: target.stays ? 1 : 0 },
  ], { duration: timings.fly, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' })
  return { node, anim }
}

/** What the pile keeps of a played card: its title and picture. */
const cardOf = meta => ({ title: meta.title ?? null, image: meta.image ?? null })

/** The other small cards fall, one after the other (stagger capped at 8), each with a random tilt. */
export function fall(cards, timings) {
  return cards.map((card, i) => {
    const tilt = (Math.random() * 10 - 5).toFixed(1)
    return card.animate([
      { opacity: 0.4, transform: 'translateY(6px) scale(0.94)' },
      { opacity: 0, transform: `translateY(46px) rotate(${tilt}deg) scale(0.88)` },
    ], { duration: timings.discard, delay: Math.min(i, FALL_MAX_STAGGER) * timings.discardStep,
      easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)', fill: 'both' })
  })
}

/** GameBook's controller `{ state, api, played }` (v1.15.0: landed cards, memory only); no WAAPI or `play` off: nothing runs. */
export function usePlayController({ onPlayStart = NOOP } = {}) {
  const settings = useAnimationSettings()
  const live = useRef(settings)
  live.current = settings
  const startRef = useRef(onPlayStart)
  startRef.current = onPlayStart
  const [state, setState] = useState(null)
  const [played, setPlayed] = useState([])
  const current = useRef(null)
  const flight = useRef(null)

  const set = useCallback(next => { current.current = next; setState(next) }, [])
  const stopFlight = useCallback(() => {
    const f = flight.current
    flight.current = null
    f?.anims.forEach(a => a.cancel())
    f?.node?.remove()
  }, [])
  useEffect(() => stopFlight, [stopFlight])

  const onStart = useCallback(() => startRef.current?.(), [])

  // Runs inside the click (user activation, step 16's vibration), then lifts the card; `meta` is `{ title, image }`.
  const begin = useCallback((playId, el, meta = null) => {
    onStart()
    const s = live.current
    if (!playId || !el || !s.play || s.reduced || !canAnimate(el)) return false
    set({ playId, el, phase: 'lift', small: el.classList.contains('pg-card'), meta })
    return true
  }, [onStart, set])

  // A play still lifting is dropped (API error, STALE_MATCH); a landed one waits for `end`.
  const cancel = useCallback(() => {
    if (current.current?.phase === 'lift') set(null)
  }, [set])

  const end = useCallback(() => {
    stopFlight()
    if (current.current) set(null)
  }, [set, stopFlight])

  // Null when nothing is lifting; else resolves once the fall and the flight have ended.
  const land = useCallback(() => {
    const play = current.current
    if (play?.phase !== 'lift') return null
    const { timings } = live.current
    set({ ...play, phase: 'land' })
    stopFlight()
    const book = play.el.closest('.book-wrapper')
    const anims = []
    if (play.small && book) {
      const others = [...book.querySelectorAll('.pg-card')]
        .filter(c => c !== play.el && c.getAttribute('data-deal') !== 'waiting')
      anims.push(...fall(others, timings))
    }
    // The whole card flies, a reading page too (owner's choice, v1.14.0: not only its picture).
    const source = play.el
    let node = null
    if (source?.isConnected) {
      const flown = flyOut(source, flightTarget(book), timings)
      node = flown.node
      anims.push(flown.anim)
    }
    flight.current = { node, anims }
    return Promise.all(anims.map(a => a.finished)).catch(() => {}).then(() => {
      // The pile shows the card before its flying copy goes: no frame without it.
      if (play.meta) flushSync(() => setPlayed(list => [...list, cardOf(play.meta)].slice(-PLAYED_SHOWN)))
      node?.remove()
    })
  }, [set, stopFlight])

  const api = useMemo(() => ({ begin, land, cancel, end, onPlayStart: onStart }),
    [begin, land, cancel, end, onStart])
  return { state, api, played }
}

/** Provides a controller of usePlayController to the cards (state) and their buttons (api). */
export function PlayProvider({ controller, children }) {
  return (
    <PlayApiContext.Provider value={controller.api}>
      <PlayStateContext.Provider value={controller.state}>{children}</PlayStateContext.Provider>
    </PlayApiContext.Provider>
  )
}
