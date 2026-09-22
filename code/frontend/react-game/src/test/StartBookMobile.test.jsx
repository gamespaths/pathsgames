import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ story, card, onClose }) => (
    <div data-testid="hero-card">
      {story?.title}{card?.title ? ` / ${card.title}` : ''}
      {onClose && <button onClick={onClose}>detail-back</button>}
    </div>
  ),
}))
vi.mock('../features/start-book/ConfigView', () => ({
  default: ({ onProceed, onChangeClick }) => (
    <div data-testid="config-view">
      <button onClick={onProceed}>proceed</button>
      <button onClick={() => onChangeClick('class')}>change-class</button>
    </div>
  ),
}))
vi.mock('../features/start-book/OptionPicker', () => ({
  default: ({ type, onBack }) => (
    <div data-testid={`selection-${type}`}>
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

import StartBookMobile from '../features/start-book/StartBookMobile'

const STORY = { title: 'Forest Quest', card: { urlImage: 'x.png' }, description: 'desc' }
const config = { character: null, class: null, traits: [], difficulty: null }

function setup(props = {}) {
  const handlers = {
    onChangeClick: vi.fn(),
    onPreview: vi.fn(),
    onProceed: vi.fn(),
    onSelect: vi.fn(),
    onBackSelection: vi.fn(),
  }
  render(
    <StartBookMobile
      activeStory={STORY}
      config={config}
      loadingDetail={false}
      selectionType={null}
      getOptionsForType={() => []}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('StartBookMobile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the story header and ConfigView by default', () => {
    setup()
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
    expect(screen.getByTestId('hero-card')).toHaveTextContent('Forest Quest')
  })

  it('shows a spinner while the detail is loading', () => {
    setup({ loadingDetail: true })
    expect(document.querySelector('.fa-spinner')).not.toBeNull()
    expect(screen.queryByTestId('config-view')).not.toBeInTheDocument()
  })

  // A single-option card's (i): the detail page replaces the whole column, back returns.
  it('renders the selected entity detail when detailType is set, with back wired to onBackSelection', () => {
    const { onBackSelection } = setup({
      detailType: 'class',
      config: { ...config, class: { uuid: 'c1', card: { title: 'Fighter card' } } },
    })
    expect(screen.queryByTestId('config-view')).not.toBeInTheDocument()
    expect(screen.getByTestId('hero-card')).toHaveTextContent('Fighter card')
    fireEvent.click(screen.getByText('detail-back'))
    expect(onBackSelection).toHaveBeenCalled()
  })

  it('renders OptionPicker when a card is being changed', () => {
    setup({ selectionType: 'class' })
    expect(screen.getByTestId('selection-class')).toBeInTheDocument()
  })

  // v0.38.3 — the picker draws no back arrow any more (the desktop left page carries it),
  // so the mobile column draws its own above the list.
  it('draws its own back arrow over the picker', () => {
    const { onBackSelection } = setup({ selectionType: 'class' })
    fireEvent.click(screen.getByRole('button', { name: 'book.back' }))
    expect(onBackSelection).toHaveBeenCalled()
  })

  it('wires the proceed action to onProceed', () => {
    const { onProceed } = setup()
    fireEvent.click(screen.getByText('proceed'))
    expect(onProceed).toHaveBeenCalled()
  })

  // The start action lives on the ConfigView bonuses card now: no separate button below it.
  it('renders no standalone Start Game button under the config', () => {
    setup()
    expect(screen.queryByText('book.startGame')).toBeNull()
    expect(document.querySelector('.btn-start-game')).toBeNull()
  })
})
