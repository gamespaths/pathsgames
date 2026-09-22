import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
// Card is "dumb": ConfigView passes entityType + handlers directly. Mock Card so
// `entityType` is the test id and onAction/onPreview stay wired.
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, onAction, onPreview, flagInformationCard, actionLabel }) => (
    <button
      data-testid={`cc-${entityType}`}
      data-action={String(!!onAction)}
      data-info={String(!!flagInformationCard)}
      onClick={() => { onAction?.(); onPreview?.() }}
    >{actionLabel}</button>
  ),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({ default: () => <div /> }))

import ConfigView from '../features/start-book/ConfigView'

const config = { character: { card: {} }, class: { card: {} }, traits: [], difficulty: { card: {} } }

// Every type offers two options, so every selectable card carries "Change".
const STORY_WITH_CHOICES = { classes: [{}, {}], characterTemplates: [{}, {}], traits: [{}, {}], difficulties: [{}, {}] }

function setup(props = {}) {
  const handlers = { onProceed: vi.fn(), onChangeClick: vi.fn(), onInfoClick: vi.fn(), onPreview: vi.fn() }
  render(
    <ConfigView
      config={config}
      story={STORY_WITH_CHOICES}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('ConfigView', () => {
  beforeEach(() => vi.clearAllMocks())

  // "Start Game" is the action of the second bonuses card; the old page footer is gone.
  it('advances to the start-game confirmation when "Start Game" is clicked', () => {
    const { onProceed } = setup()
    const bonusCards = screen.getAllByTestId('cc-bonuses')
    expect(bonusCards[0].getAttribute('data-action')).toBe('false')
    expect(bonusCards[1].textContent).toBe('book.start')
    fireEvent.click(screen.getByText('book.start'))
    expect(onProceed).toHaveBeenCalled()
    expect(document.querySelector('.page-footer')).toBeNull()
  })

  it('wires selectable cards (action + lens) to onChangeClick', () => {
    const { onChangeClick } = setup()
    fireEvent.click(screen.getByTestId('cc-class'))
    fireEvent.click(screen.getByTestId('cc-difficulty'))
    expect(onChangeClick).toHaveBeenCalledWith('class')
    expect(onChangeClick).toHaveBeenCalledWith('difficulty')
  })

  // The first bonuses card shows its (i), which opens the "character attributes" page
  // carrying the card's own badges; the second keeps its (i) hidden.
  it('wires the first bonuses card (i) to the character-attributes page', () => {
    const { onPreview } = setup()
    const bonusCards = screen.getAllByTestId('cc-bonuses')
    expect(bonusCards[0]).toHaveAttribute('data-info', 'true')
    expect(bonusCards[1]).toHaveAttribute('data-info', 'false')
    fireEvent.click(bonusCards[0])
    const [entity, type, , stats] = onPreview.mock.calls[0]
    expect(type).toBe('bonuses')
    expect(entity.card.title).toBe('book.characterAttributesTitle')
    expect(entity.card.description).toBe('book.characterAttributesDesc')
    expect(entity.card.urlImage).toBeTruthy()
    // An empty loadout has no non-zero attribute and this difficulty budgets nothing.
    expect(stats).toEqual([])
  })

  it('the attributes page lists the non-zero attributes, then the trait cost used/max', () => {
    const { onPreview } = setup({
      config: {
        character: { lifeMax: 20, dexterityStart: 2 }, class: {},
        traits: [{ costPositive: 1, sad: 1 }],
        difficulty: { traitCostPositiveBudget: 2 },
      },
    })
    fireEvent.click(screen.getAllByTestId('cc-bonuses')[0])
    const stats = onPreview.mock.calls[0][3]
    expect(stats.map(s => [s.key, s.value])).toEqual([['life', 20], ['sad', 1], ['dexterity', 2], ['costPositive', '1/2']])
  })

  it('wires the character and trait cards to onChangeClick', () => {
    const { onChangeClick } = setup()
    fireEvent.click(screen.getByTestId('cc-character'))
    fireEvent.click(screen.getByTestId('cc-trait'))
    expect(onChangeClick).toHaveBeenCalledWith('character')
    expect(onChangeClick).toHaveBeenCalledWith('trait')
  })

  // Both bonus cards preview the same statistics card, each with its own subset
  // of the totals: the first the characteristics, the second the pools.
  it('wires BOTH bonus cards to onPreview with their own statistics subset', () => {
    const { onPreview } = setup({
      // A loadout that actually produces totals, so the two subsets are non-empty.
      config: {
        character: { lifeMax: 20, energyMax: 8, dexterityStart: 2, intelligenceStart: 1, constitutionStart: 3 },
        class: { weightMax: 5, dexterityBase: 1 },
        traits: [{ life: 2, sad: 1 }],
        difficulty: { life: 1 },
      },
    })
    const bonusCards = screen.getAllByTestId('cc-bonuses')
    expect(bonusCards).toHaveLength(2)
    fireEvent.click(bonusCards[0])
    fireEvent.click(bonusCards[1])
    expect(onPreview).toHaveBeenCalledTimes(2)
    const [firstCard, firstType, firstLock, firstStats] = onPreview.mock.calls[0]
    const secondStats = onPreview.mock.calls[1][3]
    expect(firstType).toBe('bonuses')
    expect(firstLock).toBeNull()
    expect(firstCard).toBeTruthy()
    // The first page carries every non-zero attribute, the second the pools only (no trait
    // cost anywhere: this difficulty budgets neither side).
    expect(Object.fromEntries(firstStats.map(s => [s.key, s.value])))
      .toEqual({ life: 23, energy: 8, sad: 1, dexterity: 3, intelligence: 1, constitution: 3, weight: 5 })
    expect(secondStats.map(s => s.key).sort()).toEqual(['energy', 'life', 'sad'])
  })

  // The second bonus card reads the selection cost against the difficulty budgets:
  // "used/max" on a budgeted side, nothing on a side the difficulty leaves null or zero.
  it('the second bonus card carries the trait cost used/max of the selection', () => {
    const { onPreview } = setup({
      config: {
        character: {}, class: {},
        traits: [{ costPositive: 2, costNegative: 1 }, { costPositive: 1 }],
        difficulty: { traitCostPositiveBudget: 5 },
      },
    })
    fireEvent.click(screen.getAllByTestId('cc-bonuses')[1])
    const stats = onPreview.mock.calls[0][3]
    const byKey = Object.fromEntries(stats.map(s => [s.key, s]))
    expect(byKey.costPositive.value).toBe('3/5')
    expect(byKey.costNegative).toBeUndefined()
    expect(byKey.costPositive.keepZero).toBe(true)
  })

  // A type with a single option has nothing to change: the card loses "Change" and its (i)
  // asks the book for the detail (onInfoClick) instead of the selection list.
  it('single-option cards drop the action and wire the (i) to onInfoClick', () => {
    const { onChangeClick, onInfoClick } = setup({
      story: { classes: [{}], characterTemplates: [{}], traits: [{}], difficulties: [{}, {}] },
    })
    for (const type of ['class', 'character', 'trait']) {
      const card = screen.getByTestId(`cc-${type}`)
      expect(card).toHaveAttribute('data-action', 'false')
      expect(card).toHaveAttribute('data-info', 'true')
      fireEvent.click(card)
      expect(onInfoClick).toHaveBeenCalledWith(type)
    }
    expect(onChangeClick).not.toHaveBeenCalled()
    // The difficulty still has a choice, so it keeps "Change".
    const difficulty = screen.getByTestId('cc-difficulty')
    expect(difficulty).toHaveAttribute('data-action', 'true')
    fireEvent.click(difficulty)
    expect(onChangeClick).toHaveBeenCalledWith('difficulty')
  })

  it('hidden traits do not count as a choice', () => {
    const { onInfoClick } = setup({
      story: { ...STORY_WITH_CHOICES, traits: [{ uuid: 't1' }, { uuid: 't2', hideOnStartMatch: true }] },
    })
    fireEvent.click(screen.getByTestId('cc-trait'))
    expect(onInfoClick).toHaveBeenCalledWith('trait')
  })

  it('a single-option card without onInfoClick does not crash on (i)', () => {
    setup({ story: {}, onInfoClick: undefined })
    fireEvent.click(screen.getByTestId('cc-class'))
  })

  it('renders without crashing when story content lists are missing', () => {
    const { onProceed } = setup({ story: {}, config: { character: { card: {} }, class: { card: {} }, traits: undefined, difficulty: { card: {} } } })
    fireEvent.click(screen.getByText('book.start'))
    expect(onProceed).toHaveBeenCalled()
  })
})
