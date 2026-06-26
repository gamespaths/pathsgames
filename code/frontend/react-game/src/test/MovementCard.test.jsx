import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))
vi.mock('@/components/ui/BonusBadgeList', () => ({
  default: ({ items }) => (
    <div data-testid="bonus-badge-list">
      {items?.map(i => <span key={i.key} data-testid={`badge-${i.key}`}>{i.value}</span>)}
    </div>
  ),
}))
vi.mock('@/api/matches', () => ({
  startMovement: vi.fn(() => Promise.resolve({ ok: true, toLocationId: 2 })),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, onAction, actionLabel, locked, lockInfo, childrenIntoImage } = props
    return (
      <div data-testid="movement-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="locked">{String(!!locked)}</span>
        {lockInfo && <span data-testid="lock-info">{lockInfo}</span>}
        {childrenIntoImage && <div data-testid="children-into-image">{childrenIntoImage}</div>}
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onAction && <button data-testid="action-btn" onClick={onAction}>{actionLabel}</button>}
      </div>
    )
  },
}))

import MovementCard from '../features/gameplay/cards/MovementCard'
import { startMovement } from '../api/matches'

const STORY = { uuid: 's1', title: 'Story' }
const LOCATION = {
  uuid: 'loc-2', idLocation: 2, name: 'Movement Room', direction: 'NORTH',
  energyCost: 1, card: { title: 'Movement Room', description: 'A room' },
}

describe('MovementCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedProps = null
  })

  it('renders the neighbor card with no label prop', () => {
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('Movement Room')
    // Convention: never pass `label` to Card; the name comes from card.title.
    expect(capturedProps.label).toBeUndefined()
  })

  it('shows the total energy cost badge', () => {
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    expect(screen.getByTestId('badge-energy').textContent).toBe('4')
  })

  it('calls startMovement with the location uuid and reloads', async () => {
    const onMoved = vi.fn()
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={onMoved} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(startMovement).toHaveBeenCalledWith('m1', 'loc-2', 'tok'))
    await waitFor(() => expect(onMoved).toHaveBeenCalled())
  })

  it('locks the card and shows lockInfo when energy is insufficient', () => {
    render(<MovementCard location={LOCATION} totalEnergyCost={50}
      playerStats={{ energy: 5 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info')).toBeInTheDocument()
    // No action button when locked.
    expect(screen.queryByTestId('action-btn')).toBeNull()
  })

  it('falls back to base energyCost when totalEnergyCost is undefined', () => {
    render(<MovementCard location={LOCATION} totalEnergyCost={undefined}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    expect(screen.getByTestId('badge-energy').textContent).toBe('1')
  })

  it('calls onError when startMovement fails (surfaces the error instead of failing silently)', async () => {
    const onError = vi.fn()
    const onMoved = vi.fn()
    const err = new Error('boom')
    startMovement.mockRejectedValueOnce(err)
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={onMoved} onError={onError} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(onError).toHaveBeenCalledWith(err))
    expect(onMoved).not.toHaveBeenCalled()
  })

  it('does not move when location uuid is missing', async () => {
    render(<MovementCard location={{ ...LOCATION, uuid: null }} totalEnergyCost={1}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(startMovement).not.toHaveBeenCalled())
  })

  it('opens preview with movement details', () => {
    const onPreview = vi.fn()
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview).toHaveBeenCalled()
  })

  it('handles a movement error gracefully', async () => {
    startMovement.mockRejectedValueOnce(new Error('boom'))
    const onMoved = vi.fn()
    render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={onMoved} />)
    fireEvent.click(screen.getByTestId('action-btn'))
    await waitFor(() => expect(startMovement).toHaveBeenCalled())
    expect(onMoved).not.toHaveBeenCalled()
  })
})
