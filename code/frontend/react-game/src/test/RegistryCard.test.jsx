import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured = props
    return (
      <div data-testid="registry-card">
        <span data-testid="title">{props.card?.title}</span>
        <span data-testid="description">{props.card?.description}</span>
        {props.onAction && <button data-testid="open" onClick={props.onAction}>open</button>}
      </div>
    )
  },
}))

import RegistryCard from '../features/gameplay/cards/RegistryCard'
import images from '../data/images.json'

describe('RegistryCard (Step 36)', () => {
  it("is the backpack card's neighbour: same shape, one footer action", () => {
    render(<RegistryCard onOpen={vi.fn()} count={0} />)

    expect(screen.getByTestId('title').textContent).toBe('game.registry.title')
    expect(captured.entityType).toBe('registry')
    expect(captured.actionLabel).toBe('game.registry.open')
    // Pinned by identity, like the backpack: buildRegistryCard returns {} for an unknown id,
    // so a missing entry would render an empty card rather than fail loudly.
    const registry = images.find(i => i.id === 'registry')
    expect(registry).toBeTruthy()
    expect(captured.card.urlImage).toBe(registry.urlImage)
  })

  it('counts the recorded keys as a badge, in the body over the image', () => {
    render(<RegistryCard onOpen={vi.fn()} count={4} />)

    expect(captured.statistics).toEqual([
      { key: 'registry', value: '4', label: 'game.registry.count' },
    ])
    // flagShowFullStatistics is the switch that moves the badges out of the title and into
    // the body, over the image — the same place the backpack card puts its figures.
    expect(captured.flagShowFullStatistics).toBe(true)
  })

  it('lets an empty registry show no badge at all', () => {
    // showZeros is deliberately off here: a "0 recorded" badge on the (i) list says nothing
    // the empty section would not say better. The per-key cards DO pass it, because there a
    // key worth 0 is a value, not an absence.
    render(<RegistryCard onOpen={vi.fn()} count={0} />)
    expect(captured.bonusBadgeShowZeros).toBeUndefined()
  })

  describe('page variant', () => {
    it('owns the left page: closes rather than opens, and carries the same figure', () => {
      const onClose = vi.fn()
      render(<RegistryCard variant="page" count={4} onClose={onClose} />)

      expect(captured.variant).toBe('page')
      expect(captured.onClose).toBe(onClose)
      expect(captured.onAction).toBeUndefined()
      expect(captured.hidePreview).toBe(true)
      // The page carries no figure of its own: the count belongs to the (i) list card, and
      // the facing page already shows one card per key.
      expect(captured.statItemsToPageContent).toBeUndefined()
    })

    it('describes itself in prose only on the page, exactly as the bag does', () => {
      render(<RegistryCard variant="page" count={1} onClose={vi.fn()} />)
      expect(screen.getByTestId('description').textContent).toBe('game.registry.description')
    })
  })
})
