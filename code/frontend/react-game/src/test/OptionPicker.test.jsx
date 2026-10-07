import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

import OptionPicker from '../features/start-book/OptionPicker'

/**
 * The trait picker is the only multi-select one, and the only one with a budget:
 * every other type goes down the single-select path with no budget line at all.
 */
const TRAITS = [
  { uuid: 't1', name: 'Brave', costPositive: 2, costNegative: 0 },
  { uuid: 't2', name: 'Greedy', costPositive: 5, costNegative: 0 },
]

function renderPicker(props) {
  return render(<OptionPicker type="trait" options={TRAITS} story={{ classes: [] }}
                              onSelect={() => {}} onBack={() => {}} {...props} />)
}

/** The two cost badges beside the "Select Trait" title, as [positive, negative] values. */
function titleBudget() {
  return Array.from(screen.getByTestId('trait-budget').querySelectorAll('strong')).map(e => e.textContent)
}

describe('OptionPicker', () => {
  it('shows no cost badge at all when the difficulty budgets neither side (null or zero)', () => {
    renderPicker({ selected: [TRAITS[0]], config: { difficulty: { traitCostPositiveBudget: 0 } },
                   options: [{ uuid: 't1', name: 'Brave', costPositive: 2, costNegative: 1, life: 5 }] })
    expect(titleBudget()).toEqual([])
    expect(document.querySelector('.gc-title [title="book.stats.costPositive"]')).toBeNull()
    expect(document.querySelector('.gc-title [title="book.stats.costNegative"]')).toBeNull()
  })

  it('shows used/max for the positive side only when only that budget is set', () => {
    renderPicker({ selected: [TRAITS[0]], config: { difficulty: { traitCostPositiveBudget: 4 } } })
    expect(titleBudget()).toEqual(['2/4'])
    expect(screen.getByTestId('trait-budget').querySelector('[title="book.traitBudgetPositive"]')).not.toBeNull()
  })

  it('shows used/max for the negative side only when only that budget is set', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostNegativeBudget: 3 } } })
    expect(titleBudget()).toEqual(['0/3'])
    expect(screen.getByTestId('trait-budget').querySelector('[title="book.traitBudgetNegative"]')).not.toBeNull()
  })

  it('badges each trait card title with its own cost, zero included, ahead of its stats', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 2, traitCostNegativeBudget: 3 } },
                   options: [{ uuid: 't1', name: 'Brave', costPositive: 2, costNegative: 0, life: 5 }] })
    const badges = Array.from(document.querySelectorAll('.gc-title .stat-badge'))
    expect(badges.map(b => b.getAttribute('title')))
      .toEqual(['book.stats.costPositive', 'book.stats.costNegative', 'life'])
    expect(badges.map(b => b.querySelector('strong').textContent)).toEqual(['2', '0', '5'])
  })

  it('previews a trait with its budgeted cost first, then its stats', () => {
    const onPreview = vi.fn()
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 2 } }, onPreview,
                   options: [{ uuid: 't1', name: 'Brave', costPositive: 2, costNegative: 1, life: 5 }] })
    fireEvent.click(screen.getByRole('button', { name: 'card.info' }))
    const items = onPreview.mock.calls[0][3]
    expect(items.map(i => i.key)).toEqual(['costPositive', 'life'])
    expect(items[0].keepZero).toBe(true)
  })

  it('previews a non-trait option with its plain stats', () => {
    const onPreview = vi.fn()
    render(<OptionPicker type="class" options={[{ uuid: 'c1', name: 'Mage', weightMax: 3 }]}
                         selected={null} story={{ classes: [] }} onPreview={onPreview}
                         onSelect={() => {}} onBack={() => {}} config={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'card.info' }))
    expect(onPreview.mock.calls[0][3].map(i => i.key)).toEqual(['weightMax'])
  })

  it('locks a trait the remaining budget cannot pay for, under a "traits cost" label', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 3 } } })
    // Brave costs 2 and fits; Greedy costs 5 and does not.
    const locks = document.querySelectorAll('[title="book.traitBudgetExceeded"]')
    expect(locks.length).toBe(1)
    expect(locks[0].textContent).toContain('book.traitCostLock')
    expect(locks[0].textContent).not.toContain('Greedy')
  })

  it('a selected trait stays clickable so it can be removed', () => {
    const onSelect = vi.fn()
    renderPicker({ selected: [TRAITS[1]], config: { difficulty: { traitCostPositiveBudget: 5 } },
                   onSelect })
    fireEvent.click(screen.getByRole('button', { name: /book.remove/ }))
    expect(onSelect).toHaveBeenCalledWith(TRAITS[1])
  })

  it('a non-array selection is read as an empty one', () => {
    renderPicker({ selected: null, config: { difficulty: { traitCostPositiveBudget: 10 } } })
    expect(screen.getAllByRole('button', { name: /book.select/ }).length).toBe(2)
  })

  it('a non-trait picker has no budget line and a single-select label', () => {
    render(<OptionPicker type="class" options={[{ uuid: 'c1', name: 'Mage' }]}
                         selected={{ uuid: 'c1' }} story={{ classes: [] }}
                         onSelect={() => {}} onBack={() => {}} config={{}} />)
    expect(screen.queryByTestId('trait-budget')).toBeNull()
    expect(screen.getByRole('button', { name: /book.select/ })).toBeInTheDocument()
  })

  it('an option with neither uuid nor name still gets a key and renders', () => {
    render(<OptionPicker type="class" options={[{ description: 'anonymous' }]}
                         selected={null} story={null} onSelect={() => {}} onBack={() => {}}
                         config={{}} />)
    expect(screen.getByRole('button', { name: /book.select/ })).toBeInTheDocument()
  })

  // v0.38.3 — no title and no back arrow: the left page carries them. A non-trait picker
  // has no header content at all; a trait one keeps its budget badges.
  it('draws no title and no back arrow, whatever the type', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 3 } } })
    expect(document.querySelector('.selection-title')).toBeNull()
    expect(screen.getByTestId('trait-budget')).toBeInTheDocument()
    const { container } = render(
      <OptionPicker type="class" options={[{ uuid: 'c1', name: 'Mage' }]} selected={null}
                    story={{ classes: [] }} onSelect={() => {}} onBack={() => {}} config={{}} />)
    expect(container.querySelector('.selection-header').textContent).toBe('')
  })
})
