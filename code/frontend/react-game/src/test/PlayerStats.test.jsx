import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/common/BonusBadgeList', () => ({
  default: ({ items, showZeros }) => (
    <ul data-testid="bonus-list" data-show-zeros={String(showZeros)}>
      {items.map(i => <li key={i.key}>{i.key}:{i.value}</li>)}
    </ul>
  ),
}))

import PlayerStats from '../features/game/PlayerStats'

const FLAT_KEYS = ['life','energy','sadness','experience','food','magic','coins','weight']

describe('PlayerStats', () => {
  it('renders all stat keys', () => {
    render(<PlayerStats stats={{ life: 10, energy: 5, coins: 3 }} />)
    for (const k of FLAT_KEYS) {
      expect(screen.getByText(new RegExp(`^${k}:`))).toBeInTheDocument()
    }
  })

  it('passes showZeros=true to BonusBadgeList', () => {
    render(<PlayerStats stats={{}} />)
    expect(screen.getByTestId('bonus-list')).toHaveAttribute('data-show-zeros', 'true')
  })

  it('defaults to 0 for missing stat keys', () => {
    render(<PlayerStats stats={{}} />)
    expect(screen.getByText('life:0')).toBeInTheDocument()
    expect(screen.getByText('coins:0')).toBeInTheDocument()
  })

  it('forwards stat values correctly', () => {
    render(<PlayerStats stats={{ life: 42, magic: 7 }} />)
    expect(screen.getByText('life:42')).toBeInTheDocument()
    expect(screen.getByText('magic:7')).toBeInTheDocument()
  })

  it('renders safely when stats is undefined', () => {
    render(<PlayerStats />)
    expect(screen.queryByText('life:0')).toBeInTheDocument()
  })
})
