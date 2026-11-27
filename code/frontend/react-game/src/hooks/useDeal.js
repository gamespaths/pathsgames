import { useLayoutEffect, useRef } from 'react'
import { useAnimationSettings } from '@/context/AnimationContext'
import { DEAL_MAX_STAGGER } from '@/constants/animations'
import { cleanClone, px } from '@/components/book/pageTurn'

/* useDeal — step 14: a card is dealt once, the first time its node appears in the list and enters the
   screen; it flies from the deck (`data-deal` waiting → flying → landed on the card, never a class). */

const DEAL_THRESHOLD = 0.2
const LANDING_MARGIN_MS = 200
// Inherited text styles a copy on <body> would lose (the page's font, colour and alignment).
const INHERITED = ['color', 'font-family', 'font-size', 'font-style', 'font-weight', 'line-height', 'letter-spacing',
  'text-align']

/** The dealt element of a list slot: the slot when it is a card, else its first card, else null. */
export function slotCard(slot) {
  if (slot?.nodeType !== 1) return null
  return slot.classList.contains('pg-card') ? slot : slot.querySelector('.pg-card')
}

function shownCentre(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!(r.width > 0 || r.height > 0)) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Where a batch leaves from: the table pile's top card (`table`), else the right page's deck, else the screen corner. */
export function dealOrigin(list) {
  const pile = shownCentre(list.closest('.book-shell')?.querySelector('.deck-pile__top'))
  if (pile) return { ...pile, table: true }
  const page = shownCentre(list.closest('.book-page-right')?.querySelector(':scope > .deck'))
  if (page) return page
  return { x: window.innerWidth, y: window.innerHeight }
}

/** v1.15.0 — the copy (fixed) on its slot's `box`: its keyframes are relative, so the flight ends on the slot. */
function placeCopy(node, box) {
  Object.assign(node.style, px(box))
  node.style.setProperty('--card-w', `${box.width}px`)
}

/** v1.15.0 — the card's copy on a fixed layer on <body> over its slot `box` (clean, inert): the flight from the table. */
export function dealCopy(card, box) {
  const { node } = cleanClone(card)
  node.classList.add('deal-copy')
  const style = getComputedStyle(card)
  INHERITED.forEach(name => {
    const value = style.getPropertyValue(name)
    if (value) node.style.setProperty(name, value)
  })
  placeCopy(node, box)
  document.body.appendChild(node)
  return node
}

const inDomOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)

/** Deals the list's cards (off, reduced or no IntersectionObserver: all landed); `hold` keeps them waiting. */
export default function useDeal(listRef, { hold = false } = {}) {
  const settings = useAnimationSettings()
  const enabled = !!settings.deal && !settings.reduced && typeof IntersectionObserver === 'function'
  const live = useRef(settings)
  live.current = settings

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const flying = new Map()
    // v1.15.0 — the copies in flight follow their slots while the page scrolls (a frame loop and window scrolls).
    const copies = new Map()
    let frame = 0
    const follow = () => copies.forEach((copy, card) => placeCopy(copy, card.getBoundingClientRect()))
    const tick = () => {
      follow()
      frame = requestAnimationFrame(tick)
    }
    const track = (card, copy) => {
      copies.set(card, copy)
      if (frame) return
      frame = requestAnimationFrame(tick)
      window.addEventListener('scroll', follow, { capture: true, passive: true })
    }
    const untrack = card => {
      copies.delete(card)
      if (copies.size > 0) return
      cancelAnimationFrame(frame)
      frame = 0
      window.removeEventListener('scroll', follow, { capture: true })
    }
    let io = null

    const land = card => {
      flying.get(card)?.()
      flying.delete(card)
      io?.unobserve(card)
      card.setAttribute('data-deal', 'landed')
    }

    const fly = batch => {
      const { dealFaceDown, timings } = live.current
      const origin = dealOrigin(list)
      batch.filter(card => card.getAttribute('data-deal') === 'waiting').forEach((card, n) => {
        const i = Math.min(n, DEAL_MAX_STAGGER - 1)
        const r = card.getBoundingClientRect()
        // From the table the copy flies (the real card waits hidden in its slot); from the page deck the card itself.
        const mover = origin.table ? dealCopy(card, r) : card
        mover.style.setProperty('--deal-i', String(i))
        mover.style.setProperty('--from-x', `${Math.round(origin.x - (r.left + r.width / 2))}px`)
        mover.style.setProperty('--from-y', `${Math.round(origin.y - (r.top + r.height / 2))}px`)
        mover.style.setProperty('--from-rot', `${(Math.random() * 30 - 15).toFixed(1)}deg`)
        mover.setAttribute('data-deal-face', dealFaceDown ? 'down' : 'up')
        mover.setAttribute('data-deal', 'flying')
        if (mover !== card) {
          card.setAttribute('data-deal-copy', 'on')
          card.setAttribute('data-deal', 'flying')
          track(card, mover)
        }
        const onEnd = e => { if (e.target === mover) land(card) }
        mover.addEventListener('animationend', onEnd)
        const timer = setTimeout(() => land(card), timings.deal + timings.dealStep * i + LANDING_MARGIN_MS)
        flying.set(card, () => {
          clearTimeout(timer)
          mover.removeEventListener('animationend', onEnd)
          if (mover === card) return
          untrack(card)
          mover.remove()
          card.removeAttribute('data-deal-copy')
        })
      })
    }

    const onIntersect = entries => {
      const batch = entries
        .filter(e => e.isIntersecting && e.target.getAttribute('data-deal') === 'waiting')
        .map(e => e.target)
      if (batch.length === 0) return
      batch.forEach(card => io.unobserve(card))
      batch.sort(inDomOrder)
      fly(batch)
    }

    const adopt = card => {
      const state = card.getAttribute('data-deal')
      if (state === 'landed' || state === 'flying') return
      if (!enabled) { card.setAttribute('data-deal', 'landed'); return }
      card.setAttribute('data-deal', 'waiting')
      if (!hold) io.observe(card)
    }
    const scan = () => { for (const slot of list.children) { const card = slotCard(slot); if (card) adopt(card) } }

    if (enabled) io = new IntersectionObserver(onIntersect, { threshold: DEAL_THRESHOLD })
    scan()
    const mo = typeof MutationObserver === 'function'
      ? new MutationObserver(records => { if (records.some(r => r.addedNodes.length > 0)) scan() })
      : null
    mo?.observe(list, { childList: true, subtree: true })
    // No invisible focused button: a waiting (or copy-flying) card reached with the keyboard lands at once.
    const onFocus = e => {
      const card = e.target?.closest?.('.pg-card[data-deal="waiting"], .pg-card[data-deal-copy]')
      if (card && list.contains(card)) land(card)
    }
    list.addEventListener('focusin', onFocus)

    return () => {
      io?.disconnect()
      mo?.disconnect()
      list.removeEventListener('focusin', onFocus)
      ;[...flying.keys()].forEach(land)
    }
  }, [listRef, enabled, hold])

  return enabled
}
