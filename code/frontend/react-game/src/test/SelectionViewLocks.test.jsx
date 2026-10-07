import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../utils/bonusStats', async (orig) => {
  const actual = await orig()
  return { ...actual, getOptionLockInfo: vi.fn() }
})
vi.mock('../components/layout/Card', () => ({
  default: (p) => (
    <div
      data-testid="gc"
      data-locked={p.locked ? 'y' : 'n'}
      data-reason={p.lockedReason ?? ''}
      data-hasselect={p.onSelect ? 'y' : 'n'}
      data-haspreview={p.onPreview ? 'y' : 'n'}
    >{p.name}</div>
  ),
}))

import SelectionView from '../features/start-book/OptionPicker'
import { getOptionLockInfo } from '../utils/bonusStats'

const opts = (n) => Array.from({ length: n }, (_, i) => ({ uuid: `o${i}`, name: `N${i}`, card: {} }))

describe('startBook/SelectionView lock handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders lock reasons for requires/prohibited/generic and leaves unlocked selectable', () => {
    getOptionLockInfo
      .mockReturnValueOnce({ kind: 'requires', className: 'Mage' })
      .mockReturnValueOnce({ kind: 'prohibited', classId: 3 })
      .mockReturnValueOnce({ kind: 'weird' })
      .mockReturnValueOnce(null)

    render(
      <SelectionView
        type="class" options={opts(4)} config={{}} story={{ classes: [] }}
        selected={{ uuid: 'o3' }} onSelect={vi.fn()} onBack={vi.fn()} onPreview={vi.fn()}
      />
    )
    const cards = screen.getAllByTestId('gc')
    expect(cards.length).toBe(4)
    expect(cards[0].dataset.locked).toBe('y')
    expect(cards[0].dataset.reason).toBe('book.notAllowedRequires')
    expect(cards[1].dataset.reason).toBe('book.notAllowedProhibited')
    expect(cards[2].dataset.reason).toBe('book.notAllowedGeneric')
    expect(cards[0].dataset.hasselect).toBe('n') // locked → no select handler
    expect(cards[3].dataset.locked).toBe('n')
    expect(cards[3].dataset.hasselect).toBe('y')
  })

  it('omits the preview handler when onPreview is not provided', () => {
    getOptionLockInfo.mockReturnValue(null)
    render(
      <SelectionView type="trait" options={opts(1)} config={{}} story={{}} onSelect={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByTestId('gc').dataset.haspreview).toBe('n')
  })

  // v0.38.3 — no header button left to click: back lives on the left page / mobile column.
  it('renders an empty header, whatever onBack it is handed', () => {
    getOptionLockInfo.mockReturnValue(null)
    const { container } = render(
      <SelectionView type="class" options={[]} config={{}} story={{}} onSelect={vi.fn()} onBack={vi.fn()} />)
    expect(container.querySelector('.selection-header').textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
