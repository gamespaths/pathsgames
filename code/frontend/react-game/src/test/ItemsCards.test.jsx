import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

// Card is stubbed the same way the other card suites stub it: every handler GameBook
// wires becomes a button, so the branch behind it can be fired from a test.
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, entityType, onAction, actionLabel, childrenIntoImage }) => (
    <div data-testid={`card-${entityType}`}>
      <span data-testid="title">{card?.title}</span>
      <span data-testid="description">{card?.description}</span>
      {childrenIntoImage}
      {onAction && <button data-testid="card-action" onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))
const itemCardProps = []
vi.mock('../features/gameplay/cards/ItemCard', () => ({
  default: (props) => {
    itemCardProps.push(props)
    return <div data-testid="item-card">{props.item.uuid}</div>
  },
}))
import ItemsCards from '../features/gameplay/cards/ItemsCards'

const ROW = (uuid, over = {}) => ({
  uuid, itemUuid: `item-${uuid}`, name: 'Potion', weight: 2, amount: 1,
  isConsumabile: true, card: { title: 'Healing Potion' }, ...over,
})

describe('ItemsCards', () => {
  it('renders one ItemCard per inventory row', () => {
    const stats = { items: [ROW('row-1'), ROW('row-2')], weight: 4, weightMax: 30 }

    render(<ItemsCards playerStats={stats} onPreview={vi.fn()} />)

    expect(screen.getAllByTestId('item-card')).toHaveLength(2)
  })

  it('shows what can be used first, and keeps the rest in the order it arrived (v0.35.2)', () => {
    const stats = { items: [
      ROW('carried', { isConsumabile: false }),
      ROW('usable-a'),
      ROW('scarce', { amount: 1, amountUse: 2 }),   // consumable, but not enough units
      ROW('usable-b'),
    ] }

    render(<ItemsCards playerStats={stats} onPreview={vi.fn()} />)

    // The two halves are exactly the unlocked cards and the padlocked ones, and inside
    // each half nothing was reshuffled — Array.sort is stable.
    expect(screen.getAllByTestId('item-card').map(n => n.textContent))
      .toEqual(['usable-a', 'usable-b', 'carried', 'scarce'])
  })

  it('sorts by the same rule the card locks itself with', () => {
    // A padlocked card sitting among the usable ones would be worse than any order: the
    // list and the card would be telling the player two different things.
    const stats = { items: [ROW('scarce', { amount: 1, amountUse: 2 }), ROW('usable')] }

    render(<ItemsCards playerStats={stats} onPreview={vi.fn()} />)

    expect(screen.getAllByTestId('item-card').map(n => n.textContent))
      .toEqual(['usable', 'scarce'])
  })

  it('says nothing at all when the bag is empty', () => {
    // An empty bag is not news: the LEFT page already reads "0 items", so a sentence here
    // would be the same fact twice. The list is simply not rendered.
    render(<ItemsCards playerStats={{ items: [] }} onPreview={vi.fn()} />)

    expect(screen.queryByTestId('item-card')).toBeNull()
    expect(screen.queryByText('game.items.empty')).toBeNull()
  })

  it('survives player stats with no items key at all', () => {
    render(<ItemsCards playerStats={{}} onPreview={vi.fn()} />)

    // No rows, no message, and no crash on the missing key — which is what this guards.
    expect(screen.queryByTestId('item-card')).toBeNull()
    expect(screen.queryByText('game.items.empty')).toBeNull()
  })

  it('carries no header of its own — only the rows', () => {
    // The bag's title, its capacity and the way back are on the LEFT page (ItemsCard,
    // page variant). A header here would be a second copy of all three.
    const stats = { items: [ROW('row-1')], weight: 2, weightMax: 30 }

    render(<ItemsCards playerStats={stats} onPreview={vi.fn()} />)

    expect(screen.getAllByTestId('item-card')).toHaveLength(1)
    expect(screen.queryByTestId('card-items')).toBeNull()
    expect(screen.queryByTestId('card-action')).toBeNull()
  })

  it('hands each ItemCard what it needs to act', () => {
    itemCardProps.length = 0
    const onDone = vi.fn()
    const onDropped = vi.fn()

    render(<ItemsCards playerStats={{ items: [ROW('row-1')] }} matchUuid="m1"
      accessToken="tok" onPreview={vi.fn()} onDone={onDone} onDropped={onDropped}
      onError={vi.fn()} />)

    const props = itemCardProps.at(-1)
    expect(props.matchUuid).toBe('m1')
    expect(props.accessToken).toBe('tok')
    // use-item answers the execute-event payload, so onDone is the board's event handler.
    expect(props.onDone).toBe(onDone)
    expect(props.onDropped).toBe(onDropped)
    expect(props.previewSide).toBe('right')
  })
})
