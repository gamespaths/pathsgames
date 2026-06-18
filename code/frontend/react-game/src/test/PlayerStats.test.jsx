import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({
  default: ({ items, showZeros }) => (
    <ul data-testid="bonus-list" data-show-zeros={String(showZeros)}>
      {items.map(i => <li key={i.key}>{i.key}:{i.value}</li>)}
    </ul>
  ),
}))

import PlayerStats from '../features/gameplay/cards/PlayerStats'

const FLAT_KEYS = ['life','energy','sadness','experience','food','magic','coins','weight']

describe('PlayerStats', () => {
  it('renders all stat keys', () => {
    render(<PlayerStats stats={{ life: 10, energy: 5, coins: 3 }} plainFlag />)
    for (const k of FLAT_KEYS) {
      expect(screen.getByText(new RegExp(`^${k}:`))).toBeInTheDocument()
    }
  })

  it('passes showZeros=true to BonusBadgeList', () => {
    render(<PlayerStats stats={{}} />)
    expect(screen.getByTestId('bonus-list')).toHaveAttribute('data-show-zeros', 'true')
  })

  it('defaults to 0 for missing stat keys', () => {
    render(<PlayerStats stats={{}} plainFlag />)
    expect(screen.getByText('life:0')).toBeInTheDocument()
    expect(screen.getByText('coins:0')).toBeInTheDocument()
  })

  it('forwards stat values correctly', () => {
    render(<PlayerStats stats={{ life: 42, magic: 7 }} plainFlag />)
    expect(screen.getByText('life:42')).toBeInTheDocument()
    expect(screen.getByText('magic:7')).toBeInTheDocument()
  })

  it('renders safely when stats is undefined', () => {
    render(<PlayerStats />)
    expect(screen.queryByText('life:0')).toBeInTheDocument()
  })

  it('renders current/max gauges when max values are present (Step 27)', () => {
    render(<PlayerStats stats={{ life: 10, lifeMax: 12, energy: 8, energyMax: 11, weight: 4, weightMax: 24 }} />)
    expect(screen.getByText('life:10/12')).toBeInTheDocument()
    expect(screen.getByText('energy:8/11')).toBeInTheDocument()
    expect(screen.getByText('weight:4/24')).toBeInTheDocument()
  })

  it('renders the carried items list (Step 27)', () => {
    render(<PlayerStats stats={{ items: [{ uuid: 'inv-1', name: 'Potion', amount: 2 }] }} />)
    expect(screen.getByText('Potion')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
  })
})
