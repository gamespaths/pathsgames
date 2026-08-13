import { describe, it, expect } from 'vitest'
import { buildMapGraph, edgeVisibility, traversalDirection, MAP_PAD, MAP_CELL } from '@/utils/mapGraph'

/* /info fixture: player on location 1; 1 is active with neighbors to 3 (NORTH,
   two-way) and to 5 (one-way INTO 1, authored 5→1); 3 is visited but not active;
   5 was never visited (so it is ABSENT from locations[] and only appears as an
   edge endpoint); 9 is visited but disconnected.
   v0.28.6 — locations[] is the VISITED set and carries no `name`. */
const INFO = {
  players: [{ idLocation: 1 }],
  locations: [
    { idLocation: 1, uuid: 'l1', flagAlreadyActived: 1, clockCounter: 0 },
    { idLocation: 3, uuid: 'l3', flagAlreadyActived: 1, clockCounter: 0 },
    { idLocation: 9, uuid: 'l9', flagAlreadyActived: 1, clockCounter: 0 },
  ],
  locationsActive: [
    {
      idLocation: 1, uuid: 'l1',
      card: { title: 'Start location', urlImage: 'http://img/start.jpg' },
      neighbors: [
        { uuid: 'n1', idLocationFrom: 1, idLocationTo: 3, direction: 'NORTH', flagBack: 1,
          energyCost: 2, card: { title: 'Go north', urlImage: 'http://img/link3.jpg' } },
        { uuid: 'n2', idLocationFrom: 5, idLocationTo: 1, direction: 'NORTH', flagBack: 0,
          card: { title: 'Strange path', urlImage: 'http://img/link5.jpg' } },
      ],
    },
  ],
}

