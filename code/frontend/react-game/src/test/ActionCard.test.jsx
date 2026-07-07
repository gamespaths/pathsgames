import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, entityType, flagInformationCard } = props
    return (
      <div data-testid="action-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="entity-type">{entityType}</span>
        <span data-testid="info-flag">{String(!!flagInformationCard)}</span>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
      </div>
    )
  },
}))

import ActionCard from '../features/gameplay/cards/ActionCard'

const STORY = { uuid: 's1', title: 'Story' }
const ACTION = { uuid: 'a1', name: 'Search', card: { title: 'Search the room', description: 'Look around' } }

describe('ActionCard', () => {
  beforeEach(() => {
    capturedProps = null
  })

  it('renders the action card as an information card with entityType "action" and no label prop', () => {
    render(<ActionCard action={ACTION} story={STORY} onPreview={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('Search the room')
    expect(screen.getByTestId('entity-type').textContent).toBe('action')
    expect(screen.getByTestId('info-flag').textContent).toBe('true')
    // Convention: never pass `label` to Card; the name comes from card.title.
    expect(capturedProps.label).toBeUndefined()
  })

  it('falls back to a card built from action fields when action.card is missing', () => {
    const action = { uuid: 'a2', name: 'Rest', description: 'Take a breath', awesomeIcon: 'fa-bed' }
    render(<ActionCard action={action} story={STORY} onPreview={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('Rest')
  })

  it('opens the preview routed to the given side with type "action" (7th arg = previewSide)', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview} previewSide="right" />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview).toHaveBeenCalledWith(ACTION.card, 'action', null, [], true, {}, 'right')
  })

  it('defaults previewSide to left when not provided', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][6]).toBe('left')
  })

  it('passes a null card to onPreview when the action has no card', () => {
    const onPreview = vi.fn()
    const action = { uuid: 'a3', name: 'Wait' }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0]).toBeNull()
  })
})
