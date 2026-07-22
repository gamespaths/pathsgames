import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

// ChoiceCard is exercised in its own suite; here it is a stub that surfaces the option
// name and its onSelect wiring, so the list's composition and the do-nothing exit are
// what gets tested.
vi.mock('../features/gameplay/cards/ChoiceCard', () => ({
  default: ({ choice, onSelect, onPreview }) => (
    <div data-testid="choice-card">
      <span data-testid="choice-name">{choice?.name}</span>
      <button data-testid={`select-${choice.uuid}`} onClick={() => onSelect?.(choice)}>do</button>
      <button data-testid={`preview-${choice.uuid}`} onClick={() => onPreview?.()}>preview</button>
    </div>
  ),
}))

// The do-nothing entry is a plain Card; stub it to expose its action.
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, entityType, onAction }) => (
    <div data-testid={`card-${entityType}`}>
      <span>{card?.title}</span>
      {onAction && <button data-testid="do-nothing-btn" onClick={onAction}>x</button>}
    </div>
  ),
}))

import PendingChoicesList from '../features/gameplay/cards/PendingChoicesList'

const STORY = { uuid: 's1' }
const CHOICES = [
  { uuid: 'c1', name: 'Gold Door', available: true },
  { uuid: 'c2', name: 'Runes', available: false, reason: 'CONDITION_STATISTICS_NOT_MET' },
]

beforeEach(() => vi.clearAllMocks())

describe('PendingChoicesList (Step 31)', () => {
  it('renders one card per option plus a do-nothing card', () => {
    render(<PendingChoicesList story={STORY} choices={CHOICES}
      onPreview={vi.fn()} onSelect={vi.fn()} onDoNothing={vi.fn()} />)
    expect(screen.getAllByTestId('choice-card')).toHaveLength(2)
    expect(screen.getByText('Gold Door')).toBeInTheDocument()
    expect(screen.getByText('Runes')).toBeInTheDocument()
    expect(screen.getByTestId('card-choice-none')).toBeInTheDocument()
  })

  it('forwards a pick to onSelect', () => {
    const onSelect = vi.fn()
    render(<PendingChoicesList story={STORY} choices={CHOICES}
      onPreview={vi.fn()} onSelect={onSelect} onDoNothing={vi.fn()} />)
    fireEvent.click(screen.getByTestId('select-c1'))
    expect(onSelect).toHaveBeenCalledWith(CHOICES[0])
  })

  it('the do-nothing card ends the event via onDoNothing', () => {
    const onDoNothing = vi.fn()
    render(<PendingChoicesList story={STORY} choices={CHOICES}
      onPreview={vi.fn()} onSelect={vi.fn()} onDoNothing={onDoNothing} />)
    fireEvent.click(screen.getByTestId('do-nothing-btn'))
    expect(onDoNothing).toHaveBeenCalledTimes(1)
  })

  it('still offers the do-nothing exit with no options', () => {
    render(<PendingChoicesList story={STORY} choices={[]}
      onPreview={vi.fn()} onSelect={vi.fn()} onDoNothing={vi.fn()} />)
    expect(screen.queryAllByTestId('choice-card')).toHaveLength(0)
    expect(screen.getByTestId('card-choice-none')).toBeInTheDocument()
  })
})
