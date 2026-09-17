import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k }),
}))

let capturedProps = null
vi.mock('@/components/layout/Card', () => ({
  default: (props) => {
    capturedProps = props
    const { card, onAction, onClose, variant } = props
    return (
      <div data-testid="exp-card">
        <span data-testid="card-title">{card?.title}</span>
        <span data-testid="variant">{variant ?? 'little'}</span>
        {onAction && <button data-testid="action-btn" onClick={onAction}>open</button>}
        {onClose && <button data-testid="close-btn" onClick={onClose}>close</button>}
      </div>
    )
  },
}))

import ExperienceCard from '../features/gameplay/cards/ExperienceCard'
import { expSummaryProps } from '../features/gameplay/js/boardProps'

describe('ExperienceCard (Step 38)', () => {
  it('little: the board card carries the experience held and opens the training page', () => {
    const onOpen = vi.fn()
    render(<ExperienceCard onOpen={onOpen} experience={30} expCosts={{ dex: 12, int: null, cos: 8 }} />)
    expect(screen.getByTestId('card-title').textContent).toBe('game.exp.title')
    expect(capturedProps.entityType).toBe('experience')
    expect(capturedProps.actionLabel).toBe('game.exp.open')
    expect(capturedProps.statistics).toEqual([{ key: 'experience', value: '30', label: 'game.stats.experience' }])
    fireEvent.click(screen.getByTestId('action-btn'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('page: the left page lists the experience and the price of every stat, "Max" at the cap', () => {
    const onClose = vi.fn()
    render(<ExperienceCard variant="page" onClose={onClose} experience={30}
                           expCosts={{ dex: 12, int: null, cos: 8 }} />)
    expect(screen.getByTestId('variant').textContent).toBe('page')
    expect(capturedProps.card.description).toBe('game.exp.description')
    expect(capturedProps.statItemsToPageContent).toEqual([
      { key: 'experience', value: '30', label: 'game.stats.experience' },
      { key: 'dexterity', value: '12', label: 'game.stats.dexterity' },
      { key: 'intelligence', value: 'game.exp.atMax', label: 'game.stats.intelligence' },
      { key: 'constitution', value: '8', label: 'game.stats.constitution' },
    ])
    fireEvent.click(screen.getByTestId('close-btn'))
    expect(onClose).toHaveBeenCalled()
  })

  it('defaults to 0 experience and a capped price list when /info carries neither', () => {
    render(<ExperienceCard variant="page" />)
    expect(capturedProps.statItemsToPageContent[0].value).toBe('0')
    expect(capturedProps.statItemsToPageContent[1].value).toBe('game.exp.atMax')
    expect(expSummaryProps(null)).toEqual({ experience: 0, expCosts: null })
    expect(expSummaryProps({ experience: 5, expCosts: { dex: 1 } })).toEqual({ experience: 5, expCosts: { dex: 1 } })
  })
})
