import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { buildMapGraph, edgeVisibility, MAP_NODE_R } from '@/utils/mapGraph'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import { UserAvatar } from '@/features/guest-user/UserAccountPanel'

/**
 * Map — the world map rendered as the book's LEFT reading page (v0.28.5 Map
 * concept graphics): a book-page-content card with the golden title bar + back
 * arrow, the map plane on a parchment background, small gold arrows on every
 * path (a bigger one on the exits from the current location), dashed one-way
 * links, "?" nodes for unexplored neighbors and a legend footer. Drag to pan,
 * wheel to zoom, +/−/◎ controls. Shown on desktop AND mobile (stacked).
 *
 * The component function keeps the name `MapPage` so it does not shadow the
 * global `Map` constructor used below (`new Map(...)`).
 */
export default function MapPage({ gameData, matchLocations, selectedId = null, onSelectNode, onClose }) {
  const { t } = useTranslation()
  // v1.4.0 — a Google user is marked by its round picture instead of the street-view glyph
  const { user, isGoogleUser } = useGuestUser() ?? {}
  const pictureUrl = isGoogleUser ? user?.pictureUrl : null
  const hereIcon = <i className="fas fa-street-view" />
  const graph = useMemo(
    () => buildMapGraph(gameData?.info, matchLocations),
    [gameData?.info, matchLocations],
  )
  const { nodes, edges, currentId, width, height } = graph
  // where the character stands — the "you are here" marker
  const hereId = gameData?.info?.players?.[0]?.idLocation ?? null
  // the gold ring: the explicitly selected location, else the character's one
  const ringId = selectedId ?? hereId

  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const isVisited = (id) => !!nodeById.get(id)?.visited

  /* ---------- pan & zoom ---------- */
  const canvasRef = useRef(null)
  const dragRef = useRef(null) // { sx, sy, stx, sty, moved }
  // survives past pointerup so the click handler can tell a drag from a tap
  const movedRef = useRef(false)
  // The world's origin sits at the canvas centre (CSS), so tx/ty are offsets from it and need no measuring.
  const bounds = useMemo(() => nodes.length ? {
    minX: Math.min(...nodes.map(n => n.x)), maxX: Math.max(...nodes.map(n => n.x)),
    minY: Math.min(...nodes.map(n => n.y)), maxY: Math.max(...nodes.map(n => n.y)),
  } : null, [nodes])
  function centred(id, scale) {
    const node = nodeById.get(id)
    return node ? { tx: -node.x * scale, ty: -node.y * scale } : { tx: -width * scale / 2, ty: -height * scale / 2 }
  }
  // Start zoomed in 2× (0.8 → 1.2) and already centred: page turn copies taken at commit see it too (step 15).
  const [view, setView] = useState(() => ({ ...centred(currentId, 1.2), scale: 1.2, anim: false, at: currentId }))
  // the board reloaded on another location: recentre during render, so the committed DOM is centred
  if (view.at !== currentId) setView(v => ({ ...v, ...centred(currentId, v.scale), anim: false, at: currentId }))

  function clamp(tx, ty, scale) {
    const el = canvasRef.current
    if (!el) return { tx, ty }
    const M = 90
    const [vw, vh] = [el.clientWidth, el.clientHeight]
    // margins in canvas px, shifted to centre-relative offsets; widened so any location can sit at the centre
    let loX = Math.min(M, vw - width * scale - M) - vw / 2, hiX = Math.max(M, vw - width * scale - M) - vw / 2
    let loY = Math.min(M, vh - height * scale - M) - vh / 2, hiY = Math.max(M, vh - height * scale - M) - vh / 2
    if (bounds) {
      loX = Math.min(loX, -bounds.maxX * scale); hiX = Math.max(hiX, -bounds.minX * scale)
      loY = Math.min(loY, -bounds.maxY * scale); hiY = Math.max(hiY, -bounds.minY * scale)
    }
    return { tx: Math.max(loX, Math.min(hiX, tx)), ty: Math.max(loY, Math.min(hiY, ty)) }
  }
  function centerOn(id, animate) {
    if (!nodeById.get(id)) return
    setView(v => {
      const c = centred(id, v.scale)
      return { ...v, ...clamp(c.tx, c.ty, v.scale), anim: !!animate }
    })
  }
  // cx, cy: the zoom anchor in canvas px (top-left origin)
  function zoomAt(cx, cy, factor) {
    const el = canvasRef.current
    const px = cx - el.clientWidth / 2, py = cy - el.clientHeight / 2
    setView(v => {
      const scale = Math.max(0.4, Math.min(2.6, v.scale * factor))
      const tx = px - (px - v.tx) * (scale / v.scale)
      const ty = py - (py - v.ty) * (scale / v.scale)
      return { ...v, scale, ...clamp(tx, ty, scale), anim: false }
    })
  }

  function onPointerDown(e) {
    movedRef.current = false
    dragRef.current = { sx: e.clientX, sy: e.clientY, stx: view.tx, sty: view.ty }
  }
  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (Math.hypot(dx, dy) > 5) movedRef.current = true
    setView(v => ({ ...v, ...clamp(d.stx + dx, d.sty + dy, v.scale), anim: false }))
  }
  function onPointerUp() { dragRef.current = null }

  // the wheel listener lives once per mount: it calls the latest zoomAt (graph size and bounds of this render)
  const zoomRef = useRef(zoomAt)
  zoomRef.current = zoomAt
  // wheel zoom needs a non-passive listener to preventDefault the page scroll
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomRef.current(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ---------- edges ---------- */
  function shorten(a, b, r) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
    return {
      x1: a.x + (dx / len) * r, y1: a.y + (dy / len) * r,
      x2: b.x - (dx / len) * r, y2: b.y - (dy / len) * r,
    }
  }
  // Arrowheads are plain polygons in graph coordinates, not <marker> defs:
  // markers are unreliable on mobile browsers when the SVG lives inside a
  // CSS-transformed layer (they render at the wrong size or not at all), while a
  // polygon is just geometry and pans/zooms with everything else.
  const ARROW_LEN = 8, ARROW_HALF_W = 6 /*quiquiqui*/
  const ARROW_LEN_BIG = 12, ARROW_HALF_W_BIG = 12
  // The head is pushed this far PAST the line's end, outward toward the node it
  // points at: sitting exactly on the end point it read as sunk into the path.
  // Along the edge direction, so a vertical edge moves its top head up and its
  // bottom head down, a horizontal one moves left and right, and so on.
  const ARROW_TIP_OUT = 3
  function arrowHead(endX, endY, fromX, fromY, big) {
    const dx = endX - fromX, dy = endY - fromY, len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len            // unit vector, pointing outward
    const L = big ? ARROW_LEN_BIG : ARROW_LEN
    const W = big ? ARROW_HALF_W_BIG : ARROW_HALF_W
    const tipX = endX + ux * ARROW_TIP_OUT, tipY = endY + uy * ARROW_TIP_OUT
    const bx = tipX - ux * L, by = tipY - uy * L  // base of the head
    const px = -uy * W, py = ux * W               // perpendicular half-width
    return `${tipX},${tipY} ${bx + px},${by + py} ${bx - px},${by - py}`
  }

  const edgeEls = edges.map((e, i) => {
    const { fwd, bwd } = edgeVisibility(e, isVisited)
    if (!fwd && !bwd) return null // arrows never leave an unexplored location
    const a = nodeById.get(e.from), b = nodeById.get(e.to)
    if (!a || !b) return null
    const isExit = e.from === currentId || (e.to === currentId && e.back)
    const hot = e.from === currentId || e.to === currentId
    const cls = 'game-map-edge' + (e.back ? '' : ' game-map-edge--oneway') + (hot ? ' game-map-edge--hot' : '')
    let s
    let heads // [{ big }] positions resolved below
    if (fwd && bwd && isExit) {
      // draw FROM the current location: one big arrow shows the move direction
      const from = e.from === currentId ? a : b
      const to = e.from === currentId ? b : a
      s = shorten(from, to, MAP_NODE_R)
      heads = [{ at: 'end', big: true }]
    } else if (fwd && bwd) {
      // two-way path (both directions): a head at each end
      s = shorten(a, b, MAP_NODE_R)
      heads = [{ at: 'end', big: false }, { at: 'start', big: false }]
    } else {
      // single visible direction (one-way link, or the far end is unexplored)
      const from = fwd ? a : b, to = fwd ? b : a
      s = shorten(from, to, MAP_NODE_R)
      heads = [{ at: 'end', big: (fwd ? e.from : e.to) === currentId }]
    }
    const headCls = 'game-map-arrow' + (hot ? ' game-map-arrow--hot' : '')
    return (
      <g key={`${e.from}-${e.to}-${i}`}>
        <line className={cls} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        {heads.map(h => (
          <polygon key={h.at}
            className={headCls + (h.big ? ' game-map-arrow--big' : '')}
            points={h.at === 'end'
              ? arrowHead(s.x2, s.y2, s.x1, s.y1, h.big)
              : arrowHead(s.x1, s.y1, s.x2, s.y2, h.big)} />
        ))}
      </g>
    )
  })

  /* ---------- nodes ---------- */
  const nodeEls = nodes.map(n => {
    const cls = 'game-map-node'
      + (n.id === ringId ? ' game-map-node--current' : '')
      + (n.safe ? ' game-map-node--safe' : '')
      + (n.visited ? '' : ' game-map-node--unknown')
      // far "?" — not bordering the character's location: no dashed ring
      + (!n.visited && !n.isNeighbor ? ' game-map-node--far' : '')
    const style = { left: `${n.x}px`, top: `${n.y}px` }
    if (n.visited && n.urlImage) style.backgroundImage = `url("${n.urlImage}")`
    // clicking a location selects it (its card opens on the right page):
    // explored nodes always; "?" nodes only when they border the character's
    // location — their own card is still fog-gated, so the right page shows
    // the NEIGHBOR (movement) card instead. A drag never counts as a click
    // (movedRef).
    const clickable = (n.visited || n.isNeighbor) && typeof onSelectNode === 'function'
    return (
      <div key={n.id} className={cls} style={style}
        title={n.visited ? (n.name || '') : t('game.map.unexplored')}
        data-testid={`map-node-${n.id}`}
        {...(clickable ? {
          role: 'button',
          onClick: () => { if (!movedRef.current) onSelectNode(n) },
        } : {})}>
        {n.visited && !n.urlImage && <i className="fas fa-map-marker-alt game-map-node__icon" />}
        {n.id === hereId && (
          <span className="game-map-node__here" title={t('game.map.youAreHere')}
            data-testid="map-here-marker">
            <UserAvatar url={pictureUrl} className="game-map-avatar" fallback={hereIcon} />
          </span>
        )}
      </div>
    )
  })

  return (
    <div className="book-page-content game-map-page">
      <h2 className="book-page-title">
        {onClose && (
          <button className="float-left book-page-nav book-page-nav--back" onClick={onClose} aria-label={t('card.back')}>
            <i className="fas fa-arrow-left" />
          </button>
        )}
        {t('game.map.title')}
      </h2>
      <div ref={canvasRef} className="game-map-canvas" data-testid="game-map-canvas"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <div className={'game-map-world' + (view.anim ? ' game-map-world--anim' : '')}
          style={{ width, height, maxWidth: 'none',
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
          {/* The SVG spans the whole graph plane in graph coordinates, so its size is
              pinned inline: if any stylesheet shrinks it, the viewBox rescales the paths
              while the nodes (absolute, in px) stay put and the two drift apart. */}
          <svg className="game-map-svg" width={width} height={height}
            viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet"
            style={{ width: `${width}px`, height: `${height}px`, maxWidth: 'none' }}>
            <g>{edgeEls}</g>
          </svg>
          {nodeEls}
        </div>
        <div className="game-map-ctrl">
          <button type="button" aria-label={t('game.map.zoomIn')} data-tip={t('game.map.zoomIn')}
            onClick={() => { const el = canvasRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.25) }}>+</button>
          <button type="button" aria-label={t('game.map.zoomOut')} data-tip={t('game.map.zoomOut')}
            onClick={() => { const el = canvasRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.25) }}>−</button>
          <button type="button" aria-label={t('game.map.center')} data-tip={t('game.map.center')}
            onClick={() => centerOn(currentId, true)}>◎</button>
        </div>
      </div>
      <div className="game-map-legend">
        <span><i className="game-map-legend__dot" /> {t('game.map.here')}</span>
        <span><UserAvatar url={pictureUrl} className="game-map-avatar game-map-avatar--legend" fallback={hereIcon} />
          {' '}{t('game.map.youAreHere')}</span>
        <span><i className="game-map-legend__safe" /> {t('game.map.safe')}</span>
        <span><b>?</b> {t('game.map.unexplored')}</span>
      </div>
    </div>
  )
}
