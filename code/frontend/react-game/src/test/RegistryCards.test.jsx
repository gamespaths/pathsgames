import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

const seen = []
vi.mock('../features/gameplay/cards/RegistryKeyCard', () => ({
  default: (props) => {
    seen.push(props)
    return <div data-testid="key-card">{props.entry?.key}</div>
  },
}))

import RegistryCards from '../features/gameplay/cards/RegistryCards'

const entry = (key, category, priority, extra = {}) => ({
  uuid: `u-${key}`, key, category, priority, visible: true,
  values: ['1'], multiValue: false, ...extra,
})

describe('RegistryCards (Step 36)', () => {
  beforeEach(() => { seen.length = 0 })

  it('orders by category, then priority, then key — one flat grid, no headings', () => {
    const { container } = render(<RegistryCards registry={[
      entry('zeta', 'tutorial', 2),
      entry('alpha', 'tutorial', 1),
      entry('beta', 'evidence', 1),
    ]} />)

    expect(seen.map(p => p.entry.key)).toEqual(['beta', 'alpha', 'zeta'])
    // The ordering keeps a category's keys together, so no heading has to say so — and a
    // heading would break the cards out of the one grid the backpack also lays out in.
    expect(container.querySelector('h3')).toBeNull()
    expect(container.querySelector('.registry-group')).toBeNull()
  })

  it('lays the cards out in the same grid container the backpack uses', () => {
    const { container } = render(<RegistryCards registry={[entry('k', 'tutorial', 1)]} />)
    const grid = container.querySelector('.config-cards-area.selection-list')
    expect(grid).not.toBeNull()
    // The card is a direct child of the grid: nothing wraps it into a block of its own.
    expect(grid.querySelector(':scope > [data-testid="key-card"]')).not.toBeNull()
  })

  it('hides the keys the story marked as not visible', () => {
    render(<RegistryCards registry={[
      entry('shown', 'tutorial', 1),
      entry('secret', 'tutorial', 2, { visible: false }),
    ]} />)

    expect(seen.map(p => p.entry.key)).toEqual(['shown'])
  })

  it('says so when there is nothing recorded yet', () => {
    render(<RegistryCards registry={[]} />)
    expect(screen.getByText('game.registry.empty')).toBeInTheDocument()
    expect(seen).toHaveLength(0)
  })

  it('survives a match whose /info carried no registry at all', () => {
    render(<RegistryCards registry={undefined} />)
    expect(screen.getByText('game.registry.empty')).toBeInTheDocument()
  })

  it('carries no header of its own — the left page IS the header', () => {
    const { container } = render(<RegistryCards registry={[entry('k', null, 1)]} />)
    expect(container.querySelector('.registry-group-title')).toBeNull()
  })

  it('hands each key card what it needs to open its own page', () => {
    const onPreview = vi.fn()
    const story = { uuid: 's-1' }
    render(<RegistryCards registry={[entry('k', 'tutorial', 1)]}
      story={story} onPreview={onPreview} />)

    expect(seen[0].story).toBe(story)
    expect(seen[0].onPreview).toBe(onPreview)
    expect(seen[0].previewSide).toBe('right')
  })

  it('passes the joining flag down, and leaves the cards separated by default', () => {
    render(<RegistryCards registry={[entry('k', 'tutorial', 1)]} />)
    expect(seen[0].joinValues).toBe(false)

    seen.length = 0
    render(<RegistryCards joinValues registry={[entry('k', 'tutorial', 1)]} />)
    expect(seen[0].joinValues).toBe(true)
  })

  it('still renders a key whose set was emptied, which comes back with no uuid', () => {
    // Step 36.1 — an entry is built from the key's ROWS, and an emptied multi key has none:
    // there is no last row to take a uuid from. The key name is what keys the card then.
    const { container } = render(<RegistryCards registry={[
      { key: 'clues', category: 'evidence', priority: 1, visible: true,
        uuid: null, values: [], multiValue: true },
    ]} />)

    expect(seen.map(p => p.entry.key)).toEqual(['clues'])
    expect(container.querySelectorAll('[data-testid="key-card"]')).toHaveLength(1)
  })
})
