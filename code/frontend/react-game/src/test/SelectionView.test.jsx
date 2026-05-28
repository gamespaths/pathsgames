import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SelectionView from '../features/game/SelectionView'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

describe('SelectionView — type="location"', () => {
  const mockLocations = [
    { uuid: 'loc-1', name: 'Location 1', awesomeIcon: 'fas fa-map' },
    { uuid: 'loc-2', name: 'Location 2' },
    { uuid: '!!!',   name: 'Location 3' },
  ]

  it('renders all location cards', () => {
    render(<SelectionView type="location" options={mockLocations} />)

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

  it('calls handleSelectionPreview when info button clicked', () => {
    const onPreview = vi.fn()
    const { container } = render(<SelectionView type="location" options={mockLocations} handleSelectionPreview={onPreview} />)
    const infoBtns = container.querySelectorAll('button[aria-label]')
    expect(infoBtns.length).toBeGreaterThan(0)
    fireEvent.click(infoBtns[0])
    expect(onPreview).toHaveBeenCalledWith(mockLocations[0], 'location')
  })

  it('fires the move alert when the footer button is clicked', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<SelectionView type="location" options={mockLocations} />)

    const firstCell = container.querySelectorAll('.game-card-cell')[0]
    fireEvent.click(within(firstCell).getAllByText('game.move')[0])

    expect(alertSpy).toHaveBeenCalledWith('Executing action: Move to - Location 1')
    alertSpy.mockRestore()
  })

  it('fires move alert when footer button clicked for second location', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<SelectionView type="location" options={mockLocations} />)

    const cells = container.querySelectorAll('.game-card-cell')
    fireEvent.click(within(cells[1]).getAllByText('game.move')[0])
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

  it('renders all action cards', () => {
    render(<SelectionView type="action" options={mockActions} />)

    expect(screen.getAllByText('Action 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Finish Quest').length).toBeGreaterThan(0)
  })

  it('renders the execute label on normal actions and end-game label on endGame actions', () => {
    const { container } = render(<SelectionView type="action" options={mockActions} />)
    const cells = container.querySelectorAll('.game-card-cell')

    expect(within(cells[0]).getAllByText('game.execute').length).toBeGreaterThan(0)
    expect(within(cells[2]).getAllByText('game.endGame').length).toBeGreaterThan(0)
  })

  it('calls handleSelectionPreview for action type', () => {
    const onPreview = vi.fn()
    const { container } = render(<SelectionView type="action" options={mockActions} handleSelectionPreview={onPreview} />)
    const infoBtns = container.querySelectorAll('button[aria-label]')
    expect(infoBtns.length).toBeGreaterThan(0)
    fireEvent.click(infoBtns[0])
    expect(onPreview).toHaveBeenCalledWith(mockActions[0], 'action')
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

  it('renders info button for endGame action and calls handleSelectionPreview', () => {
    const onPreview = vi.fn()
    const { container } = render(<SelectionView type="action" options={mockActions} handleSelectionPreview={onPreview} onEndGame={vi.fn()} />)
    const cells = container.querySelectorAll('.game-card-cell')
    const endCell = cells[2]
    const infoBtn = endCell.querySelector('button[aria-label]')
    expect(infoBtn).not.toBeNull()
    fireEvent.click(infoBtn)
    expect(onPreview).toHaveBeenCalledWith(mockActions[2], 'action')
  })

  it('renders nothing when there are no actions', () => {
    const { container } = render(<SelectionView type="action" options={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
