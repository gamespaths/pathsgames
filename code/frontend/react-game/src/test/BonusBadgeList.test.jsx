import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BonusBadgeList from '../components/ui/BonusBadgeList'

describe('BonusBadgeList', () => {
  it('returns null for missing or empty items', () => {
    const { container, rerender } = render(<BonusBadgeList items={null} />)
    expect(container.firstChild).toBeNull()
    rerender(<BonusBadgeList items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('hides zero / non-finite values by default and renders known stat icons', () => {
    const { container } = render(
      <BonusBadgeList
        className="extra"
        items={[
          { key: 'life', label: 'Life', value: 5 },
          { key: 'energy', label: 'Energy', value: 0 },
          { key: 'weight', label: 'Weight', value: null },
        ]}
      />
    )
    expect(container.querySelectorAll('.stat-badge').length).toBe(1)
    expect(container.querySelector('.fa-heart')).toBeTruthy()
    expect(container.querySelector('.extra')).toBeTruthy()
  })

  it('keeps zero values when showZeros is set', () => {
    const { container } = render(
      <BonusBadgeList
        showZeros
        items={[
          { key: 'life', label: 'Life', value: 0 },
          { key: 'energy', label: 'Energy', value: 0 },
        ]}
      />
    )
    expect(container.querySelectorAll('.stat-badge').length).toBe(2)
  })

  it('returns null when every item is filtered out', () => {
    const { container } = render(
      <BonusBadgeList items={[{ key: 'life', label: 'Life', value: 0 }]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('falls back to the default visual for an unknown stat key', () => {
    const { container } = render(
      <BonusBadgeList items={[{ key: 'mystery', label: 'X', value: 3 }]} />
    )
    expect(container.querySelector('.fa-circle')).toBeTruthy()
  })
})
