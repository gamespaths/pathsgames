import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionsRow from '../features/game/ActionsRow'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

// Mock CardDetailModal to avoid portal issues in simple tests if needed, 
// but let's try without first.
vi.mock('../features/game/CardDetailModal', () => ({
  default: ({ card, modalId, actionLabel, onAction }) => (
    <div data-testid="mock-modal" id={modalId}>
      <span>{card.name}</span>
      <span>{actionLabel}</span>
      <button onClick={onAction}>Execute</button>
    </div>
  )
}))

describe('ActionsRow', () => {
  const mockActions = [
    { uuid: 'uuid-1', name: 'Action 1', awesomeIcon: 'fas fa-test' },
    { uuid: 'uuid-2!@#', name: 'Action 2', awesomeIcon: 'invalid!!icon' },
    { uuid: '!!!', name: 'Action 3', awesomeIcon: 123 },
    { uuid: null, name: 'Action 4', awesomeIcon: '' }
  ]

  it('renders actions correctly', () => {
    render(<ActionsRow actions={mockActions} />)

    expect(screen.getByText('game.actions')).toBeDefined()
    expect(screen.getAllByText('Action 1')[0]).toBeDefined()
    expect(screen.getAllByText('Action 2')[0]).toBeDefined()
    expect(screen.getAllByText('Action 3')[0]).toBeDefined()
    expect(screen.getAllByText('Action 4')[0]).toBeDefined()
  })

  it('sanitizes modal IDs correctly', () => {
    render(<ActionsRow actions={mockActions} />)
    
    const card2 = screen.getAllByText('Action 2')[0].closest('.game-card')
    expect(card2.getAttribute('data-bs-target')).toBe('#action-modal-uuid-2')

    const card3 = screen.getAllByText('Action 3')[0].closest('.game-card')
    expect(card3.getAttribute('data-bs-target')).toBe('#action-modal-2')

    const card4 = screen.getAllByText('Action 4')[0].closest('.game-card')
    expect(card4.getAttribute('data-bs-target')).toBe('#action-modal-3')
  })

  it('sanitizes icon classes correctly', () => {
    const { container } = render(<ActionsRow actions={mockActions} />)
    
    const icon1 = container.querySelector('.game-cards-row > div:nth-child(1) .game-card i')
    expect(icon1.className).toBe('fas fa-test')

    const icon2 = container.querySelector('.game-cards-row > div:nth-child(2) .game-card i')
    expect(icon2.className).toBe('fas fa-bolt')

    const icon3 = container.querySelector('.game-cards-row > div:nth-child(3) .game-card i')
    expect(icon3.className).toBe('fas fa-bolt')

    const icon4 = container.querySelector('.game-cards-row > div:nth-child(4) .game-card i')
    expect(icon4.className).toBe('fas fa-bolt')
  })

  it('sets active action on click and triggers onAction', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<ActionsRow actions={mockActions} />)

    const card1 = screen.getAllByText('Action 1')[0].closest('.game-card')
    fireEvent.click(card1)

    const executeBtn = screen.getAllByText('Execute')[0]
    fireEvent.click(executeBtn)
    expect(alertSpy).toHaveBeenCalledWith('Executing action: Execute - Action 1')
    alertSpy.mockRestore()
  })
})
