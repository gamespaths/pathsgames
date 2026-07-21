import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
// Card is "dumb": ConfigView passes entityType + handlers directly. Mock Card so
// `entityType` is the test id and onAction/onPreview stay wired.
vi.mock('../components/layout/Card', () => ({
  default: ({ entityType, onAction, onPreview }) => (
    <button
      data-testid={`cc-${entityType}`}
      onClick={() => { onAction?.(); onPreview?.() }}
    />
  ),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({ default: () => <div /> }))

import ConfigView from '../features/start-book/ConfigView'

const config = { character: { card: {} }, class: { card: {} }, traits: [], difficulty: { card: {} } }

function setup(props = {}) {
  const handlers = { onProceed: vi.fn(), onChangeClick: vi.fn(), onPreview: vi.fn() }
  render(
    <ConfigView
      config={config}
      story={{ classes: [{}, {}], characterTemplates: [{}], traits: [{}], difficulties: [{}] }}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('ConfigView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('advances to the start-game confirmation when "Start Game" is clicked', () => {
    const { onProceed } = setup()
    fireEvent.click(screen.getByText('book.startGame'))
    expect(onProceed).toHaveBeenCalled()
  })

  it('wires selectable cards (action + lens) to onChangeClick', () => {
    const { onChangeClick } = setup()
    fireEvent.click(screen.getByTestId('cc-class'))
    fireEvent.click(screen.getByTestId('cc-difficulty'))
    expect(onChangeClick).toHaveBeenCalledWith('class')
    expect(onChangeClick).toHaveBeenCalledWith('difficulty')
  })

  it('wires the information (bonuses) cards to onPreview', () => {
    const { onPreview } = setup()
    fireEvent.click(screen.getAllByTestId('cc-bonuses')[0])
    expect(onPreview).toHaveBeenCalled()
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
    // The first card carries the characteristics, the second the pools.
    expect(firstStats.map(s => s.key).sort()).toEqual(['constitution', 'dexterity', 'intelligence'])
    expect(secondStats.map(s => s.key).sort()).toEqual(['energy', 'life', 'sad', 'weight'])
  })

  it('renders without crashing when story content lists are missing', () => {
    const { onProceed } = setup({ story: {}, config: { character: { card: {} }, class: { card: {} }, traits: undefined, difficulty: { card: {} } } })
    fireEvent.click(screen.getByText('book.startGame'))
    expect(onProceed).toHaveBeenCalled()
  })
})
