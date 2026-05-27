import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SelectionView from '../features/game/SelectionView'

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
      <button onClick={onAction}>{`modal-action-${card.name}`}</button>
    </div>
  ),
}))

describe('SelectionView — type="location"', () => {
  const mockLocations = [
    { uuid: 'loc-1', name: 'Location 1', awesomeIcon: 'fas fa-map' },
    { uuid: 'loc-2', name: 'Location 2' },
    { uuid: '!!!',   name: 'Location 3' },
  ]

  it('renders the moveTo header and all location cards', () => {
    render(<SelectionView type="location" options={mockLocations} />)

    expect(screen.getByText('game.moveTo')).toBeInTheDocument()
    expect(screen.getAllByText('Location 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Location 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Location 3').length).toBeGreaterThan(0)
  })

  it('renders nothing — no header, no cards — when there are no locations', () => {
    const { container } = render(<SelectionView type="location" options={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('game.moveTo')).toBeNull()
  })

  it('uses the move label on every card footer', () => {
    render(<SelectionView type="location" options={mockLocations} />)
    expect(screen.getAllByText('game.move').length).toBeGreaterThanOrEqual(mockLocations.length)
  })

  it('renders a CardDetailModal per location with a sanitized modalId', () => {
    render(<SelectionView type="location" options={mockLocations} />)
    expect(document.getElementById('neighbor-modal-loc-1')).not.toBeNull()
    expect(document.getElementById('neighbor-modal-loc-2')).not.toBeNull()
    // bad uuid → index fallback (2)
    expect(document.getElementById('neighbor-modal-2')).not.toBeNull()
  })

  it('fires the move alert when the footer button is clicked', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<SelectionView type="location" options={mockLocations} />)

    const firstCell = container.querySelectorAll('.game-card-cell')[0]
    fireEvent.click(within(firstCell).getAllByText('game.move')[0])

    expect(alertSpy).toHaveBeenCalledWith('Executing action: Move to - Location 1')
    alertSpy.mockRestore()
  })

  it('fires the same move alert when the modal action button is clicked', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<SelectionView type="location" options={mockLocations} />)

    fireEvent.click(screen.getByText('modal-action-Location 2'))
    expect(alertSpy).toHaveBeenCalledWith('Executing action: Move to - Location 2')
    alertSpy.mockRestore()
  })
})

describe('SelectionView — type="action"', () => {
  const mockActions = [
    { uuid: 'uuid-1', name: 'Action 1', awesomeIcon: 'fas fa-test' },
    { uuid: 'uuid-2!@#', name: 'Action 2', awesomeIcon: 'fas fa-cog' },
    { uuid: 'uuid-end', uuidEvent: 'evt-end', name: 'Finish Quest', awesomeIcon: 'fas fa-flag', endGame: true },
  ]

  it('renders the actions header and every action card', () => {
    render(<SelectionView type="action" options={mockActions} />)

    expect(screen.getByText('game.actions')).toBeInTheDocument()
    expect(screen.getAllByText('Action 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Finish Quest').length).toBeGreaterThan(0)
  })

  it('renders the execute label on normal actions and end-game label on endGame actions', () => {
    const { container } = render(<SelectionView type="action" options={mockActions} />)
    const cells = container.querySelectorAll('.game-card-cell')

    expect(within(cells[0]).getAllByText('game.execute').length).toBeGreaterThan(0)
    expect(within(cells[2]).getAllByText('game.endGame').length).toBeGreaterThan(0)
  })

  it('renders a CardDetailModal per action with a sanitized modalId', () => {
    render(<SelectionView type="action" options={mockActions} />)
    expect(document.getElementById('action-modal-uuid-1')).not.toBeNull()
    expect(document.getElementById('action-modal-uuid-2')).not.toBeNull()
    expect(document.getElementById('action-modal-uuid-end')).not.toBeNull()
  })

  it('fires the execute alert for a normal action', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<SelectionView type="action" options={mockActions} onEndGame={vi.fn()} />)

    const firstCell = container.querySelectorAll('.game-card-cell')[0]
    fireEvent.click(within(firstCell).getAllByText('game.execute')[0])

    expect(alertSpy).toHaveBeenCalledWith('Executing action: Execute - Action 1')
    alertSpy.mockRestore()
  })

  it('calls onEndGame and does NOT fire the execute alert for an endGame action', () => {
    const onEndGame = vi.fn()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    const { container } = render(<SelectionView type="action" options={mockActions} onEndGame={onEndGame} />)

    const endCell = container.querySelectorAll('.game-card-cell')[2]
    fireEvent.click(within(endCell).getAllByText('game.endGame')[0])

    expect(onEndGame).toHaveBeenCalledTimes(1)
    expect(onEndGame.mock.calls[0][0]).toMatchObject({
      uuid: 'uuid-end',
      uuidEvent: 'evt-end',
      endGame: true,
    })
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('routes the modal action button through the end-game callback', () => {
    const onEndGame = vi.fn()
    render(<SelectionView type="action" options={mockActions} onEndGame={onEndGame} />)

    fireEvent.click(screen.getByText('modal-action-Finish Quest'))
    expect(onEndGame).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when there are no actions', () => {
    const { container } = render(<SelectionView type="action" options={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
