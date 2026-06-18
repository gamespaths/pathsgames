import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ name, locked, onSelect, onPreview, lockedReason }) => (
    <div data-testid="game-card" data-locked={String(!!locked)} data-locked-reason={lockedReason ?? ''}>
      <span>{name}</span>
      {!locked && onSelect && <button onClick={onSelect}>select</button>}
      {onPreview && <button onClick={onPreview}>preview</button>}
    </div>
  ),
}))

import StartBookSelectionView from '../features/start-book/OptionPicker'

const OPTIONS = [
  { uuid: 'o1', name: 'Warrior', card: { title: 'Warrior' } },
  { uuid: 'o2', name: 'Mage',    card: { title: 'Mage'    } },
]

const STORY = {
  classes: [{ uuid: 'c1', name: 'Fighter', card: { title: 'Fighter' } }],
}

const CONFIG = { class: { uuid: 'c1' }, character: null, traits: [], difficulty: null }

describe('StartBook SelectionView', () => {
  it('renders all options', () => {
    render(
      <StartBookSelectionView type="character" options={OPTIONS} selected={null}
        story={STORY} config={CONFIG} onSelect={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByText('Warrior')).toBeInTheDocument()
    expect(screen.getByText('Mage')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(
      <StartBookSelectionView type="character" options={OPTIONS} selected={null}
        story={STORY} config={CONFIG} onSelect={vi.fn()} onBack={onBack} />
    )
    // Back button has only the arrow icon (no text)
    fireEvent.click(screen.getByRole('button', { name: '' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('calls onSelect with the correct option when select button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <StartBookSelectionView type="character" options={OPTIONS} selected={null}
        story={STORY} config={CONFIG} onSelect={onSelect} onBack={vi.fn()} />
    )
    fireEvent.click(screen.getAllByText('select')[0])
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0])
  })

  it('calls onPreview when preview button is clicked', () => {
    const onPreview = vi.fn()
    render(
      <StartBookSelectionView type="character" options={OPTIONS} selected={null}
        story={STORY} config={CONFIG} onSelect={vi.fn()} onBack={vi.fn()} onPreview={onPreview} />
    )
    fireEvent.click(screen.getAllByText('preview')[0])
    expect(onPreview).toHaveBeenCalled()
  })

  it('renders with empty options list without crash', () => {
    const { container } = render(
      <StartBookSelectionView type="trait" options={[]} selected={null}
        story={STORY} config={CONFIG} onSelect={vi.fn()} onBack={vi.fn()} />
    )
    expect(container).toBeInTheDocument()
  })

  it('renders with no onPreview prop (no preview buttons)', () => {
    render(
      <StartBookSelectionView type="trait" options={OPTIONS} selected={null}
        story={STORY} config={CONFIG} onSelect={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.queryByText('preview')).toBeNull()
  })
})
