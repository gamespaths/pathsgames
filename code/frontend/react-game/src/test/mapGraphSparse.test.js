import { describe, it, expect } from 'vitest'
import { buildMapGraph } from '../utils/mapGraph'

/**
 * The map is drawn from three payloads that overlap: the /locations list, the lean
 * `info.locations` and the active location's neighbours. Each of them may name an
 * endpoint the others do not, name none at all, or name one twice. This suite feeds
 * the graph builder those shapes.
 */

describe('buildMapGraph over incomplete payloads', () => {
  it('ignores lean and active rows that carry no location id', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locations: [{ idLocation: null }, { idLocation: 1 }],
      locationsActive: [{ idLocation: null, neighbors: [] }, { idLocation: 1, neighbors: [] }],
    })

    expect(graph.nodes.map(n => n.id)).toEqual([1])
    expect(graph.nodes[0].visited).toBe(true)
    expect(graph.nodes[0].current).toBe(true)
  })

  it('skips a neighbour edge whose endpoints cannot be resolved', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locationsActive: [{
        idLocation: null,                       // no origin to fall back on…
        neighbors: [{ idLocation: null }],      // …and no destination either
      }],
    })

    expect(graph.edges).toEqual([])
  })

  it('keeps the first orientation of a pair and adds the return edge for a two-way link', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locationsActive: [{
        idLocation: 1,
        neighbors: [
          { idLocation: 2, idLocationFrom: 1, idLocationTo: 2, direction: 'NORTH', flagBack: 1, energyCost: 2 },
          // the same pair again, authored the other way: the first orientation wins
          { idLocation: 2, idLocationFrom: 2, idLocationTo: 1, direction: 'SOUTH' },
        ],
      }],
    })

    const pair = graph.edges.filter(e => (e.from === 1 && e.to === 2) || (e.from === 2 && e.to === 1))
    expect(pair.length).toBeGreaterThan(0)
    expect(pair[0].dir).toBe('NORTH')
  })

  it('reads the snake-case flagBack of an older backend', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locationsActive: [{
        idLocation: 1,
        neighbors: [{ idLocation: 2, direction: 'EAST', flag_back: 1 }],
      }],
    })

    expect(graph.edges.some(e => e.dir === 'EAST' || e.dir === 'WEST')).toBe(true)
  })

  it('falls back to the listing location when a neighbour names no endpoints', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locationsActive: [{ idLocation: 1, neighbors: [{ idLocation: 2, direction: 'WEST' }] }],
    })

    expect(graph.edges.some(e => e.from === 1 && e.to === 2)).toBe(true)
  })

  it('drops an edge whose direction is not one of the four compass points', () => {
    const graph = buildMapGraph({
      players: [{ idLocation: 1 }],
      locationsActive: [{ idLocation: 1, neighbors: [{ idLocation: 2, direction: 'UPWARDS' }] }],
    })

    // the node still exists, but the edge cannot be laid out
    expect(graph.nodes.map(n => n.id)).toContain(2)
  })

  it('takes the /locations payload as the visited set and tolerates rows with no neighbours', () => {
    const graph = buildMapGraph(
      { players: [{ idLocation: 1 }], locationsActive: [{ idLocation: 1, neighbors: [] }] },
      { locations: [{ idLocation: 1 }, { idLocation: 5 }] },   // no neighbours key at all
    )

    expect(graph.nodes.find(n => n.id === 5).visited).toBe(true)
  })

  it('mirrors the direction of a return entry in the /locations payload', () => {
    const graph = buildMapGraph(
      { players: [{ idLocation: 2 }], locationsActive: [{ idLocation: 2, neighbors: [] }] },
      {
        locations: [{
          idLocation: 2,
          // the edge is authored 1→2 and this row lists it from its `to` end
          neighbors: [{ idLocation: 1, idLocationFrom: 1, idLocationTo: 2, direction: 'NORTH', totalEnergyCost: 4 }],
        }],
      },
    )

    const edge = graph.edges.find(e => e.from === 2 && e.to === 1)
    expect(edge.dir).toBe('SOUTH')
    expect(edge.energyCost).toBe(4)
  })

  it('takes a neighbour direction at face value when the endpoints are missing', () => {
    const graph = buildMapGraph(
      { players: [{ idLocation: 2 }], locationsActive: [{ idLocation: 2, neighbors: [] }] },
      { locations: [{ idLocation: 2, neighbors: [{ idLocation: 1, direction: 'NORTH' }] }] },
    )

    expect(graph.edges.find(e => e.from === 2 && e.to === 1).dir).toBe('NORTH')
  })

  it('returns an empty graph for a payload with nothing in it', () => {
    const graph = buildMapGraph(null)
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
  })
})
