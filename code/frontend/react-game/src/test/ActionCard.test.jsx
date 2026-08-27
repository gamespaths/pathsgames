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

  it('opens the preview routed to the given side with type "action"', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview} previewSide="right" />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].card).toEqual(ACTION.card)
    expect(onPreview.mock.calls[0][0].type).toBe('action')
    expect(onPreview.mock.calls[0][0].side).toBe('right')
  })

  it('defaults previewSide to left when not provided', () => {
    const onPreview = vi.fn()
    render(<ActionCard action={ACTION} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].side).toBe('left')
  })

  it('passes a null card to onPreview when the action has no card', () => {
    const onPreview = vi.fn()
    const action = { uuid: 'a3', name: 'Wait', available: true }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].card).toBeNull()
  })

  /* ── v0.35.3 — the price of an action, shown before it is paid ───────────── */

  // The badge is a real BonusBadgeList (not mocked), handed to Card as an element. Rendering
  // it on its own is what lets these tests read the numbers the player would see.
  function costBadgeOf(action, onPreview = vi.fn()) {
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} />)
    return capturedProps.childrenIntoImage
  }

  it('badges every resource the action costs, not only energy', () => {
    const action = { ...ACTION, energy: 2, coin: 3, food: 1, magic: 4 }

    const { container } = render(costBadgeOf(action))

    const values = [...container.querySelectorAll('strong')].map(n => n.textContent)
    expect(values).toEqual(['2', '3', '1', '4'])
    // The order is the one the check procedure reads them in, so the badges line up with the
    // refusal the backend would answer with.
    const icons = [...container.querySelectorAll('i')].map(n => n.className)
    expect(icons[1]).toContain('fa-coins')
    expect(icons[2]).toContain('fa-drumstick-bite')
    expect(icons[3]).toContain('fa-magic')
  })

  it('shows only the resources that actually cost something', () => {
    const action = { ...ACTION, energy: 0, coin: 0, food: 2, magic: 0 }

    const { container } = render(costBadgeOf(action))

    const values = [...container.querySelectorAll('strong')].map(n => n.textContent)
    expect(values).toEqual(['2'])
  })

  it('shows no badge at all for a free action', () => {
    const action = { ...ACTION, energy: 0, coin: 0, food: 0, magic: 0 }

    const { container } = render(costBadgeOf(action))

    expect(container.querySelectorAll('strong')).toHaveLength(0)
  })

  it('reads a backend that sends no resource prices as "costs nothing"', () => {
    const { container } = render(costBadgeOf({ ...ACTION, energy: 1 }))

    expect([...container.querySelectorAll('strong')].map(n => n.textContent)).toEqual(['1'])
  })

  it('hands the very same badge to the page preview, available or locked', () => {
    const onPreview = vi.fn()
    const action = { ...ACTION, energy: 2, food: 1 }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    const [[{ props: additionalProps }]] = onPreview.mock.calls
    // Available: the badge rides next to the action label.
    expect(additionalProps.actionLabelChildren).toEqual(capturedProps.childrenIntoImage)

    const blocked = vi.fn()
    render(<ActionCard action={{ ...action, available: false, reason: 'NOT_ENOUGH_FOOD' }}
      story={STORY} onPreview={blocked} />)
    fireEvent.click(screen.getAllByTestId('preview-btn').at(-1))
    // Locked: the price is still shown — knowing what it would have cost is the point.
    expect(blocked.mock.calls[0][0].props.extraContent).toBeTruthy()
  })

  /* ── Step 29 — execution and the backend's availability verdict ─────────── */

  // The card itself no longer carries the action button: an available event hands its
  // `onAction` to the preview (through additionalProps), and the player triggers it there.
  function triggerFromPreview(onPreview) {
    fireEvent.click(screen.getByTestId('preview-btn'))
    const [[{ props: additionalProps }]] = onPreview.mock.calls
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

  // Two registers for one refusal: a word on the card (it lives in a badge), the whole
  // sentence in the preview (which has the room to explain).
  it('shows the short reason on the card and the full sentence in the preview', () => {
    const onPreview = vi.fn()
    const action = { ...ACTION, available: false, reason: 'WEATHER_CONDITION_NOT_MET' }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} matchUuid="m1" />)

    expect(screen.getByTestId('lock-info').textContent)
      .toBe('game.event.reason.WEATHER_CONDITION_NOT_MET')
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].lockedReason)
      .toBe('game.event.reasonFull.WEATHER_CONDITION_NOT_MET')
  })

  // The icon comes from the shared reason→icon table (constants/lockReasons), the same one
  // MovementCard reads — one refusal, one icon, wherever it is rendered.
  it.each([
    ['NOT_ENOUGH_ENERGY', 'fas fa-bed'],
    ['NOT_ENOUGH_COINS', 'fas fa-coins'],
    ['WEATHER_CONDITION_NOT_MET', 'fas fa-cloud-sun'],
    ['ONCE_ALREADY_CONSUMED', 'fas fa-check'],
  ])('%s renders the %s icon', (reason, icon) => {
    render(<ActionCard action={{ ...ACTION, available: false, reason }} story={STORY}
      onPreview={vi.fn()} matchUuid="m1" />)
    expect(capturedProps.lockedIcon).toBe(icon)
  })

  it('falls back to the "you cannot" icon when the backend names no reason', () => {
    render(<ActionCard action={{ uuid: 'a9', name: 'Legacy' }} story={STORY}
      onPreview={vi.fn()} matchUuid="m1" />)
    expect(capturedProps.lockedIcon).toBe('fas fa-ban')
  })

  it('falls back to the long blocked sentence in the preview when no reason is given', () => {
    const onPreview = vi.fn()
    const action = { uuid: 'a9', name: 'Legacy', card: { title: 'Legacy' } }
    render(<ActionCard action={action} story={STORY} onPreview={onPreview} matchUuid="m1" />)

    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][0].lockedReason).toBe('game.event.blockedFull')
  })
})
