import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured = props
    return (
      <div data-testid="items-card">
        <span data-testid="title">{props.card?.title}</span>
        <span data-testid="description">{props.card?.description}</span>
        {props.onAction && <button data-testid="open" onClick={props.onAction}>open</button>}
      </div>
    )
  },
}))

import ItemsCard from '../features/gameplay/cards/ItemsCard'
import images from '../data/images.json'

describe('ItemsCard', () => {
  it('is the map card\'s twin: same shape, one footer action', () => {
    render(<ItemsCard onOpen={vi.fn()} count={0} />)

    expect(screen.getByTestId('title').textContent).toBe('game.items.title')
    expect(captured.entityType).toBe('items')
    expect(captured.actionLabel).toBe('game.items.open')
    // The artwork is the `backpack` entry of images.json, whatever that entry happens to
    // hold: pinned by identity, not by the text of its URL, which is free to change.
    const backpack = images.find(i => i.id === 'backpack')
    expect(backpack).toBeTruthy()
    expect(captured.card.urlImage).toBe(backpack.urlImage)
  })

  it('says how heavy the bag is as a BADGE, not as a sentence (v0.35.2)', () => {
    render(<ItemsCard onOpen={vi.fn()} count={3} weight={7} weightMax={30}
      food={4} magic={2} coins={9} />)

    // The same BonusBadgeList an ItemCard carries: the bag and the things in it are
    // measured in the same alphabet. The count badge is deliberately not here — the facing
    // page already shows one card per row, so the number would be the same fact twice.
    expect(captured.statistics).toEqual([
      { key: 'food', value: '4', label: 'game.stats.food' },
      { key: 'magic', value: '2', label: 'game.stats.magic' },
      { key: 'coins', value: '9', label: 'game.stats.coins' },
      { key: 'weight', value: '7/30', label: 'game.items.capacity' },
    ])
    // The description is now the prose alone — the figures left it.
    expect(screen.getByTestId('description').textContent).toBe('game.items.description')
  })

  it('reads a missing weight as zero rather than showing "undefined"', () => {
    render(<ItemsCard onOpen={vi.fn()} count={1} weightMax={30} />)

    expect(captured.statistics.at(-1).value).toBe('0/30')
  })

  // v0.35.3 — food, magic and coins are spent from the backpack now (an event or a road
  // can ask for them), so the bag has to show how much of each is in it.
  it('carries food, magic and coins beside the capacity', () => {
    render(<ItemsCard onOpen={vi.fn()} count={0} weight={0} weightMax={30}
      food={4} magic={2} coins={9} />)

    const byKey = Object.fromEntries(captured.statistics.map(s => [s.key, s.value]))
    expect(byKey.food).toBe('4')
    expect(byKey.magic).toBe('2')
    expect(byKey.coins).toBe('9')
  })

  it('shows an empty supply as 0, never as a missing badge', () => {
    // Weightless resources at zero are exactly the news a player about to be refused for
    // want of two rations needs, so they must not be filtered away with the other zeros.
    render(<ItemsCard onOpen={vi.fn()} count={0} weight={0} weightMax={30} />)

    const byKey = Object.fromEntries(captured.statistics.map(s => [s.key, s.value]))
    expect(byKey.food).toBe('0')
    expect(byKey.magic).toBe('0')
    expect(byKey.coins).toBe('0')
    expect(captured.bonusBadgeShowZeros).toBe(true)
  })

  it('keeps an empty bag visible: zero is the news, not noise', () => {
    // BonusBadgeList drops a zero value by default, and "0 items, 0/30" is exactly what an
    // empty bag has to report — hence the explicit opt-out.
    render(<ItemsCard onOpen={vi.fn()} count={0} weight={0} weightMax={30} />)

    expect(captured.bonusBadgeShowZeros).toBe(true)
    expect(captured.statistics.at(-1).value).toBe('0/30')
  })

  it('drops only the capacity badge when no maximum is known', () => {
    // The resources are still there: they weigh nothing, so they do not depend on a
    // capacity being known.
    render(<ItemsCard onOpen={vi.fn()} count={2} />)

    expect(captured.statistics.map(s => s.key)).toEqual(['food', 'magic', 'coins'])
  })

  it('opens the backpack through onOpen', () => {
    const onOpen = vi.fn()
    render(<ItemsCard onOpen={onOpen} count={1} />)

    fireEvent.click(screen.getByTestId('open'))
    expect(onOpen).toHaveBeenCalled()
  })

  // The page shape owns the LEFT reading page while the bag is open, the way MapPage owns
  // it while the map is: title, capacity and the way back — no "open" action, since the
  // bag is already open.
  describe('page variant', () => {
    it('renders as a reading page with a back arrow, not as a little card', () => {
      const onClose = vi.fn()

      render(<ItemsCard variant="page" onClose={onClose} count={2} weight={5} weightMax={30} />)

      expect(captured.variant).toBe('page')
      expect(captured.onClose).toBe(onClose)
      expect(captured.hidePreview).toBe(true)
      // Nothing to "open": the footer action belongs to the little shape only.
      expect(captured.onAction).toBeUndefined()
    })

    it('carries the figures as page badges, the same list the little card gets', () => {
      const props = { count: 2, weight: 5, weightMax: 30, food: 1, magic: 0, coins: 3 }
      render(<ItemsCard variant="page" onClose={vi.fn()} {...props} />)
      const asPage = captured.statItemsToPageContent

      render(<ItemsCard onOpen={vi.fn()} {...props} />)
      expect(asPage).toEqual(captured.statistics)
      expect(asPage).toEqual([
        { key: 'food', value: '1', label: 'game.stats.food' },
        { key: 'magic', value: '0', label: 'game.stats.magic' },
        { key: 'coins', value: '3', label: 'game.stats.coins' },
        { key: 'weight', value: '5/30', label: 'game.items.capacity' },
      ])
    })

    it('keeps the very same description the little card showed', () => {
      const props = { count: 2, weight: 5, weightMax: 30 }
      render(<ItemsCard variant="page" onClose={vi.fn()} {...props} />)
      const asPage = screen.getByTestId('description').textContent

      render(<ItemsCard onOpen={vi.fn()} {...props} />)
      const asLittle = screen.getAllByTestId('description').at(-1).textContent

      // One figure, read before and after opening the bag — it cannot disagree with itself.
      expect(asPage).toBe(asLittle)
    })
  })
})
