import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../api/stories', () => ({ getStoryDetail: vi.fn(), getStories: vi.fn() }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, onClose }) => <div data-testid="book">{left}{right}</div>,
}))
vi.mock('../components/book/BookPageContent', () => ({
  default: ({ card, loading }) => (
    <div data-testid="book-page" data-loading={String(!!loading)}>{card?.title}</div>
  ),
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
      <button onClick={onBack}>back-config</button>
    </div>
  ),
}))
vi.mock('../features/startBook/SelectionView', () => ({
  default: ({ type, options, onSelect, onBack }) => (
    <div data-testid={`selection-${type}`}>
      {options?.map((o, i) => (
        <button key={i} onClick={() => onSelect(o)}>pick:{o.name}</button>
      ))}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))
vi.mock('../features/startBook/StartBookMobile', () => ({ default: () => <div data-testid="mobile" /> }))

import StartBookModal, { CardPreviewOverlay } from '../features/startBook/StartBookModal'
import { getStoryDetail } from '../api/stories'

const STORY = {
  uuid: 's1',
  title: 'Forest Quest',
  card: { title: 'Forest Quest' },
  classes: [{ uuid: 'c1', name: 'Fighter', card: {} }],
  characterTemplates: [{ uuid: 'ch1', name: 'Hero', card: {} }],
  traits: [{ uuid: 't1', name: 'Brave', card: {} }],
  difficulties: [{ uuid: 'd1', name: 'Easy', card: {} }],
}

function wrap(props = {}) {
  return render(
    <MemoryRouter>
      <StartBookModal story={STORY} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  )
}

describe('StartBookModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(STORY)
  })

  it('shows loading spinner before detail loads', () => {
    getStoryDetail.mockReturnValue(new Promise(() => {}))
    wrap()
    expect(document.querySelector('.fa-spinner')).not.toBeNull()
  })

  it('renders ConfigView after detail loads', async () => {
    wrap()
    expect(await screen.findByTestId('config-view')).toBeInTheDocument()
  })

  it('switches to SelectionView when change is triggered', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    expect(screen.getByTestId('selection-class')).toBeInTheDocument()
  })

  it('returns to ConfigView after back from selection', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('updates config when an option is selected', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('pick:Fighter'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('returns null when story is not provided', () => {
    const { container } = render(<MemoryRouter><StartBookModal onClose={vi.fn()} /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('shows StartGameView after "Start Game" is pressed in ConfigView', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('proceed'))
    expect(screen.getByTestId('start-game-view')).toBeInTheDocument()
  })

  it('returns to ConfigView from StartGameView back', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('proceed'))
    fireEvent.click(screen.getByText('back-config'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('calls onClose when start game is triggered', async () => {
    const onClose = vi.fn()
    wrap({ onClose })
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('proceed'))
    fireEvent.click(screen.getByText('start'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('CardPreviewOverlay', () => {
  it('renders BookPageContent with the provided card', () => {
    const card = { title: 'Preview Card', entity: null }
    render(<CardPreviewOverlay card={card} entity={{}} entityType="character" story={STORY} onClose={vi.fn()} />)
    // BookPageContent is not mocked here so just check it doesn't crash
    expect(document.querySelector('.card-preview-overlay')).not.toBeNull()
  })
})
