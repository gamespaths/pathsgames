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

  it('says how much is in the bag, then explains what the page is for', () => {
    render(<ItemsCard onOpen={vi.fn()} count={3} weight={7} weightMax={30} />)

    const text = screen.getByTestId('description').textContent
    expect(text).toContain('3')
    expect(text).toContain('7/30')
    // A blank line, then the prose. <br> survives DOMPurify's html profile, and the
    // description is only ever rendered by the page variant.
    expect(text).toContain('<br><br>')
    expect(text).toContain('game.items.description')
    expect(text.indexOf('7/30')).toBeLessThan(text.indexOf('game.items.description'))
  })

  it('reads a missing weight as zero rather than showing "undefined"', () => {
    render(<ItemsCard onOpen={vi.fn()} count={1} weightMax={30} />)

    expect(screen.getByTestId('description').textContent).toContain('0/30')
  })

  it('omits the capacity when no maximum is known', () => {
    render(<ItemsCard onOpen={vi.fn()} count={2} />)

    const text = screen.getByTestId('description').textContent
    expect(text).toContain('2')
    expect(text).not.toContain('/')
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
