import { useLayoutEffect, useRef } from 'react'
import { useAnimationSettings } from '@/context/AnimationContext'
import { DEAL_MAX_STAGGER } from '@/constants/animations'

/* useDeal — step 14: a card is dealt once, the first time its node appears in the list and enters the
   screen; it flies from the deck (`data-deal` waiting → flying → landed on the card, never a class). */

const DEAL_THRESHOLD = 0.2
const LANDING_MARGIN_MS = 200

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

/** Where a batch leaves from: the table pile's top card, else the right page's deck, else the screen corner. */
export function dealOrigin(list) {
  const pile = shownCentre(list.closest('.book-shell')?.querySelector('.deck-pile__top'))
  if (pile) return pile
  const page = shownCentre(list.closest('.book-page-right')?.querySelector(':scope > .deck'))
  if (page) return page
  return { x: window.innerWidth, y: window.innerHeight }
}

const inDomOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)

/** Running animations of the book that holds the list (its opening): the first batch waits for them. */
function openingOf(list) {
  const shell = list.closest('.book-shell')
  if (typeof shell?.getAnimations !== 'function') return []
  return shell.getAnimations().filter(a => a.playState === 'running')
}

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
    let io = null
    let cancelled = false

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
        card.style.setProperty('--deal-i', String(i))
        card.style.setProperty('--from-x', `${Math.round(origin.x - (r.left + r.width / 2))}px`)
        card.style.setProperty('--from-y', `${Math.round(origin.y - (r.top + r.height / 2))}px`)
        card.style.setProperty('--from-rot', `${(Math.random() * 30 - 15).toFixed(1)}deg`)
        card.setAttribute('data-deal-face', dealFaceDown ? 'down' : 'up')
        card.setAttribute('data-deal', 'flying')
        const onEnd = e => { if (e.target === card) land(card) }
        card.addEventListener('animationend', onEnd)
        const timer = setTimeout(() => land(card), timings.deal + timings.dealStep * i + LANDING_MARGIN_MS)
        flying.set(card, () => { clearTimeout(timer); card.removeEventListener('animationend', onEnd) })
      })
    }

    const onIntersect = entries => {
      const batch = entries
        .filter(e => e.isIntersecting && e.target.getAttribute('data-deal') === 'waiting')
        .map(e => e.target)
      if (batch.length === 0) return
      batch.forEach(card => io.unobserve(card))
      batch.sort(inDomOrder)
      const opening = openingOf(list)
      if (opening.length === 0) { fly(batch); return }
      // The book is still opening: measure once it is drawn, so the cards leave the deck where it is.
      Promise.all(opening.map(a => a.finished)).catch(() => {}).then(() => { if (!cancelled) fly(batch) })
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
    // No invisible focused button: a waiting card reached with the keyboard lands at once.
    const onFocus = e => {
      const card = e.target?.closest?.('.pg-card[data-deal="waiting"]')
      if (card && list.contains(card)) land(card)
    }
    list.addEventListener('focusin', onFocus)

    return () => {
      cancelled = true
      io?.disconnect()
      mo?.disconnect()
      list.removeEventListener('focusin', onFocus)
      ;[...flying.keys()].forEach(land)
    }
  }, [listRef, enabled, hold])

  return enabled
}
