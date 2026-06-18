import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ story }) => <div data-testid="hero-card">{story?.title}</div>,
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

  it('renders OptionPicker when a card is being changed', () => {
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
})
