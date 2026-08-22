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
    render(<ItemsCard onOpen={vi.fn()} count={3} weight={7} weightMax={30} />)

    // The same BonusBadgeList an ItemCard carries: the bag and the things in it are
    // measured in the same alphabet. The count badge is deliberately not here — the facing
    // page already shows one card per row, so the number would be the same fact twice.
    expect(captured.statistics).toEqual([
      { key: 'weight', value: '7/30', label: 'game.items.capacity' },
    ])
    // The description is now the prose alone — the figures left it.
    expect(screen.getByTestId('description').textContent).toBe('game.items.description')
  })

  it('reads a missing weight as zero rather than showing "undefined"', () => {
    render(<ItemsCard onOpen={vi.fn()} count={1} weightMax={30} />)

    expect(captured.statistics[0].value).toBe('0/30')
  })

  it('keeps an empty bag visible: zero is the news, not noise', () => {
    // BonusBadgeList drops a zero value by default, and "0 items, 0/30" is exactly what an
    // empty bag has to report — hence the explicit opt-out.
    render(<ItemsCard onOpen={vi.fn()} count={0} weight={0} weightMax={30} />)

    expect(captured.bonusBadgeShowZeros).toBe(true)
    expect(captured.statistics[0].value).toBe('0/30')
  })

  it('carries no badge at all when no maximum is known', () => {
    render(<ItemsCard onOpen={vi.fn()} count={2} />)

    expect(captured.statistics).toEqual([])
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
      const props = { count: 2, weight: 5, weightMax: 30 }
      render(<ItemsCard variant="page" onClose={vi.fn()} {...props} />)
      const asPage = captured.statItemsToPageContent

      render(<ItemsCard onOpen={vi.fn()} {...props} />)
      expect(asPage).toEqual(captured.statistics)
      expect(asPage).toEqual([
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
