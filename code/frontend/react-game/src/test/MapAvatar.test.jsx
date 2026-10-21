import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// v1.4.0 — a Google user is marked on the map by its round picture, else the street-view glyph.

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
const ctx = vi.hoisted(() => ({ value: {} }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))

import MapPage from '../components/layout/Map'

const GAME_DATA = {
  info: {
    players: [{ idLocation: 1 }],
    locations: [{ idLocation: 1, flagAlreadyActived: 1, clockCounter: 0 }],
    locationsActive: [{ idLocation: 1, uuid: 'l1', card: { title: 'Home' } }],
    locationNeighbors: [],
  },
}

function legendHere(container) {
  return [...container.querySelectorAll('.game-map-legend span')].find(s => s.textContent.includes('game.map.youAreHere'))
}

describe('Map — the player marker (v1.4.0)', () => {
  it('a Google user: its picture in the marker and in the legend, the glyph when it fails', () => {
    ctx.value = { isGoogleUser: true, user: { pictureUrl: 'p.png' } }
    const { container } = render(<MapPage gameData={GAME_DATA} matchLocations={[]} />)
    const img = screen.getByTestId('map-here-marker').querySelector('img.game-map-avatar')
    expect(img.getAttribute('src')).toBe('p.png')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(legendHere(container).querySelector('img.game-map-avatar--legend')).toBeTruthy()
    fireEvent.error(img)
    expect(screen.getByTestId('map-here-marker').querySelector('.fa-street-view')).toBeTruthy()
  })

  it('a guest, or a Google user without a picture, keeps the street-view glyph', () => {
    ctx.value = { isGoogleUser: false, user: { pictureUrl: 'p.png' } }
    const { container, unmount } = render(<MapPage gameData={GAME_DATA} matchLocations={[]} />)
    expect(screen.getByTestId('map-here-marker').querySelector('img')).toBeNull()
    expect(legendHere(container).querySelector('.fa-street-view')).toBeTruthy()
    unmount()
    ctx.value = { isGoogleUser: true, user: {} }
    render(<MapPage gameData={GAME_DATA} matchLocations={[]} />)
    expect(screen.getByTestId('map-here-marker').querySelector('.fa-street-view')).toBeTruthy()
  })

  it('no session context at all (outside the provider) keeps the glyph', () => {
    ctx.value = undefined
    render(<MapPage gameData={GAME_DATA} matchLocations={[]} />)
    expect(screen.getByTestId('map-here-marker').querySelector('.fa-street-view')).toBeTruthy()
  })
})
