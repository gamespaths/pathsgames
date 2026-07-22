import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// A small dictionary so known keys resolve (the fallback logic treats a key-returns-key
// miss as "unknown", so an identity t() would collapse every reason to the fallback).
const DICT = {
  'game.choices.do': 'Do',
  'game.choices.unavailable': 'Unavailable',
  'game.choices.reason.CONDITION_STATISTICS_NOT_MET': 'Stats',
}
vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => DICT[k] ?? k }),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onPreview, onSelect, entityType, flagInformationCard, locked, lockInfo } = props
    return (
      <div data-testid="choice-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="entity-type">{entityType}</span>
        <span data-testid="info-flag">{String(!!flagInformationCard)}</span>
        <span data-testid="locked">{String(!!locked)}</span>
        <span data-testid="lock-info">{lockInfo ?? ''}</span>
        {onPreview && <button data-testid="preview-btn" onClick={onPreview}>preview</button>}
        {onSelect && <button data-testid="select-btn" onClick={onSelect}>do</button>}
      </div>
    )
  },
}))

import ChoiceCard, { choiceReasonLabel } from '../features/gameplay/cards/ChoiceCard'

const STORY = { uuid: 's1', title: 'Story' }
const AVAILABLE = {
  uuid: 'c1', name: 'Gold Door', available: true, reason: null,
  card: { title: 'The gold door', description: 'It glows.' },
}
const LOCKED = {
  uuid: 'c2', name: 'Runes', available: false, reason: 'CONDITION_STATISTICS_NOT_MET',
}

beforeEach(() => { capturedProps = null })

describe('ChoiceCard (Step 31)', () => {
  it('renders an available option as an information card with a Do action and the (i) lens', () => {
    render(<ChoiceCard choice={AVAILABLE} story={STORY} onPreview={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('The gold door')
    expect(screen.getByTestId('entity-type').textContent).toBe('choice')
    expect(screen.getByTestId('info-flag').textContent).toBe('true')
    expect(screen.getByTestId('select-btn')).toBeInTheDocument()   // quick Do (select)
    expect(screen.getByTestId('preview-btn')).toBeInTheDocument()   // (i) lens
    // Convention: never pass `label` to Card.
    expect(capturedProps.label).toBeUndefined()
    expect(capturedProps.selectLabel).toBe('Do')
  })

  it('falls back to a card built from the option fields when it has no card', () => {
    render(<ChoiceCard choice={{ uuid: 'c9', name: 'Improvise', description: 'wing it', available: true }}
      story={STORY} onPreview={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByTestId('card-title').textContent).toBe('Improvise')
  })

  it('the Do button selects the option (Step 32 will apply it)', () => {
    const onSelect = vi.fn()
    render(<ChoiceCard choice={AVAILABLE} story={STORY} onPreview={vi.fn()} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('select-btn'))
    expect(onSelect).toHaveBeenCalledWith(AVAILABLE)
  })

  it("the enlarged preview offers only Do for an available option", () => {
    const onPreview = vi.fn()
    const onSelect = vi.fn()
    render(<ChoiceCard choice={AVAILABLE} story={STORY} onPreview={onPreview}
      onSelect={onSelect} previewSide="right" />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    const [card, type, , , , additionalProps, side] = onPreview.mock.calls[0]
    expect(card).toEqual(AVAILABLE.card)
    expect(type).toBe('choice')
    expect(side).toBe('right')
    // Only "Do" — the preview exposes the select action and nothing else.
    expect(additionalProps.actionLabel).toBe('Do')
    expect(typeof additionalProps.onAction).toBe('function')
    additionalProps.onAction()
    expect(onSelect).toHaveBeenCalledWith(AVAILABLE)
  })

  it('renders a locked option greyed with its reason and no Do', () => {
    render(<ChoiceCard choice={LOCKED} story={STORY} onPreview={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByTestId('locked').textContent).toBe('true')
    expect(screen.getByTestId('lock-info').textContent).toBe('Stats')
    expect(screen.queryByTestId('select-btn')).toBeNull()
    expect(capturedProps.label).toBeUndefined()
  })

  it("a locked option's preview shows the reason, not a Do action", () => {
    const onPreview = vi.fn()
    render(<ChoiceCard choice={LOCKED} story={STORY} onPreview={onPreview} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-btn'))
    const additionalProps = onPreview.mock.calls[0][5]
    expect(additionalProps.onAction).toBeUndefined()
    expect(additionalProps.extraContent).toBe('Stats')
  })

  it('uses the shared reason→icon table for the lock icon', () => {
    render(<ChoiceCard choice={LOCKED} story={STORY} onPreview={vi.fn()} onSelect={vi.fn()} />)
    // CONDITION_STATISTICS_NOT_MET is not in the table → the fallback "you cannot" icon.
    expect(capturedProps.lockedIcon).toBe('fas fa-ban')
  })

  it('an unknown reason code falls back to the generic unavailable label', () => {
    render(<ChoiceCard choice={{ uuid: 'c3', name: 'X', available: false, reason: 'WHAT' }}
      story={STORY} onPreview={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByTestId('lock-info').textContent).toBe('Unavailable')
  })
})

describe('choiceReasonLabel', () => {
  const t = (k) => (k === 'game.choices.reason.CONDITION_ITEM_NOT_MET' ? 'Item' : k)
  it('translates a known reason', () => {
    expect(choiceReasonLabel(t, 'CONDITION_ITEM_NOT_MET')).toBe('Item')
  })
  it('falls back to unavailable for a missing key or no reason', () => {
    expect(choiceReasonLabel(t, 'NOPE')).toBe('game.choices.unavailable')
    expect(choiceReasonLabel(t, null)).toBe('game.choices.unavailable')
  })
})
