import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))

let captured = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    captured = props
    return <div data-testid="registry-key-card">{props.card?.title}</div>
  },
}))

import RegistryKeyCard from '../features/gameplay/cards/RegistryKeyCard'

const entry = (extra = {}) => ({
  uuid: 'u-clues', key: 'clues', category: 'evidence', visible: true,
  values: ['ledger'], multiValue: false,
  card: { title: 'The clues', urlImage: 'https://example.invalid/clues.jpg' }, ...extra,
})

const badgeFor = (list, key) => (list ?? []).find(b => b.key === key)

describe('RegistryKeyCard (Step 36.1)', () => {
  beforeEach(() => { captured = null })

  it('shows the value over the image, and no category badge anywhere', () => {
    render(<RegistryKeyCard entry={entry()} />)

    // What the key holds belongs on the picture, which is what flagShowFullStatistics does.
    const badge = badgeFor(captured.statistics, 'registry')
    expect(badge.value).toBe('ledger')
    // The scroll, not the grey dot DEFAULT_VISUAL hands out for an unknown key.
    expect(badge.icon).toBe('fas fa-scroll')
    expect(captured.flagShowFullStatistics).toBe(true)

    // The category is parked until the grid is ready to carry it again — neither in the
    // title nor among the badges over the image.
    expect(badgeFor(captured.statistics, 'category')).toBeUndefined()
    expect(captured.titleStatistics).toBeUndefined()
  })

  it('renders no value badge at all for a key holding nothing', () => {
    render(<RegistryKeyCard entry={entry({ values: [] })} />)

    // An empty set is not a value worth a dash: the badge is absent, not filled with one.
    expect(captured.statistics).toEqual([])
    expect(JSON.stringify(captured.statistics)).not.toContain('—')
  })

  it('carries its own class, so its badges can be sized without moving any other card', () => {
    render(<RegistryKeyCard entry={entry()} />)
    expect(captured.additionalCardClasses).toBe('pg-card--registry')
  })

  it('drops the info button when the key card has no picture to show', () => {
    // The reading page the (i) opens is mostly its image; with none there is nothing to turn
    // to, so the button goes rather than opening an empty page.
    render(<RegistryKeyCard entry={entry({ card: { title: 'The clues' } })} />)
    expect(captured.hidePreview).toBe(true)

    render(<RegistryKeyCard entry={entry({ card: null })} />)
    expect(captured.hidePreview).toBe(true)
  })

  it('keeps the info button for a key whose card carries a picture', () => {
    render(<RegistryKeyCard entry={entry()} />)
    expect(captured.hidePreview).toBe(false)
    expect(typeof captured.onPreview).toBe('function')
  })

  it('keeps a key worth zero, which is a value and not an absence', () => {
    render(<RegistryKeyCard entry={entry({ values: ['0'] })} />)

    expect(badgeFor(captured.statistics, 'registry').value).toBe('0')
    // Without showZeros BonusBadgeList drops any badge whose value is not a non-zero number.
    expect(captured.bonusBadgeShowZeros).toBe(true)
  })

  it('gives a multi key one badge per member, which is the default', () => {
    render(<RegistryKeyCard entry={entry({ values: ['ledger', 'letter'], multiValue: true })} />)

    // Three clues held are three things, and read as three.
    expect(captured.statistics.map(b => b.value)).toEqual(['ledger', 'letter'])
    expect(captured.statistics.every(b => b.icon === 'fas fa-scroll')).toBe(true)
  })

  it('puts the members back under one badge when joinValues is asked for', () => {
    render(<RegistryKeyCard joinValues
      entry={entry({ values: ['ledger', 'letter'], multiValue: true })} />)

    expect(captured.statistics.map(b => b.value)).toEqual(['ledger, letter'])
  })

  it('renders one badge either way for a key holding a single value', () => {
    render(<RegistryKeyCard entry={entry()} />)
    expect(captured.statistics.map(b => b.value)).toEqual(['ledger'])

    render(<RegistryKeyCard joinValues entry={entry()} />)
    expect(captured.statistics.map(b => b.value)).toEqual(['ledger'])
  })

  it('renders no badge either way for a key holding nothing', () => {
    render(<RegistryKeyCard joinValues entry={entry({ values: [] })} />)
    expect(captured.statistics).toEqual([])
  })

  it('names its badges on the reading page, and omits a value it does not have', () => {
    const onPreview = vi.fn()

    render(<RegistryKeyCard entry={entry()} onPreview={onPreview} />)
    captured.onPreview()
    expect(onPreview.mock.calls[0][0].stats).toEqual([
      { key: 'category', value: 'evidence', label: 'game.registry.category' },
      { key: 'registry', value: 'ledger', label: 'game.registry.value' },
    ])

    onPreview.mockClear()
    render(<RegistryKeyCard entry={entry({ values: [] })} onPreview={onPreview} />)
    captured.onPreview()
    expect(onPreview.mock.calls[0][0].stats).toEqual([
      { key: 'category', value: 'evidence', label: 'game.registry.category' },
    ])
  })

  it('leaves the category out of the reading page too when there is none', () => {
    const onPreview = vi.fn()
    render(<RegistryKeyCard entry={entry({ category: null })} onPreview={onPreview} />)

    captured.onPreview()
    expect(onPreview.mock.calls[0][0].stats).toEqual([
      { key: 'registry', value: 'ledger', label: 'game.registry.value' },
    ])
  })

  it('falls back to the key name when the story gave the key no card', () => {
    render(<RegistryKeyCard entry={entry({ card: null })} />)
    expect(captured.card.title).toBe('clues')
  })
})
