import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../features/start-book/ConfigCard', () => ({
  default: ({ type, onChangeClick, onPreview, onPagePreview }) => (
    <button
      data-testid={`cc-${type}`}
      onClick={() => { onChangeClick?.(); onPreview?.(); onPagePreview?.('v', type) }}
    />
  ),
}))
vi.mock('../components/ui/BonusBadgeList', () => ({ default: () => <div /> }))

import ConfigView from '../features/start-book/ConfigView'

const config = { character: null, class: null, traits: [], difficulty: null }

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

  it('wires selectable cards to onChangeClick and the page preview', () => {
    const { onChangeClick, onPreview } = setup()
    fireEvent.click(screen.getByTestId('cc-class'))
    fireEvent.click(screen.getByTestId('cc-difficulty'))
    expect(onChangeClick).toHaveBeenCalledWith('class')
    expect(onChangeClick).toHaveBeenCalledWith('difficulty')
    // selectable cards route onPagePreview → ConfigView onPreview
    expect(onPreview).toHaveBeenCalled()
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

  it('renders without crashing when story content lists are missing', () => {
    const { onProceed } = setup({ story: {}, config: { character: null, class: null, traits: undefined, difficulty: null } })
    fireEvent.click(screen.getByText('book.startGame'))
    expect(onProceed).toHaveBeenCalled()
  })
})