describe('buildMapGraph', () => {
  it('builds nodes for active locations, neighbor ends and disconnected visited ones', () => {
    const g = buildMapGraph(INFO)
    const ids = g.nodes.map(n => n.id).sort()
    expect(ids).toEqual([1, 3, 5, 9])
    expect(g.currentId).toBe(1)
  })

  it('marks visited/current flags and keeps the active-location photo', () => {
    const g = buildMapGraph(INFO)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[1].current).toBe(true)
    expect(byId[1].visited).toBe(true)
    expect(byId[1].urlImage).toBe('http://img/start.jpg')
    expect(byId[3].visited).toBe(true)      // present in info.locations (= visited)
    // Step 0.28.5 — the /info neighbor-LINK card must NOT feed the node photo;
    // a location photo comes only from a location card (active, /locations, or —
    // since v0.28.6 — the neighbor's cardLocationFrom/cardLocationTo).
    expect(byId[3].urlImage).toBe(null)
    expect(byId[5].visited).toBe(false)     // absent from locations[] → "?" node
    expect(byId[9].visited).toBe(true)
  })

  it('takes the neighbor node photo from cardLocationTo/From (fog-gated) — v0.28.6', () => {
    // The /info neighbor now carries the LOCATION card of each edge endpoint,
    // already null while unvisited. It feeds the node photo even before the
    // /locations payload arrives (the adapter runs without it in GamePage).
    const info = JSON.parse(JSON.stringify(INFO))
    const nbs = info.locationsActive[0].neighbors
    // 1 → 3: destination 3 is visited, so its LOCATION card is resolved.
    nbs[0].cardLocationTo = { title: 'Center', urlImage: 'http://loc/3.jpg' }
    nbs[0].cardLocationFrom = { title: 'Start location', urlImage: 'http://img/start.jpg' }
    // 5 → 1: endpoint 5 is unvisited → the backend sends null (fog of war).
    nbs[1].cardLocationFrom = null
    nbs[1].cardLocationTo = { title: 'Start location', urlImage: 'http://img/start.jpg' }

    const g = buildMapGraph(info)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[3].urlImage).toBe('http://loc/3.jpg')   // visited → real photo
    expect(byId[3].name).toBe('Center')
    expect(byId[5].urlImage).toBe(null)                 // unvisited → stays "?"
    expect(byId[5].name).toBe('')
  })

  it('takes the location photo/card from the /locations payload entries', () => {
    // Step 0.28.5 — /locations now carries each location's own card; the map
    // node photo comes from there (location card), not the neighbor-link card.
    const matchLocations = {
      locations: [
        { idLocation: 1, uuid: 'l1',
          card: { uuid: 'card-1', title: 'Start', urlImage: 'http://loc/1.jpg' },
          neighbors: [
            { idLocation: 3, uuid: 'l3', direction: 'NORTH', totalEnergyCost: 2,
              idCard: 30, card: { uuid: 'card-3', title: 'Center', urlImage: 'http://loc/3.jpg' } },
          ] },
      ],
    }
    const g = buildMapGraph(INFO, matchLocations)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[1].urlImage).toBe('http://loc/1.jpg')
    expect(byId[1].card).toMatchObject({ uuid: 'card-1' })
    // neighbor 3's own LOCATION card (from the neighbor entry) feeds its node
    expect(byId[3].urlImage).toBe('http://loc/3.jpg')
    expect(byId[3].card).toMatchObject({ uuid: 'card-3' })
  })

  it('builds the edges with direction and flagBack', () => {
    const g = buildMapGraph(INFO)
    expect(g.edges).toHaveLength(2)
    const e13 = g.edges.find(e => e.from === 1 && e.to === 3)
    expect(e13).toMatchObject({ dir: 'NORTH', back: true, energyCost: 2 })
    const e51 = g.edges.find(e => e.from === 5 && e.to === 1)
    expect(e51).toMatchObject({ dir: 'NORTH', back: false })
  })

  it('lays the grid out by direction: NORTH decreases y', () => {
    const g = buildMapGraph(INFO)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[3].y).toBeLessThan(byId[1].y)       // 3 is north of 1
    expect(byId[5].y).toBeGreaterThan(byId[1].y)    // 1 is north of 5 → 5 below
    expect(byId[1].x).toBe(byId[3].x)               // same column
  })

  it('places disconnected visited locations on a bottom spare row', () => {
    const g = buildMapGraph(INFO)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    const maxOthers = Math.max(byId[1].y, byId[3].y, byId[5].y)
    expect(byId[9].y).toBeGreaterThan(maxOthers)
  })

  it('normalizes coordinates to the padded grid metric', () => {
    const g = buildMapGraph(INFO)
    g.nodes.forEach(n => {
      expect(n.x).toBeGreaterThanOrEqual(MAP_PAD + MAP_CELL / 2)
      expect(n.y).toBeGreaterThanOrEqual(MAP_PAD + MAP_CELL / 2)
    })
    expect(g.width).toBeGreaterThan(0)
    expect(g.height).toBeGreaterThan(0)
  })

  it('handles a null/empty info gracefully', () => {
    expect(buildMapGraph(null)).toMatchObject({ nodes: [], edges: [], currentId: null })
    expect(buildMapGraph({})).toMatchObject({ nodes: [], edges: [] })
  })

  it('unions the visited sets of /locations and /info (v0.28.6)', () => {
    // Both payloads now project the SAME visited set (character positions ∪
    // movement log), so /info.locations is no longer a weaker proxy to be
    // overridden — it is authoritative too. They can only disagree while one of
    // them is momentarily stale, and a union never hides a node that either
    // payload reports as visited.
    const matchLocations = {
      locations: [
        { idLocation: 1, uuid: 'l1', neighbors: [
          { idLocation: 3, uuid: 'l3', direction: 'NORTH', totalEnergyCost: 4 }] },
        { idLocation: 7, uuid: 'l7', neighbors: [] }, // known only to /locations
      ],
    }
    const g = buildMapGraph(INFO, matchLocations)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[1].visited).toBe(true)
    expect(byId[3].visited).toBe(true)  // from /info.locations
    expect(byId[7].visited).toBe(true)  // from the /locations payload
    expect(byId[9].visited).toBe(true)  // from /info.locations (disconnected)
    expect(byId[5].visited).toBe(false) // in neither → still unexplored
  })

  it('leaves a location unexplored when it is in neither visited payload', () => {
    const bare = { ...INFO, locations: [] }
    const g = buildMapGraph(bare, { locations: [] })
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    // 1 is still visited: a character stands on it (locationsActive).
    expect(byId[1].visited).toBe(true)
    expect(byId[3].visited).toBe(false)
    expect(byId[5].visited).toBe(false)
    expect(byId[9]).toBeUndefined() // not visited, not referenced → not on the map
  })

  it('marks back=true when both directions exist in the /locations payload', () => {
    const matchLocations = {
      locations: [
        { idLocation: 1, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 4 }] },
        { idLocation: 3, neighbors: [{ idLocation: 1, direction: 'SOUTH', totalEnergyCost: 4 }] },
      ],
    }
    const g = buildMapGraph({ players: [{ idLocation: 1 }] }, matchLocations)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ back: true, energyCost: 4 })
  })

  it('keeps back=false when only one direction exists in the /locations payload', () => {
    const matchLocations = {
      locations: [
        { idLocation: 1, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 2 }] },
        { idLocation: 3, neighbors: [] },
      ],
    }
    const g = buildMapGraph({ players: [{ idLocation: 1 }] }, matchLocations)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ from: 1, to: 3, back: false })
  })

  it('dedupes the same edge listed by two active locations', () => {
    const info = {
      players: [{ idLocation: 1 }],
      locations: [],
      locationsActive: [
        { idLocation: 1, card: { title: 'A' }, neighbors: [
          { idLocationFrom: 1, idLocationTo: 2, direction: 'EAST', flagBack: 1 }] },
        { idLocation: 2, card: { title: 'B' }, neighbors: [
          { idLocationFrom: 1, idLocationTo: 2, direction: 'EAST', flagBack: 1 }] },
      ],
    }
    expect(buildMapGraph(info).edges).toHaveLength(1)
  })

  it('probes the next free cell when two neighbors share a direction target', () => {
    const info = {
      players: [{ idLocation: 1 }],
      locations: [],
      locationsActive: [
        { idLocation: 1, card: { title: 'A' }, neighbors: [
          { idLocationFrom: 1, idLocationTo: 2, direction: 'NORTH', flagBack: 1 },
          { idLocationFrom: 3, idLocationTo: 1, direction: 'SOUTH', flagBack: 1 },
        ] },
      ],
    }
    // 2 goes NORTH of 1; 3 authored 3→1 SOUTH means 1 is south of 3 → 3 also
    // wants the NORTH cell: it must probe a lateral cell, not overlap.
    const g = buildMapGraph(info)
    const positions = new Set(g.nodes.map(n => `${n.x},${n.y}`))
    expect(positions.size).toBe(3)
  })

  it('shows every link of the main location with the real /locations payload (regression)', () => {
    // real loc.json shape: the payload direction is the AUTHORED story-edge
    // direction (loc 3 → 1 says NORTH because the story edge is 1→3 NORTH).
    const matchLocations = {
      locations: [
        { idLocation: 5, uuid: 'u5', safe: true, characterCount: 1, neighbors: [
          { idLocation: 1, uuid: 'u1', direction: 'NORTH', totalEnergyCost: 3 }] },
        { idLocation: 1, uuid: 'u1', safe: false, characterCount: 0, neighbors: [
          { idLocation: 3, uuid: 'u3', direction: 'NORTH', totalEnergyCost: 3 }] },
        { idLocation: 3, uuid: 'u3', safe: false, characterCount: 0, neighbors: [
          { idLocation: 1, uuid: 'u1', direction: 'NORTH', totalEnergyCost: 3 },
          { idLocation: 2, uuid: 'u2', direction: 'NORTH', totalEnergyCost: 5 },
          { idLocation: 4, uuid: 'u4', direction: 'WEST', totalEnergyCost: 3 }] },
        { idLocation: 4, uuid: 'u4', safe: true, characterCount: 0, neighbors: [
          { idLocation: 3, uuid: 'u3', direction: 'WEST', totalEnergyCost: 3 },
          { idLocation: 5, uuid: 'u5', direction: 'SOUTH', totalEnergyCost: 6 }] },
      ],
    }
    const info = {
      players: [{ idLocation: 5 }],
      locations: [],
      locationsActive: [
        { idLocation: 5, card: { title: 'Secret' }, neighbors: [
          { idLocationFrom: 5, idLocationTo: 1, direction: 'NORTH', flagBack: 0 }] },
      ],
    }
    const g = buildMapGraph(info, matchLocations)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[5].safe).toBe(true)
    expect(byId[4].safe).toBe(true)
    expect(byId[1].safe).toBe(false)
    // the main location (3) has THREE links: 1↔3, 3→2, 3↔4
    const incident3 = g.edges.filter(e => e.from === 3 || e.to === 3)
    expect(incident3).toHaveLength(3)
    // two-way pairs collapsed, one-ways kept: 5→1, 1↔3, 3→2, 3↔4, 4→5
    expect(g.edges).toHaveLength(5)
    // every node on its own cell
    const cells = new Set(g.nodes.map(n => `${n.x},${n.y}`))
    expect(cells.size).toBe(g.nodes.length)
    // no edge segment may pass through a third node (the bug that visually
    // hid the 1↔3 link under another node)
    const byIdPos = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    const onSegment = (p, a, b) => {
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
      if (cross !== 0) return false
      const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      return dot > 0 && dot < len2
    }
    g.edges.forEach(e => {
      const a = byIdPos[e.from], b = byIdPos[e.to]
      g.nodes.forEach(n => {
        if (n.id === e.from || n.id === e.to) return
        expect(onSegment(n, a, b)).toBe(false)
      })
    })
  })

  it('prefers the /info authored orientation over the payload insertion order', () => {
    // the payload lists the back-traversal (3 → 1, authored NORTH) FIRST;
    // /info says the story edge is 1→3 NORTH → the edge must stay 1→3.
    const matchLocations = {
      locations: [
        { idLocation: 3, neighbors: [{ idLocation: 1, direction: 'NORTH', totalEnergyCost: 2 }] },
        { idLocation: 1, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 2 }] },
      ],
    }
    const info = {
      players: [{ idLocation: 1 }],
      locations: [],
      locationsActive: [
        { idLocation: 1, card: { title: 'Start' }, neighbors: [
          { idLocationFrom: 1, idLocationTo: 3, direction: 'NORTH', flagBack: 1 }] },
      ],
    }
    const g = buildMapGraph(info, matchLocations)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ from: 1, to: 3, dir: 'NORTH', back: true })
    // geometric check: 3 sits NORTH of 1 (smaller y)
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[3].y).toBeLessThan(byId[1].y)
  })

  it('orients an edge the player is not standing on from the payload endpoints', () => {
    // 2↔3 touches no active location, so /info says nothing about it and only the
    // endpoints shipped by /locations can orient it. The payload lists the
    // back-traversal side (3, the edge's `to`) FIRST: without the endpoints the
    // edge would survive as 3→2 SOUTH and the map would mirror the two.
    const info = {
      players: [{ idLocation: 1 }],
      locations: [{ idLocation: 1 }, { idLocation: 2 }, { idLocation: 3 }],
      locationsActive: [
        { idLocation: 1, card: { title: 'Start' }, neighbors: [
          { idLocationFrom: 1, idLocationTo: 2, direction: 'EAST', flagBack: 1, energyCost: 1 }] },
      ],
    }
    const matchLocations = {
      locations: [
        { idLocation: 1, neighbors: [
          { idLocation: 2, direction: 'EAST', idLocationFrom: 1, idLocationTo: 2, totalEnergyCost: 1 }] },
        { idLocation: 3, neighbors: [
          { idLocation: 2, direction: 'SOUTH', idLocationFrom: 2, idLocationTo: 3, totalEnergyCost: 1 }] },
        { idLocation: 2, neighbors: [
          { idLocation: 1, direction: 'EAST', idLocationFrom: 1, idLocationTo: 2, totalEnergyCost: 1 },
          { idLocation: 3, direction: 'SOUTH', idLocationFrom: 2, idLocationTo: 3, totalEnergyCost: 1 }] },
      ],
    }
    const g = buildMapGraph(info, matchLocations)
    expect(g.edges).toContainEqual(
      expect.objectContaining({ from: 2, to: 3, dir: 'SOUTH', back: true }))
    // geometric check: 3 sits SOUTH of 2 (bigger y), on the same column
    const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]))
    expect(byId[3].y).toBeGreaterThan(byId[2].y)
    expect(byId[3].x).toBe(byId[2].x)
  })

  it('falls back to the raw payload direction when the endpoints are absent (old backend)', () => {
    // Same graph without idLocationFrom/idLocationTo: the orientation is then only
    // as good as the listing order, but the edge must still be built.
    const matchLocations = {
      locations: [
        { idLocation: 2, neighbors: [{ idLocation: 3, direction: 'SOUTH', totalEnergyCost: 1 }] },
        { idLocation: 3, neighbors: [{ idLocation: 2, direction: 'SOUTH', totalEnergyCost: 1 }] },
      ],
    }
    const g = buildMapGraph({ players: [{ idLocation: 2 }] }, matchLocations)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ from: 2, to: 3, dir: 'SOUTH', back: true })
  })
})

