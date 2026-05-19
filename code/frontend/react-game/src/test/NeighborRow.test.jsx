import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NeighborRow from '../features/game/NeighborRow'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

vi.mock('../features/game/CardDetailModal', () => ({
  default: ({ card, modalId, actionLabel, onAction }) => (
    <div data-testid="mock-modal" id={modalId}>
      <span>{card.name}</span>
      <span>{actionLabel}</span>
      <button onClick={onAction}>Move</button>
    </div>
  )
}))

describe('NeighborRow', () => {
  const mockLocations = [
    { uuid: 'loc-1', name: 'Location 1', urlImage: '/path/to/img.png', awesomeIcon: 'fas fa-map' },
    { uuid: 'loc-2', name: 'Location 2', urlImage: 'https://example.com/img.jpg' },
    { uuid: 'loc-3', name: 'Location 3', urlImage: 'invalid-url', awesomeIcon: 'fas fa-home' },
    { uuid: 'loc-4', name: 'Location 4', urlImage: 'sftp://insecure.com', awesomeIcon: 'fas fa-mosque' },
    { uuid: '!!!', name: 'Location 5', urlImage: '   ', awesomeIcon: '   ' },
    { uuid: null, name: 'Location 6', urlImage: '' }
  ]

  it('renders locations correctly', () => {
    render(<NeighborRow locations={mockLocations} />)

    expect(screen.getByText('game.moveTo')).toBeDefined()
    expect(screen.getAllByText('Location 1')[0]).toBeDefined()
    expect(screen.getAllByText('Location 2')[0]).toBeDefined()
    expect(screen.getAllByText('Location 3')[0]).toBeDefined()
    expect(screen.getAllByText('Location 4')[0]).toBeDefined()
    expect(screen.getAllByText('Location 5')[0]).toBeDefined()
    expect(screen.getAllByText('Location 6')[0]).toBeDefined()
  })

  it('handles image URLs correctly', () => {
    const { container } = render(<NeighborRow locations={mockLocations} />)

    // Location 1: /path/to/img.png (valid relative)
    const img1 = container.querySelector('.game-cards-row > div:nth-child(1) .game-card img')
    expect(img1.getAttribute('src')).toBe('/path/to/img.png')

    // Location 2: https://example.com/img.jpg (valid absolute)
    const img2 = container.querySelector('.game-cards-row > div:nth-child(2) .game-card img')
    expect(img2.getAttribute('src')).toBe('https://example.com/img.jpg')

    // Location 3: invalid-url -> fallback to icon
    const img3 = container.querySelector('.game-cards-row > div:nth-child(3) .game-card img')
    expect(img3).toBeNull()
    const icon3 = container.querySelector('.game-cards-row > div:nth-child(3) .game-card i')
    expect(icon3.className).toBe('fas fa-home')

    // Location 4: ftp://insecure.com -> fallback to icon
    const img4 = container.querySelector('.game-cards-row > div:nth-child(4) .game-card img')
    expect(img4).toBeNull()
    const icon4 = container.querySelector('.game-cards-row > div:nth-child(4) .game-card i')
    expect(icon4.className).toBe('fas fa-mosque')

    // Location 5: empty string -> fallback to icon
    const icon5 = container.querySelector('.game-cards-row > div:nth-child(5) .game-card i')
    expect(icon5.className).toBe('fas fa-map-marker-alt') // default fallback

    // Location 6: null/empty -> fallback to icon
    const icon6 = container.querySelector('.game-cards-row > div:nth-child(6) .game-card i')
    expect(icon6.className).toBe('fas fa-map-marker-alt') // default fallback
  })

  it('sanitizes modal IDs and icon classes', () => {
    render(<NeighborRow locations={mockLocations} />)
    
    const card2 = screen.getAllByText('Location 2')[0].closest('.game-card')
    expect(card2.getAttribute('data-bs-target')).toBe('#neighbor-modal-loc-2')

    const card5 = screen.getAllByText('Location 5')[0].closest('.game-card')
    expect(card5.getAttribute('data-bs-target')).toBe('#neighbor-modal-4') // index 4 as fallback

    const card6 = screen.getAllByText('Location 6')[0].closest('.game-card')
    expect(card6.getAttribute('data-bs-target')).toBe('#neighbor-modal-5') // index 5 as fallback
  })

  it('sets active location on click and triggers onAction', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<NeighborRow locations={mockLocations} />)

    const card1 = screen.getAllByText('Location 1')[0].closest('.game-card')
    fireEvent.click(card1)

    const moveBtn = screen.getAllByText('Move')[0]
    fireEvent.click(moveBtn)
    expect(alertSpy).toHaveBeenCalledWith('Executing action: Move to - Location 1')
    alertSpy.mockRestore()
  })
})
