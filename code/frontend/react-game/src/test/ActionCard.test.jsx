import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

const executeEvent = vi.fn()
vi.mock('@/api/matches', () => ({
  executeEvent: (...args) => executeEvent(...args),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, onAction, entityType, flagInformationCard, locked, lockInfo } = props
    return (
      <div data-testid="action-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="entity-type">{entityType}</span>
        <span data-testid="info-flag">{String(!!flagInformationCard)}</span>
        <span data-testid="locked">{String(!!locked)}</span>
        <span data-testid="lock-info">{lockInfo ?? ''}</span>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onAction && <button data-testid="action-btn" onClick={onAction}>do</button>}
      </div>
    )
  },
}))

import ActionCard from '../features/gameplay/cards/ActionCard'

const STORY = { uuid: 's1', title: 'Story' }
/** An event the backend says the player can trigger. */
const ACTION = {
  uuid: 'a1', name: 'Search', available: true, reason: null,
  card: { title: 'Search the room', description: 'Look around' },
}

describe('ActionCard', () => {
  beforeEach(() => {
    capturedProps = null
    executeEvent.mockReset()
    executeEvent.mockResolvedValue({ refreshRecommended: true })
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
    expect(onPreview.mock.calls[0][0]).toEqual(ACTION.card)
    expect(onPreview.mock.calls[0][1]).toBe('action')
    expect(onPreview.mock.calls[0][6]).toBe('right')
  })

  it('defaults previewSide to left when not provided', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][6]).toBe('left')
  })

  it('passes a null card to onPreview when the action has no card', () => {
    const onPreview = vi.fn()
    const action = { uuid: 'a3', name: 'Wait', available: true }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0]).toBeNull()
  })

  /* ── Step 29 — execution and the backend's availability verdict ─────────── */

  // The card itself no longer carries the action button: an available event hands its
  // `onAction` to the preview (through additionalProps), and the player triggers it there.
  function triggerFromPreview(onPreview) {
    fireEvent.click(screen.getByTestId('preview-btn'))
    const [[, , , , , additionalProps]] = onPreview.mock.calls
    return additionalProps.onAction()
  }

  it('executes the event and hands the result to onDone', async () => {
    const onDone = vi.fn()
    const onPreview = vi.fn()
    const result = { eventUuid: 'a1', refreshRecommended: true }
    executeEvent.mockResolvedValue(result)

    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onDone={onDone} />)
    triggerFromPreview(onPreview)

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(result))
    expect(executeEvent).toHaveBeenCalledWith('m1', 'a1', 'tok')
  })

  it('surfaces a failure through onError instead of failing silently', async () => {
    const onError = vi.fn()
    const boom = new Error('nope')
    executeEvent.mockRejectedValue(boom)

    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onError={onError} />)
    triggerFromPreview(onPreview)

    await waitFor(() => expect(onError).toHaveBeenCalledWith(boom))
  })

  it('renders locked with the translated reason when the backend says unavailable', () => {
    const action = { ...ACTION, available: false, reason: 'NOT_ENOUGH_ENERGY' }
    render(<ActionCard action={action} story={STORY} onPreview={vi.fn()} matchUuid="m1" />)

    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info').textContent).toBe('game.event.reason.NOT_ENOUGH_ENERGY')
    // Locked means no way to fire it.
    expect(screen.queryByTestId('action-btn')).toBeNull()
    // The hint travels as lockInfo, never as label (CardButtons would fall back to the name).
    expect(capturedProps.label).toBeUndefined()
  })

  it('treats a missing available flag as not executable rather than assuming it works', () => {
    const action = { uuid: 'a9', name: 'Legacy', card: { title: 'Legacy' } }
    render(<ActionCard action={action} story={STORY} onPreview={vi.fn()} matchUuid="m1" />)

    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info').textContent).toBe('game.event.blocked')
    expect(screen.queryByTestId('action-btn')).toBeNull()
  })
})
