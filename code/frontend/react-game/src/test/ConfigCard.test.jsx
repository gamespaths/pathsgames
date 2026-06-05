import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))

// Mock GameCard to expose the prop wiring ConfigCard computes (the branch logic).
vi.mock('../components/layout/GameCard', () => ({
  default: (props) => (
    <div
      data-testid="gamecard"
      data-name={props.name ?? ''}
      data-disabled={props.disabled ? 'y' : 'n'}
      data-single={props.singleOption ? 'y' : 'n'}
      data-hasaction={props.onAction ? 'y' : 'n'}
      data-hasselect={props.onSelect ? 'y' : 'n'}
      data-haspreview={props.onPreview ? 'y' : 'n'}
    />
  ),
}))

import ConfigCard from '../features/start-book/ConfigCard'

const value = { name: 'Knight', icon: 'fa-chess-knight', card: {} }

describe('ConfigCard', () => {
  it('multi-option card wires action + select + preview handlers', () => {
    render(
      <ConfigCard
        type="class" value={value} story={{}} count={3}
        onChangeClick={vi.fn()} onSelect={vi.fn()} onPreview={vi.fn()} onPagePreview={vi.fn()}
      />
    )
    const gc = screen.getByTestId('gamecard')
    expect(gc.dataset.single).toBe('n')
    expect(gc.dataset.hasaction).toBe('y')
    expect(gc.dataset.hasselect).toBe('y')
    expect(gc.dataset.haspreview).toBe('y')
    expect(gc.dataset.name).toBe('Knight')
  })

  it('single-option card drops action/select and previews via onPagePreview', () => {
    render(
      <ConfigCard
        type="class" value={value} count={1}
        onChangeClick={vi.fn()} onSelect={vi.fn()} onPreview={vi.fn()} onPagePreview={vi.fn()}
      />
    )
    const gc = screen.getByTestId('gamecard')
    expect(gc.dataset.single).toBe('y')
    expect(gc.dataset.hasaction).toBe('n')
    expect(gc.dataset.hasselect).toBe('n')
    expect(gc.dataset.haspreview).toBe('y')
  })

  it('locked card is disabled', () => {
    render(<ConfigCard type="gameType" value={value} locked onPreview={vi.fn()} />)
    expect(screen.getByTestId('gamecard').dataset.disabled).toBe('y')
  })

  it('has no preview handler when onPreview is absent on a multi-option card', () => {
    render(
      <ConfigCard
        type="class" value={value} count={3}
        onChangeClick={vi.fn()} onSelect={vi.fn()} onPagePreview={vi.fn()}
      />
    )
    expect(screen.getByTestId('gamecard').dataset.haspreview).toBe('n')
  })
})
