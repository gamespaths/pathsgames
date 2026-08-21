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

  it('shows the empty message instead of a list when the bag is empty', () => {
    render(<ItemsCards playerStats={{ items: [] }} onPreview={vi.fn()} />)

    expect(screen.queryByTestId('item-card')).toBeNull()
    expect(screen.getByText('game.items.empty')).toBeTruthy()
  })

  it('survives player stats with no items key at all', () => {
    render(<ItemsCards playerStats={{}} onPreview={vi.fn()} />)
    expect(screen.getByText('game.items.empty')).toBeTruthy()
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
