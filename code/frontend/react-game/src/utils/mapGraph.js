/**
 * mapGraph.js — builds the world-map graph consumed by MapPage from data
 * GameBook already holds.
 *
 * Sources:
 *  - matchLocations — the GET /api/match/{uuid}/locations payload
 *    (MatchLocationsResponse): the VISITED locations of the match, each with
 *    its directional neighbors[] (direction, totalEnergyCost). This is the
 *    authority on which locations were visited.
 *  - info.locationsActive[] — occupied locations WITH card (photo) + enriched
 *    neighbors[] (flagBack, link cards, and — v0.28.6 — cardLocationFrom /
 *    cardLocationTo: the LOCATION card of each edge endpoint, fog-gated).
 *  - info.locations[] — v0.28.6: the VISITED locations of the match (idLocation,
 *    uuid, flagAlreadyActived, clockCounter). Used as the visited set before the
 *    /locations payload lands. Location names come from cards, not from this list.
 *  - info.players[0].idLocation → where the character stands.
 *
 * Output: { nodes, edges, currentId, width, height }
 *  - nodes: [{ id, uuid, name, card, urlImage, visited, current, x, y }]
 *  - edges: [{ from, to, dir, back, energyCost }] — back=true when both
 *    directions exist (reverse neighbor entry or flagBack on an active edge).
 *
 * Layout: BFS over the neighbor directions (NORTH/SOUTH/EAST/WEST) on a unit
 * grid, probing farther cells on collisions; visited locations with no known
 * edge are appended on a bottom row. Grid coords are then normalized and
 * converted to px (same metric as the v0.28.5 Map concept).
 */

export const MAP_PAD = 30
export const MAP_CELL = 110
// Edges are shortened by this radius so the arrowheads stop OUTSIDE the node
// circle (nodes are 74px → 37px radius) instead of being hidden under it.
export const MAP_NODE_R = 42

const DIR_VECTORS = {
  NORTH: [0, -1],
  SOUTH: [0, 1],
  EAST: [1, 0],
  WEST: [-1, 0],
}
const OPPOSITE = { NORTH: 'SOUTH', SOUTH: 'NORTH', EAST: 'WEST', WEST: 'EAST' }

/** Direction initial shown on movement badges (kept for future use). */
export const DIR_LETTER = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W' }

/**
 * Build the map graph.
 * @param {object|null} info - gameData.info (MatchInfoResponse)
 * @param {object|null} matchLocations - GET /api/match/{uuid}/locations payload
 * @returns {{ nodes: Array, edges: Array, currentId: number|null, width: number, height: number }}
 */
