import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

/**
 * TooltipLayer — v1.13.0: one drawn tooltip for every `[data-tip]` target, mounted once in App: mouse hover,
 * keyboard focus, or a long press on touch (whose click is swallowed). The label stays the target's aria-label.
 */
export const LONG_PRESS_MS = 500
export const TOUCH_HIDE_MS = 1500
export const MOVE_TOLERANCE_PX = 10
export const EDGE_MARGIN_PX = 8
const GAP_PX = 8

/** The `[data-tip]` element an event started on, or null. */
export function tipTarget(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement
  const target = el?.closest?.('[data-tip]') ?? null
  return target && target.getAttribute('data-tip') ? target : null
}

/** True when the device can hover; guarded when matchMedia is missing (jsdom). */
function canHover() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover)').matches
}

function focusVisible(el) {
  try {
    return el.matches(':focus-visible')
  } catch {
    return false
  }
}

/** The navbar height written by the Navbar on <html> (0 when unknown). */
function navbarHeight() {
  const raw = document.documentElement.style.getPropertyValue('--navbar-h')
    || getComputedStyle(document.documentElement).getPropertyValue('--navbar-h')
  const value = parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

/** Above the target, below when there is no room or the navbar is in the way; centred, clamped, arrow on the target. */
export function placeTooltip(target, tip, viewport, navH = 0) {
  const width = tip.width
  let placement = 'above'
  let top = target.top - tip.height - GAP_PX
  if (top < EDGE_MARGIN_PX || (target.top >= navH && top < navH)) {
    placement = 'below'
    top = target.bottom + GAP_PX
  }
  const centre = target.left + target.width / 2
  const maxLeft = Math.max(EDGE_MARGIN_PX, viewport.width - width - EDGE_MARGIN_PX)
  const left = Math.min(Math.max(centre - width / 2, EDGE_MARGIN_PX), maxLeft)
  const arrow = Math.min(Math.max(centre - left, 10), Math.max(10, width - 10))
  return { placement, top, left, arrow }
}

export default function TooltipLayer() {
  const { pathname } = useLocation()
  const [tip, setTip] = useState(null) // { target, text, touch }
  const tipRef = useRef(null)
  const state = useRef({ tip: null, press: null, hideTimer: null, swallowClick: false, lastInput: null, lastPointer: null })

  // Effects and listeners read the shown tip through the ref: one set of listeners for the app.
  state.current.tip = tip

  useEffect(() => {
    const s = state.current
    const clearHideTimer = () => { if (s.hideTimer) { clearTimeout(s.hideTimer); s.hideTimer = null } }
    const cancelPress = () => { if (s.press) { clearTimeout(s.press.timer); s.press = null } }
    const hide = () => { clearHideTimer(); setTip(null) }
    const show = (target, touch = false) => {
      clearHideTimer()
      setTip({ target, text: target.getAttribute('data-tip'), touch })
    }

    const onPointerOver = e => {
      if (e.pointerType === 'touch' || !canHover()) return
      const target = tipTarget(e.target)
      if (target && target !== s.tip?.target) show(target)
    }
    const onPointerOut = e => {
      const current = s.tip?.target
      if (!current || s.tip.touch || e.pointerType === 'touch') return
      if (!current.contains(e.relatedTarget)) hide()
    }
    const onPointerDown = e => {
      s.lastInput = 'pointer'
      s.lastPointer = e.pointerType
      s.swallowClick = false
      cancelPress()
      hide()
      const target = e.pointerType === 'touch' ? tipTarget(e.target) : null
      if (!target) return
      s.press = {
        x: e.clientX, y: e.clientY,
        timer: setTimeout(() => {
          s.press = null
          s.swallowClick = true
          show(target, true)
        }, LONG_PRESS_MS),
      }
    }
    const onPointerMove = e => {
      if (!s.press) return
      if (Math.hypot(e.clientX - s.press.x, e.clientY - s.press.y) > MOVE_TOLERANCE_PX) cancelPress()
    }
    const onPointerUp = () => {
      if (s.press) { cancelPress(); return }
      if (s.tip?.touch) {
        clearHideTimer()
        s.hideTimer = setTimeout(() => { s.hideTimer = null; setTip(null) }, TOUCH_HIDE_MS)
      }
    }
    const onPointerCancel = () => {
      cancelPress()
      if (s.tip?.touch) hide()
    }
    // Capture phase on document: runs before React's root listeners, so the tab never opens.
    const onClick = e => {
      if (!s.swallowClick) return
      s.swallowClick = false
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const onContextMenu = e => {
      if ((s.press || s.tip?.touch || s.lastPointer === 'touch') && tipTarget(e.target)) e.preventDefault()
    }
    const onFocusIn = e => {
      const target = tipTarget(e.target)
      if (target && target === e.target && (s.lastInput === 'keyboard' || focusVisible(target))) show(target)
    }
    const onFocusOut = e => { if (s.tip && s.tip.target === e.target && !s.tip.touch) hide() }
    const onKeyDown = e => {
      s.lastInput = 'keyboard'
      if (e.key === 'Escape') hide()
    }
    const onScroll = () => { cancelPress(); hide() }

    const listeners = [
      ['pointerover', onPointerOver], ['pointerout', onPointerOut], ['pointerdown', onPointerDown, true],
      ['pointermove', onPointerMove], ['pointerup', onPointerUp, true], ['pointercancel', onPointerCancel, true],
      ['click', onClick, true], ['contextmenu', onContextMenu], ['focusin', onFocusIn], ['focusout', onFocusOut],
      ['keydown', onKeyDown, true], ['scroll', onScroll, true],
    ]
    listeners.forEach(([type, fn, capture]) => document.addEventListener(type, fn, Boolean(capture)))
    window.addEventListener('resize', hide)
    return () => {
      listeners.forEach(([type, fn, capture]) => document.removeEventListener(type, fn, Boolean(capture)))
      window.removeEventListener('resize', hide)
      cancelPress()
      clearHideTimer()
    }
  }, [])

  // A route change hides it.
  useEffect(() => { setTip(null) }, [pathname])

  // A target that leaves the DOM takes its tooltip with it.
  useEffect(() => {
    if (!tip || typeof MutationObserver !== 'function') return undefined
    const observer = new MutationObserver(() => { if (!tip.target.isConnected) setTip(null) })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tip])

  useLayoutEffect(() => {
    const el = tipRef.current
    if (!tip || !el) return
    const r = tip.target.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    const { placement, top, left, arrow } = placeTooltip(r, box,
      { width: window.innerWidth || document.documentElement.clientWidth }, navbarHeight())
    el.dataset.placement = placement
    el.style.setProperty('top', `${Math.round(top)}px`)
    el.style.setProperty('left', `${Math.round(left)}px`)
    el.style.setProperty('--pg-tip-arrow', `${Math.round(arrow)}px`)
  }, [tip])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div ref={tipRef} className="pg-tooltip" hidden={!tip} aria-hidden="true" data-testid="pg-tooltip">
      {tip?.text}
      <span className="pg-tooltip__arrow" />
    </div>,
    document.body,
  )
}
