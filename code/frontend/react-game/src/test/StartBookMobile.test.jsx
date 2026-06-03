import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/book/BookPageContent', () => ({
  default: ({ story }) => <div data-testid="hero-card">{story?.title}</div>,
}))
vi.mock('../features/startBook/ConfigView', () => ({
  default: ({ onProceed, onChangeClick }) => (
    <div data-testid="config-view">
      <button onClick={onProceed}>proceed</button>
      <button onClick={() => onChangeClick('class')}>change-class</button>
    </div>
  ),
}))
vi.mock('../features/startBook/StartGameView', () => ({
  default: ({ onStartGame, onBack }) => (
    <div data-testid="start-game-view">
      <button onClick={() => onStartGame('tok')}>start</button>
      <button onClick={onBack}>back-confirm</button>
    </div>
  ),
}))
vi.mock('../features/startBook/SelectionView', () => ({
  default: ({ type, onBack }) => (
    <div data-testid={`selection-${type}`}>
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

import StartBookMobile from '../features/startBook/StartBookMobile'

const STORY = { title: 'Forest Quest', card: { urlImage: 'x.png' }, description: 'desc' }
const config = { character: null, class: null, trait: null, difficulty: null }

function setup(props = {}) {
  const handlers = {
    onChangeClick: vi.fn(),
    onPreview: vi.fn(),
    onProceed: vi.fn(),
    onBackConfirm: vi.fn(),
    onSelect: vi.fn(),
    onBackSelection: vi.fn(),
    onStartGame: vi.fn(),
    setTermsAccepted: vi.fn(),
  }
  render(
    <StartBookMobile
      activeStory={STORY}
      config={config}
      loadingDetail={false}
      selectionType={null}
      confirming={false}
      termsAccepted={true}
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

  it('renders StartGameView when confirming', () => {
    setup({ confirming: true })
    expect(screen.getByTestId('start-game-view')).toBeInTheDocument()
  })

  it('renders SelectionView when a card is being changed', () => {
    setup({ selectionType: 'class' })
    expect(screen.getByTestId('selection-class')).toBeInTheDocument()
  })

  it('wires the proceed action to onProceed', () => {
    const { onProceed } = setup()
    fireEvent.click(screen.getByText('proceed'))
    expect(onProceed).toHaveBeenCalled()
  })

  it('Start Game button advances via onProceed', () => {
    const { onProceed } = setup()
    fireEvent.click(screen.getByText('book.startGame'))
    expect(onProceed).toHaveBeenCalled()
  })

  it('hides the Start Game CTA while confirming', () => {
    setup({ confirming: true })
    expect(screen.queryByText('book.startGame')).not.toBeInTheDocument()
  })
})
