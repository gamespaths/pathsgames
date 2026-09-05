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

describe('OptionPicker', () => {
  it('shows no budget line when the difficulty names neither budget', () => {
    renderPicker({ selected: [], config: { difficulty: {} } })
    expect(screen.queryByTestId('trait-budget')).toBeNull()
  })

  it('shows only the positive budget when only that one is set', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 4 } } })
    expect(screen.getByTestId('trait-budget').textContent).toContain('book.traitBudgetPositive')
    expect(screen.getByTestId('trait-budget').textContent).not.toContain('book.traitBudgetNegative')
  })

  it('shows only the negative budget when only that one is set', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostNegativeBudget: 3 } } })
    expect(screen.getByTestId('trait-budget').textContent).toContain('book.traitBudgetNegative')
    expect(screen.getByTestId('trait-budget').textContent).not.toContain('book.traitBudgetPositive')
  })

  it('locks a trait the remaining budget cannot pay for', () => {
    renderPicker({ selected: [], config: { difficulty: { traitCostPositiveBudget: 3 } } })
    // Brave costs 2 and fits; Greedy costs 5 and does not.
    expect(document.querySelectorAll('[title="book.traitBudgetExceeded"]').length).toBe(1)
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

  it('the back button calls onBack', () => {
    const onBack = vi.fn()
    renderPicker({ selected: [], config: {}, onBack })
    fireEvent.click(document.querySelector('.selection-title button'))
    expect(onBack).toHaveBeenCalled()
  })
})
