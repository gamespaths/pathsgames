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

  /* ── v0.35.3 — a path can charge resources, not only energy ──────────────── */

  it('badges the resources the path costs beside the energy', () => {
    const tolled = { ...LOCATION, costCoin: 2, costFood: 1, costMagic: 3 }

    render(<MovementCard location={tolled} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)

    // Energy is the weather-resolved TOTAL (edge + destination entry + weather); the three
    // resources come from the edge alone, so they are shown exactly as authored.
    expect(screen.getByTestId('badge-energy').textContent).toBe('4')
    expect(screen.getByTestId('badge-coins').textContent).toBe('2')
    expect(screen.getByTestId('badge-food').textContent).toBe('1')
    expect(screen.getByTestId('badge-magic').textContent).toBe('3')
  })

  it('reads a path with no resource price as costing nothing', () => {
    render(<MovementCard location={LOCATION} totalEnergyCost={1}
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)

    // The real BonusBadgeList drops a zero; what matters here is that the card asks for 0
    // rather than for `undefined`, which would render as an empty badge.
    expect(screen.getByTestId('badge-coins').textContent).toBe('0')
    expect(screen.getByTestId('badge-food').textContent).toBe('0')
    expect(screen.getByTestId('badge-magic').textContent).toBe('0')
  })

  it('hands the same price to the little card, the page preview and the map view', () => {
    const tolled = { ...LOCATION, costCoin: 2, costFood: 1, costMagic: 3 }
    const onPreview = vi.fn()

    render(<MovementCard location={tolled} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)

    // little: the badge rides over the image
    expect(screen.getByTestId('children-into-image')).toBeTruthy()
    // page: the same element travels with the preview
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][5].actionLabelChildren)
      .toEqual(capturedProps.childrenIntoImage)

    // map: no overlay on the image, the badge sits next to the action label instead
    render(<MovementCard location={tolled} totalEnergyCost={4} viewFromMap
      playerStats={{ energy: 30 }} story={STORY} onPreview={vi.fn()}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    expect(capturedProps.childrenIntoImage).toBeNull()
    expect(capturedProps.actionLabelChildren).toBeTruthy()
  })

  it('still shows the price when the move is refused', () => {
    // Knowing what it would have cost is half the point of a refusal.
    const tolled = { ...LOCATION, costCoin: 2, available: false, reason: 'NOT_ENOUGH_COINS' }
    const onPreview = vi.fn()

    render(<MovementCard location={tolled} totalEnergyCost={1}
      playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-btn'))

    expect(screen.getByTestId('badge-coins').textContent).toBe('2')
    expect(onPreview.mock.calls[0][5].extraContent).toBeTruthy()
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

  // The `previewSide` prop is forwarded to onPreview as the 7th argument so the
  // GameBook can route the preview to the left or right book page. Defaults left.
  it('forwards previewSide to onPreview (7th arg), defaulting to left', () => {
    const onPreview = vi.fn()
    const { rerender } = render(<MovementCard location={LOCATION} totalEnergyCost={4}
      playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][6]).toBe('left')
    onPreview.mockClear()
    rerender(<MovementCard location={LOCATION} totalEnergyCost={4} previewSide="right"
      playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
      matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    expect(onPreview.mock.calls[0][6]).toBe('right')
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

  // The backend's verdict on the neighbor (available + reason) is the authority: it knows
  // causes the board cannot compute (coma, sleep, a barred way, a full destination).
  describe("the backend's move verdict", () => {
    const blocked = (reason) => ({ ...LOCATION, available: false, reason })

    it('locks a refused move and shows the translated reason, whatever the energy', () => {
      render(<MovementCard location={blocked('COMA')} totalEnergyCost={1}
        playerStats={{ energy: 999 }} story={STORY} onPreview={vi.fn()}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(screen.getByTestId('locked').textContent).toBe('true')
      expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.reason.COMA')
      expect(screen.queryByTestId('action-btn')).toBeNull()
    })

    // The icon comes from the shared reason→icon table (constants/lockReasons), not from an
    // `if` inside the card; it says what to do about the refusal, not merely that it happened.
    it.each([
      ['SLEEPING', 'fas fa-moon'],
      ['MOVEMENT_CONDITION_NOT_MET', 'fas fa-lock'],
      ['LOCATION_FULL', 'fas fa-users'],
      // the bed points at the way out of an energy problem: go to sleep
      ['INSUFFICIENT_ENERGY', 'fas fa-bed'],
    ])('%s renders the %s icon', (reason, icon) => {
      render(<MovementCard location={blocked(reason)} totalEnergyCost={1}
        playerStats={{ energy: 999 }} story={STORY} onPreview={vi.fn()}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(capturedProps.lockedIcon).toBe(icon)
      expect(capturedProps.lockInfo).toBe(`game.movement.reason.${reason}`)
    })

    it('says only that the move is blocked when the backend gives no reason', () => {
      render(<MovementCard location={{ ...LOCATION, available: false, reason: null }}
        totalEnergyCost={1} playerStats={{ energy: 999 }} story={STORY} onPreview={vi.fn()}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      // no cause is invented out of thin air
      expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.blocked')
    })

    it('an available neighbor moves, and carries the reason into the preview', () => {
      const onPreview = vi.fn()
      render(<MovementCard location={{ ...LOCATION, available: true, reason: null }}
        totalEnergyCost={4} playerStats={{ energy: 30 }} story={STORY} onPreview={onPreview}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(screen.getByTestId('locked').textContent).toBe('false')
      expect(screen.getByTestId('action-btn')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('preview-btn'))
      expect(onPreview.mock.calls[0][2]).toBeNull()   // 3rd arg = lockReason
    })

    // Two registers for one refusal: a word on the card (it lives in a badge), the whole
    // sentence in the preview (which has the room to explain).
    it('shows the short reason on the card and the full sentence in the preview', () => {
      const onPreview = vi.fn()
      render(<MovementCard location={blocked('LOCATION_FULL')} totalEnergyCost={1}
        playerStats={{ energy: 999 }} story={STORY} onPreview={onPreview}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.reason.LOCATION_FULL')
      fireEvent.click(screen.getByTestId('preview-btn'))
      expect(onPreview.mock.calls[0][2])   // 3rd arg = lockReason
        .toBe('game.movement.reasonFull.LOCATION_FULL')
    })

    it('explains an energy-locked move in full in the preview, even with no backend verdict', () => {
      const onPreview = vi.fn()
      render(<MovementCard location={LOCATION} totalEnergyCost={50}
        playerStats={{ energy: 5 }} story={STORY} onPreview={onPreview}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.noEnergy')
      fireEvent.click(screen.getByTestId('preview-btn'))
      expect(onPreview.mock.calls[0][2]).toBe('game.movement.reasonFull.INSUFFICIENT_ENERGY')
    })

    it('an older payload with no verdict still gates on the local energy check', () => {
      // available/reason absent: the card behaves exactly as it did before the verdict existed
      render(<MovementCard location={LOCATION} totalEnergyCost={50}
        playerStats={{ energy: 5 }} story={STORY} onPreview={vi.fn()}
        matchUuid="m1" accessToken="tok" onMoved={vi.fn()} />)
      expect(screen.getByTestId('locked').textContent).toBe('true')
      expect(screen.getByTestId('lock-info').textContent).toBe('game.movement.noEnergy')
      expect(capturedProps.lockedIcon).toBe('fas fa-bed')
    })
  })
})
