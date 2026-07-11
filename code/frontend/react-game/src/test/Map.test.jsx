import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

import MapPage from '../components/layout/Map'

/* Board fixture: player on 1 (active, photo); 3 visited via flag (link photo);
   5 never visited (one-way 5→1: fully hidden); 6 never visited (one-way 1→6:
   visible arrow into the unknown); 1→3 two-way (big exit arrow). */
const GAME_DATA = {
  info: {
    players: [{ idLocation: 1 }],
    locations: [
      { idLocation: 1, flagAlreadyActived: 1, name: 'Start' },
      { idLocation: 3, flagAlreadyActived: 1, name: 'Center' },
      { idLocation: 5, flagAlreadyActived: 0, name: 'Secret' },
    ],
    locationsActive: [
      {
        idLocation: 1, uuid: 'l1',
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
    expect(screen.getByText('game.map.unexplored')).toBeInTheDocument()
    expect(screen.queryByText('game.map.twoWay')).toBeNull()
    expect(screen.queryByText('game.map.oneWay')).toBeNull()
  })

  it('clicking an explored node selects it; unexplored nodes are inert', () => {
    const onSelectNode = vi.fn()
    render(<MapPage gameData={GAME_DATA} onSelectNode={onSelectNode} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('map-node-3'))
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    fireEvent.click(screen.getByTestId('map-node-5'))
    expect(onSelectNode).toHaveBeenCalledTimes(1) // unexplored: no selection
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

  it('takes the visited set from the /locations payload when provided', () => {
    // the payload (the authority) lists only location 1 as visited → 3 becomes
    // an unexplored "?" node even though flagAlreadyActived says otherwise
    const matchLocations = {
      locations: [
        { idLocation: 1, neighbors: [{ idLocation: 3, direction: 'NORTH', totalEnergyCost: 4 }] },
      ],
    }
    render(<MapPage gameData={GAME_DATA} matchLocations={matchLocations} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-3').className).toContain('game-map-node--unknown')
    expect(screen.getByTestId('map-node-1').className).not.toContain('game-map-node--unknown')
  })

  it('renders one node per location with current/unknown modifiers', () => {
    render(<MapPage gameData={GAME_DATA} onClose={vi.fn()} />)
    expect(screen.getByTestId('map-node-1').className).toContain('game-map-node--current')
    expect(screen.getByTestId('map-node-3').className).not.toContain('game-map-node--unknown')
    expect(screen.getByTestId('map-node-5').className).toContain('game-map-node--unknown')
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
    const big = [...container.querySelectorAll('line')].filter(
      l => l.getAttribute('marker-end') === 'url(#gameMapArrBig)')
    expect(big.length).toBe(2) // 1→3 and 1→6 both leave the current location
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
    expect(lines[0].getAttribute('marker-end')).toBe('url(#gameMapArrBig)')
    expect(lines[0].getAttribute('marker-start')).toBeNull()
  })
})