export function buildMapGraph(info, matchLocations = null) {
  const activeList = Array.isArray(info?.locationsActive) ? info.locationsActive : []
  const leanList = Array.isArray(info?.locations) ? info.locations : []
  const mlList = Array.isArray(matchLocations?.locations) ? matchLocations.locations : []
  const currentId = info?.players?.[0]?.idLocation ?? activeList[0]?.idLocation ?? null

  // visited = the /locations payload entries (visited-only by contract). Before
  // that payload lands, info.locations[] carries the same set (v0.28.6), so it is
  // an exact fallback rather than an approximation. NOTE: flagAlreadyActived is NOT
  // a visited flag — it tracks the location's entry-event state.
  const visitedIds = new Set(mlList.map(l => l.idLocation))
  leanList.forEach(l => { if (l.idLocation != null) visitedIds.add(l.idLocation) })
  activeList.forEach(l => { if (l.idLocation != null) visitedIds.add(l.idLocation) })

  // ── nodes ──────────────────────────────────────────────────────────
  const nodeById = new Map()
  function upsertNode(id, patch) {
    if (id == null) return null
    const prev = nodeById.get(id) ?? {
      id, uuid: null, name: '', card: null, urlImage: null,
      safe: false,
      visited: visitedIds.has(id), current: id === currentId,
    }
    const next = { ...prev }
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (k === 'safe') {
        // any source saying safe=true marks the node as safe
        if (v === true) next.safe = true
        continue
      }
      if (v != null && (next[k] == null || next[k] === '')) next[k] = v
    }
    nodeById.set(id, next)
    return next
  }

  // visited locations from the /locations payload — Step 0.28.5 each entry now
  // carries the LOCATION's own resolved card (photo + description), so the map
  // nodes render the location photo, not the neighbor-link card.
  mlList.forEach(l => upsertNode(l.idLocation, {
    uuid: l.uuid,
    safe: l.safe,
    card: l.card,
    urlImage: l.card?.urlImage,
    name: l.card?.title,
  }))

  // active locations also carry their own card (same shape) — belt and braces
  // for the current location before /locations lands.
  activeList.forEach(l => upsertNode(l.idLocation, {
    uuid: l.uuid,
    safe: l.safe,
    card: l.card,
    urlImage: l.card?.urlImage,
    name: l.card?.title,
  }))

  // ── directed edge set ──────────────────────────────────────────────
  // /locations lists each visited location's LEGAL MOVES; a link is two-way
  // when the reverse entry exists (or flagBack says so, below). NOTE: the
  // payload's `direction` is the AUTHORED story-edge direction, not the
  // traversal one — a back-traversal entry carries the forward direction
  // (loc 3 → 1 reports NORTH because the story edge is 1→3 NORTH). The
  // authored orientation from /info (idLocationFrom/To) is the authority.
  const directed = new Map() // "from->to" → { from, to, dir, energyCost }
  function addDirected(from, to, dir, energyCost) {
    if (from == null || to == null) return
    const key = `${from}->${to}`
    if (!directed.has(key)) directed.set(key, { from, to, dir: dir ?? null, energyCost: energyCost ?? null })
  }
  const pairKey = (a, b) => `${Math.min(a, b)}|${Math.max(a, b)}`
  const authoredByPair = new Map() // pairKey → { from, to, dir } (story orientation)
  mlList.forEach(l => {
    (l.neighbors ?? []).forEach(n => {
      addDirected(l.idLocation, n.idLocation, n.direction, n.totalEnergyCost)
      // Step 0.28.5 — the neighbor entry now carries the neighbor LOCATION's card,
      // so a not-yet-active neighbor node still gets its real photo.
      upsertNode(n.idLocation, {
        uuid: n.uuid,
        safe: n.safe,
        card: n.card,
        urlImage: n.card?.urlImage,
        name: n.card?.title,

      })
    })
  })
  // active-location neighbors enrich ONLY the authored orientation (flagBack,
  // idLocationFrom/To). NOTE: in /info the neighbor `card` is the movement
  // (neighbor-LINK) card, not the location card, so it must NOT feed the node
  // photo. Its `cardLocationFrom`/`cardLocationTo` (v0.28.6) ARE the location
  // cards of the two endpoints and DO feed it — they are already fog-gated by the
  // backend (null while unvisited), so an unexplored node stays photo-less. This
  // is what gives the map real photos before the /locations payload arrives.
  activeList.forEach(l => {
    (l.neighbors ?? []).forEach(n => {
      const from = n.idLocationFrom ?? l.idLocation
      const to = n.idLocationTo ?? n.idLocation
      if (from == null || to == null) return
      addDirected(from, to, n.direction, n.energyCost)
      if (n.direction && !authoredByPair.has(pairKey(from, to))) {
        authoredByPair.set(pairKey(from, to), { from, to, dir: n.direction })
      }
      if (n.flagBack ?? n.flag_back) {
        addDirected(to, from, OPPOSITE[n.direction] ?? null, n.energyCost)
      }
      const farId = from === l.idLocation ? to : from
      const farCard = (farId === to ? n.cardLocationTo : n.cardLocationFrom) ?? null
      upsertNode(farId, {
        uuid: n.uuid,
        card: farCard,
        urlImage: farCard?.urlImage,
        name: farCard?.title,
        isNeighbor: (( n.idLocationFrom == currentId) || (n.idLocationTo == currentId  )) ,
      })
    })
  })

  // every other visited location (lean fallback only — no neighbors known). The
  // lean entry carries no card, so the node stays photo-less and name-less until
  // /locations (or an active-location neighbor) supplies one.
  leanList.forEach(l => {
    if (visitedIds.has(l.idLocation) && !nodeById.has(l.idLocation)) {
      upsertNode(l.idLocation, { uuid: l.uuid, safe: l.safe })
    }
  })

  // collapse directed pairs into ONE edge (single geometric constraint) with
  // the back flag; on two-way pairs both payload entries carry the same
  // authored direction, so prefer the /info authored orientation when known.
  const edges = []
  const consumed = new Set()
  directed.forEach((e, key) => {
    if (consumed.has(key)) return
    const revKey = `${e.to}->${e.from}`
    const back = directed.has(revKey)
    consumed.add(key)
    if (back) consumed.add(revKey)
    let { from, to, dir, energyCost } = e
    if (back) {
      const authored = authoredByPair.get(pairKey(from, to))
      if (authored && authored.from === to) {
        // the reverse entry is the authored one: flip to the story orientation
        const rev = directed.get(revKey)
        from = authored.from
        to = authored.to
        dir = authored.dir ?? rev?.dir ?? dir
        energyCost = rev?.energyCost ?? energyCost
      } else if (authored) {
        dir = authored.dir ?? dir
      }
    }
    edges.push({ from, to, dir, back, energyCost })
  })

  // ── grid layout: BFS over directions ───────────────────────────────
  const posById = new Map()
  const usedCells = new Set()
  const cellKey = (c, r) => `${c},${r}`
  function place(id, c, r) {
    posById.set(id, { c, r })
    usedCells.add(cellKey(c, r))
  }
  const adj = new Map()
  edges.forEach(e => {
    if (!DIR_VECTORS[e.dir]) return
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from).push({ id: e.to, dir: e.dir })
    // the reverse geometric hint keeps the BFS symmetric even on one-way links
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.to).push({ id: e.from, dir: OPPOSITE[e.dir] })
  })

  // Free-cell lookup for a placement in direction `dir` from `at`: try the
  // straight cell first, then LATERAL (perpendicular) offsets, then farther
  // steps. Probing sideways instead of along the axis keeps edges from
  // running collinearly underneath intermediate nodes (which visually hid
  // links — a node stacked on the segment swallowed the line).
  function freeCellFrom(at, dir) {
    const [dc, dr] = DIR_VECTORS[dir]
    const pc = Math.abs(dr), pr = Math.abs(dc) // perpendicular axis
    for (let step = 1; step <= 8; step++) {
      const bc = at.c + dc * step, br = at.r + dr * step
      for (const off of [0, 1, -1, 2, -2]) {
        const c = bc + pc * off, r = br + pr * off
        if (!usedCells.has(cellKey(c, r))) return { c, r }
      }
    }
    return null
  }

  const startId = nodeById.has(currentId) ? currentId : nodeById.keys().next().value
  if (startId != null) {
    place(startId, 0, 0)
    const queue = [startId]
    while (queue.length) {
      const id = queue.shift()
      const at = posById.get(id)
      for (const { id: nb, dir } of adj.get(id) ?? []) {
        if (posById.has(nb) || !nodeById.has(nb)) continue
        const cell = freeCellFrom(at, dir)
        if (!cell) continue // extremely dense area: bottom-row fallback below
        place(nb, cell.c, cell.r)
        queue.push(nb)
      }
    }
  }

  // disconnected visited locations: a bottom row, left to right
  const maxRow = Math.max(0, ...[...posById.values()].map(p => p.r))
  let spareCol = 0
  nodeById.forEach((node, id) => {
    if (posById.has(id)) return
    while (usedCells.has(cellKey(spareCol, maxRow + 1))) spareCol += 1
    place(id, spareCol, maxRow + 1)
  })

  // normalize to a 0-based grid and convert to px
  const cols = [...posById.values()].map(p => p.c)
  const rows = [...posById.values()].map(p => p.r)
  const minC = cols.length ? Math.min(...cols) : 0
  const minR = rows.length ? Math.min(...rows) : 0
  const nodes = [...nodeById.values()].map(n => {
    const p = posById.get(n.id)
    return {
      ...n,
      x: MAP_PAD + (p.c - minC + 0.5) * MAP_CELL,
      y: MAP_PAD + (p.r - minR + 0.5) * MAP_CELL,
    }
  })
  const width = MAP_PAD * 2 + (cols.length ? (Math.max(...cols) - minC + 1) : 1) * MAP_CELL
  const height = MAP_PAD * 2 + (rows.length ? (Math.max(...rows) - minR + 1) : 1) * MAP_CELL

  return { nodes, edges, currentId, width, height }
}

/**
 * Visibility of an edge under fog of war (same rules as the v0.28.5 concept):
 * an arrow leaving an unexplored location is hidden; an arrow from a visited
 * location INTO an unexplored one stays visible.
 * @returns {{ fwd: boolean, bwd: boolean }} visible directions (from→to / to→from)
 */
export function edgeVisibility(edge, isVisited) {
  const fwd = isVisited(edge.from)
  const bwd = !!edge.back && isVisited(edge.to)
  return { fwd, bwd }
}

export default buildMapGraph