describe('traversalDirection', () => {
  it('leaves a forward move on the authored direction', () => {
    expect(traversalDirection('NORTH', false)).toBe('NORTH')
    expect(traversalDirection('ABOVE')).toBe('ABOVE')
  })

  it('flips every direction that has an opposite on a return move', () => {
    expect(traversalDirection('NORTH', true)).toBe('SOUTH')
    expect(traversalDirection('SOUTH', true)).toBe('NORTH')
    expect(traversalDirection('EAST', true)).toBe('WEST')
    expect(traversalDirection('WEST', true)).toBe('EAST')
    expect(traversalDirection('ABOVE', true)).toBe('BELOW')
    expect(traversalDirection('BELOW', true)).toBe('ABOVE')
    // case-insensitive on the way in, canonical on the way out
    expect(traversalDirection('north', true)).toBe('SOUTH')
  })

  it('returns null rather than a wrong direction when there is no opposite', () => {
    expect(traversalDirection('SKY', true)).toBeNull()
    expect(traversalDirection('WHATEVER', true)).toBeNull()
    expect(traversalDirection(null, true)).toBeNull()
    expect(traversalDirection(undefined)).toBeNull()
    expect(traversalDirection(42, true)).toBeNull()
  })
})

describe('edgeVisibility', () => {
  const visited = new Set([1, 3])
  const isVisited = (id) => visited.has(id)

  it('shows both directions between visited locations on a two-way link', () => {
    expect(edgeVisibility({ from: 1, to: 3, back: true }, isVisited))
      .toEqual({ fwd: true, bwd: true })
  })
  it('hides the arrow leaving an unexplored location, keeps the one entering it', () => {
    expect(edgeVisibility({ from: 5, to: 1, back: true }, isVisited))
      .toEqual({ fwd: false, bwd: true })
  })
  it('hides a one-way link out of an unexplored location entirely', () => {
    expect(edgeVisibility({ from: 5, to: 1, back: false }, isVisited))
      .toEqual({ fwd: false, bwd: false })
  })
  it('keeps a one-way link from a visited location into the unknown', () => {
    expect(edgeVisibility({ from: 1, to: 5, back: false }, isVisited))
      .toEqual({ fwd: true, bwd: false })
  })
})
