import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import MapPage from '../components/layout/Map'

/* Board fixture: player on 1 (active, photo); 3 visited (link photo);
   5 never visited (one-way 5→1: fully hidden); 6 never visited (one-way 1→6:
   visible arrow into the unknown); 1→3 two-way (big exit arrow).
   v0.28.6 — locations[] is the VISITED set (no `name`), so 5 and 6 are absent
   from it and reach the map only as edge endpoints. */
const GAME_DATA = {
  info: {
    players: [{ idLocation: 1 }],
    locations: [
      { idLocation: 1, flagAlreadyActived: 1, clockCounter: 0 },
      { idLocation: 3, flagAlreadyActived: 1, clockCounter: 0 },
    ],
    locationsActive: [
      {
        idLocation: 1, uuid: 'l1',
        safe: true,
        card: { title: 'Start location', urlImage: 'http://img/start.jpg' },
        neighbors: [
          { uuid: 'n1', idLocationFrom: 1, idLocationTo: 3, direction: 'NORTH', flagBack: 1,
            card: { title: 'Go north', urlImage: 'http://img/link3.jpg' } },
          { uuid: 'n2', idLocationFrom: 5, idLocationTo: 1, direction: 'NORTH', flagBack: 0,
            card: { title: 'Strange path' } },
          { uuid: 'n3', idLocationFrom: 1, idLocationTo: 6, direction: 'WEST', flagBack: 0,
            card: { title: 'Into the dark' } },
        ],
      },
    ],
  },
}

