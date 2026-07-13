import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { buildMapGraph, edgeVisibility, MAP_NODE_R } from '@/utils/mapGraph'

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
  // Start zoomed in 2× (0.8 → 1.2) so the current area fills the map on open.
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1.2, anim: false })

  function clamp(tx, ty, scale) {
    const el = canvasRef.current
    if (!el) return { tx, ty }
    const M = 90
    const [vw, vh] = [el.clientWidth, el.clientHeight]
    const loX = Math.min(M, vw - width * scale - M), hiX = Math.max(M, vw - width * scale - M)
    const loY = Math.min(M, vh - height * scale - M), hiY = Math.max(M, vh - height * scale - M)
    return { tx: Math.max(loX, Math.min(hiX, tx)), ty: Math.max(loY, Math.min(hiY, ty)) }
  }
  function centerOn(id, animate) {
    const el = canvasRef.current
    const node = nodeById.get(id)
    if (!el || !node) return
    setView(v => ({
      ...v,
      ...clamp(el.clientWidth / 2 - node.x * v.scale, el.clientHeight / 2 - node.y * v.scale, v.scale),
      anim: !!animate,
    }))
  }
  function zoomAt(cx, cy, factor) {
    setView(v => {
      const scale = Math.max(0.4, Math.min(2.6, v.scale * factor))
      const tx = cx - (cx - v.tx) * (scale / v.scale)
      const ty = cy - (cy - v.ty) * (scale / v.scale)
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

  // wheel zoom needs a non-passive listener to preventDefault the page scroll
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // center the current location on mount / when the board reloads
  useEffect(() => {
    if (currentId != null) requestAnimationFrame(() => centerOn(currentId, false))
  }, [currentId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const style = { left: `${n.x}px`, top: `${n.y}px` }
    if (n.visited && n.urlImage) style.backgroundImage = `url("${n.urlImage}")`
    // clicking an explored location selects it (its card opens on the right
    // page); a drag never counts as a click (movedRef)
    const clickable = n.visited && typeof onSelectNode === 'function'
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
            <i className="fas fa-street-view" />
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
          <button type="button" title={t('game.map.zoomIn')}
            onClick={() => { const el = canvasRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.25) }}>+</button>
          <button type="button" title={t('game.map.zoomOut')}
            onClick={() => { const el = canvasRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.25) }}>−</button>
          <button type="button" title={t('game.map.center')}
            onClick={() => centerOn(currentId, true)}>◎</button>
        </div>
      </div>
      <div className="game-map-legend">
        <span><i className="game-map-legend__dot" /> {t('game.map.here')}</span>
        <span><i className="fas fa-street-view" /> {t('game.map.youAreHere')}</span>
        <span><i className="game-map-legend__safe" /> {t('game.map.safe')}</span>
        <span><b>?</b> {t('game.map.unexplored')}</span>
      </div>
    </div>
  )
}
