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
  stringValue: null, intValue: 1, ...extra,
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
})