describe('MapPage', () => {
  it('renders the map page with title and legend (no path entries)', () => {
    render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    expect(screen.getByText('game.map.title')).toBeInTheDocument()
    expect(screen.getByText('game.map.here')).toBeInTheDocument()
    expect(screen.getByText('game.map.youAreHere')).toBeInTheDocument()
    expect(screen.getByText('game.map.safe')).toBeInTheDocument()
    expect(screen.getByText('game.map.unexplored')).toBeInTheDocument()
    expect(screen.queryByText('game.map.twoWay')).toBeNull()
    expect(screen.queryByText('game.map.oneWay')).toBeNull()
  })

  it('clicking an explored node or an unexplored neighbor selects it; a far "?" is inert', () => {
    const onSelectNode = vi.fn()
    // node 7 is unexplored AND does not border the current location (edge 3→7
    // comes from the /locations payload): nothing to show → stays inert.
    const matchLocations = {
      locations: [
        { idLocation: 3, neighbors: [{ idLocation: 7, direction: 'NORTH', totalEnergyCost: 2 }] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations}
      onSelectNode={onSelectNode} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('map-node-3'))
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    // unexplored "?" bordering the current location: selected too (the right
    // page shows its neighbor/movement card)
    fireEvent.click(screen.getByTestId('map-node-6'))
    expect(onSelectNode).toHaveBeenCalledTimes(2)
    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 6, visited: false }))
    fireEvent.click(screen.getByTestId('map-node-7'))
    expect(onSelectNode).toHaveBeenCalledTimes(2) // far unexplored: no selection
  })

  it('the gold ring follows selectedId and defaults to the character location', () => {
    const { rerender } = render(<MapPage gameData={GAME_DATA} selectedId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-1').className).toContain('game-map-node--current')
    rerender(<MapPage gameData={GAME_DATA} selectedId={3} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-3').className).toContain('game-map-node--current')
    expect(screen.getByTestId('map-node-1').className).not.toContain('game-map-node--current')
    // the "you are here" marker stays on the character node
    expect(screen.getByTestId('map-node-1').contains(screen.getByTestId('map-here-marker'))).toBe(true)
  })

  it('a drag does not select the node under the pointer', () => {
    const onSelectNode = vi.fn()
    render(<MapPage gameData={GAME_DATA} onSelectNode={onSelectNode} onClose={vi.fn()} />)
    const canvas = screen.getByTestId('game-map-canvas')
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 })
    fireEvent.pointerUp(canvas)
    fireEvent.click(screen.getByTestId('map-node-3'))
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it('shows the "you are here" marker on the character location node', () => {
    render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const marker = screen.getByTestId('map-here-marker')
    expect(screen.getByTestId('map-node-1').contains(marker)).toBe(true)
  })

  it('adds green-border safe class only on locations flagged as safe', () => {
    const matchLocations = {
      locations: [
        { idLocation: 1, safe: true, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 4 }] },
        { idLocation: 3, safe: false, neighbors: [] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-1').className).toContain('game-map-node--safe')
    expect(screen.getByTestId('map-node-3').className).not.toContain('game-map-node--safe')
  })

  it('unions the visited sets of the /locations payload and /info (v0.28.6)', () => {
    // Both payloads project the same visited set, so /info.locations is
    // authoritative too: 3 stays explored even though this (stale) /locations
    // payload has not caught up with it yet.
    const matchLocations = {
      locations: [
        { idLocation: 1, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 4 }] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-3').className).not.toContain('game-map-node--unknown')
    expect(screen.getByTestId('map-node-1').className).not.toContain('game-map-node--unknown')
    // 5 is in neither visited payload → still an unexplored "?" node
    expect(screen.getByTestId('map-node-5').className).toContain('game-map-node--unknown')
  })

  it('renders one node per location with current/unknown modifiers', () => {
    render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-1').className).toContain('game-map-node--current')
    expect(screen.getByTestId('map-node-3').className).not.toContain('game-map-node--unknown')
    expect(screen.getByTestId('map-node-5').className).toContain('game-map-node--unknown')
  })

  it('marks only the far "?" (not bordering the player) with the --far modifier', () => {
    // node 7 is unexplored and reached only through visited location 3: no
    // dashed ring. Nodes 5/6 are unexplored but border the player → ring kept.
    const matchLocations = {
      locations: [
        { idLocation: 3, neighbors: [{ idLocation: 7, direction: 'NORTH', totalEnergyCost: 2 }] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-7').className).toContain('game-map-node--far')
    expect(screen.getByTestId('map-node-7').className).toContain('game-map-node--unknown')
    expect(screen.getByTestId('map-node-5').className).not.toContain('game-map-node--far')
    expect(screen.getByTestId('map-node-6').className).not.toContain('game-map-node--far')
    // visited nodes never carry it
    expect(screen.getByTestId('map-node-1').className).not.toContain('game-map-node--far')
  })

  it('shows the LOCATION card photo on visited nodes (not the neighbor-link card)', () => {
    // Step 0.28.5 — photos come from the /locations payload location cards.
    const matchLocations = {
      locations: [
        { idLocation: 1, uuid: 'l1',
          card: { uuid: 'c1', title: 'Start', urlImage: 'http://loc/1.jpg' },
          neighbors: [
            { idLocation: 3, uuid: 'l3', direction: 'NORTH', totalEnergyCost: 2,
              idCard: 30, card: { uuid: 'c3', title: 'Center', urlImage: 'http://loc/3.jpg' } },
          ] },
        { idLocation: 3, uuid: 'l3',
          card: { uuid: 'c3', title: 'Center', urlImage: 'http://loc/3.jpg' },
          neighbors: [] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-1').style.backgroundImage).toContain('http://loc/1.jpg')
    expect(screen.getByTestId('map-node-3').style.backgroundImage).toContain('http://loc/3.jpg')
    // the neighbor-LINK photo is never used
    expect(screen.getByTestId('map-node-3').style.backgroundImage).not.toContain('link3.jpg')
    expect(screen.getByTestId('map-node-5').title).toBe('game.map.unexplored')
    expect(screen.getByTestId('map-node-5').style.backgroundImage).toBe('')
  })

  it('hides arrows leaving an unexplored location, keeps the visited→unknown one', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const lines = container.querySelectorAll('line.game-map-edge')
    // 1→3 (two-way, exit) + 1→6 (one-way into the dark) — 5→1 fully hidden
    expect(lines).toHaveLength(2)
    const oneway = container.querySelectorAll('line.game-map-edge--oneway')
    expect(oneway).toHaveLength(1)
  })

  it('draws the big arrow on the exits from the current location', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const big = container.querySelectorAll('polygon.game-map-arrow--big')
    expect(big.length).toBe(2) // 1→3 and 1→6 both leave the current location
    // the heads are geometry in graph coordinates, not <marker> defs (mobile drops those)
    expect(container.querySelectorAll('marker')).toHaveLength(0)
    expect(big[0].getAttribute('points').split(' ')).toHaveLength(3)
  })

  it('calls onClose from the back arrow', () => {
    const onClose = vi.fn()
    render(<MapPage gameData={GAME_DATA} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'card.back' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('zoom controls update the world transform', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const world = container.querySelector('.game-map-world')
    const before = world.style.transform
    fireEvent.click(screen.getByTitle('game.map.zoomIn'))
    expect(world.style.transform).not.toBe(before)
    fireEvent.click(screen.getByTitle('game.map.zoomOut'))
    fireEvent.click(screen.getByTitle('game.map.center'))
    expect(world.style.transform).toMatch(/translate\(.+\) scale\(.+\)/)
  })

  it('drag pans the world', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const canvas = screen.getByTestId('game-map-canvas')
    const world = container.querySelector('.game-map-world')
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 60 })
    fireEvent.pointerUp(canvas)
    expect(world.style.transform).toMatch(/translate\(/)
  })

  it('renders an empty map without crashing when info is missing', () => {
    render(<MapPage gameData={{}} onClose={vi.fn()} />)
    expect(screen.getByTestId('game-map-canvas')).toBeInTheDocument()
  })

  it('wheel zooms the world in and out', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const canvas = screen.getByTestId('game-map-canvas')
    const world = container.querySelector('.game-map-world')
    const before = world.style.transform
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 50, clientY: 50 })
    expect(world.style.transform).not.toBe(before)
    fireEvent.wheel(canvas, { deltaY: 100, clientX: 50, clientY: 50 })
    expect(world.style.transform).toMatch(/scale\(/)
  })

  it('draws a single big arrow toward the current location on a two-way link whose far end is unexplored', () => {
    // 5→1 two-way, 5 never visited: only the 1→5 direction is visible and it
    // is an exit from the current location → one big arrow, no small ones.
    const data = JSON.parse(JSON.stringify(GAME_DATA))
    data.info.locationsActive[0].neighbors = [
      { uuid: 'n2', idLocationFrom: 5, idLocationTo: 1, direction: 'NORTH', flagBack: 1,
        card: { title: 'Strange path' } },
    ]
    const { container } = render(<MapPage gameData={data} onClose={vi.fn()} />)
    const lines = container.querySelectorAll('line.game-map-edge')
    expect(lines).toHaveLength(1)
    const heads = container.querySelectorAll('polygon.game-map-arrow')
    expect(heads).toHaveLength(1)
    expect(heads[0].classList.contains('game-map-arrow--big')).toBe(true)
  })

  it('pushes each arrowhead a few px past its line end, outward toward the node', () => {
    const { container } = render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    const group = container.querySelector('.game-map-svg g g')
    const line = group.querySelector('line')
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(k => Number(line.getAttribute(k)))
    const [tip] = group.querySelector('polygon').getAttribute('points').split(' ')
    const [tx, ty] = tip.split(',').map(Number)
    const len = Math.hypot(x2 - x1, y2 - y1)
    // the tip lies ON the line's direction, just beyond its end point
    expect(Math.hypot(tx - x1, ty - y1)).toBeCloseTo(len + 3, 5)
    expect((tx - x1) * (y2 - y1) - (ty - y1) * (x2 - x1)).toBeCloseTo(0, 5)
  })

  it('sends the two heads of a two-way edge in opposite directions', () => {
    // a two-way link between two visited locations, neither of them the current
    // one, keeps a head at each end
    const data = JSON.parse(JSON.stringify(GAME_DATA))
    data.info.locations.push({ idLocation: 4, flagAlreadyActived: 1, clockCounter: 0 })
    data.info.locationsActive[0].neighbors = [
      { uuid: 'n4', idLocationFrom: 3, idLocationTo: 4, direction: 'NORTH', flagBack: 1 },
    ]
    const { container } = render(<MapPage gameData={data} onClose={vi.fn()} />)
    const group = container.querySelector('.game-map-svg g g')
    const line = group.querySelector('line')
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(k => Number(line.getAttribute(k)))
    const tips = [...group.querySelectorAll('polygon')].map(p => {
      const [tip] = p.getAttribute('points').split(' ')
      return tip.split(',').map(Number)
    })
    expect(tips).toHaveLength(2)
    // each tip overshoots its own end, so the pair is farther apart than the line
    const span = Math.hypot(tips[0][0] - tips[1][0], tips[0][1] - tips[1][1])
    expect(span).toBeCloseTo(Math.hypot(x2 - x1, y2 - y1) + 6, 5)
  })
})
