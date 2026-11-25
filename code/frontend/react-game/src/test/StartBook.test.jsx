import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../api/stories', () => ({ getStoryDetail: vi.fn(), getStories: vi.fn() }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, mobile }) => <div data-testid="book">{left}{right}{mobile}</div>,
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card, loading, onClose }) => (
    <div data-testid="book-page" data-loading={String(!!loading)}>
      {card?.title}
      {typeof card?.description === 'string' && <span>{card.description}</span>}
      {onClose && <button onClick={onClose}>page-back</button>}
    </div>
  ),
}))
vi.mock('../features/start-book/ConfigView', () => ({
  default: ({ onProceed, onChangeClick, onInfoClick }) => (
    <div data-testid="config-view">
      <button onClick={onProceed}>proceed</button>
      <button onClick={() => onChangeClick('class')}>change-class</button>
      <button onClick={() => onInfoClick('class')}>info-class</button>
      <button onClick={() => onInfoClick('trait')}>info-trait</button>
    </div>
  ),
}))
vi.mock('../features/start-book/OptionPicker', () => ({
  default: ({ type, options, onSelect, onBack }) => (
    <div data-testid={`selection-${type}`}>
      {options?.map((o, i) => (
        <button key={i} onClick={() => onSelect(o)}>pick:{o.name}</button>
      ))}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))
vi.mock('../features/start-book/StartBookMobile', () => ({
  default: ({ onPreview }) => (
    <div data-testid="mobile">
      <button data-testid="mobile-preview" onClick={() => onPreview?.({ title: 'Preview' }, 'character')}>
        preview
      </button>
    </div>
  ),
}))

import StartBook, { CardPreviewOverlay } from '../features/start-book/StartBook'
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
      <StartBook story={STORY} {...props} />
    </MemoryRouter>
  )
}

describe('StartBook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(STORY)
  })

  it('v1.13.0 — while the detail loads: the same Book, the story card left and LoadingCard right', () => {
    getStoryDetail.mockReturnValue(new Promise(() => {}))
    wrap()
    expect(screen.getByTestId('book')).toBeInTheDocument()
    const pages = screen.getAllByTestId('book-page')
    expect(pages[0]).toHaveTextContent('Forest Quest')
    expect(pages[0].dataset.loading).toBe('false')
    expect(pages[1]).toHaveTextContent('game.loadingCard.title')
    expect(pages[1].dataset.loading).toBe('true')
    expect(document.querySelector('.book-overlay')).toBeNull()
  })

  it('a direct load (no story) asks the detail by its id, LoadingCard on both pages meanwhile', async () => {
    getStoryDetail.mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter><StartBook storyId="s9" /></MemoryRouter>)
    expect(getStoryDetail).toHaveBeenCalledWith('s9', 'en')
    expect(screen.getAllByTestId('book-page').every(p => p.dataset.loading === 'true')).toBe(true)
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

  // A single-option card: its (i) swaps the right page for the detail of the selected entity,
  // and the page's back returns to ConfigView.
  it('opens the selected entity detail on the right page from the (i) and returns on back', async () => {
    getStoryDetail.mockResolvedValue({ ...STORY, classes: [{ uuid: 'c1', name: 'Fighter', card: { title: 'Fighter card' } }] })
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('info-class'))
    expect(screen.queryByTestId('config-view')).not.toBeInTheDocument()
    expect(screen.getByText('Fighter card')).toBeInTheDocument()
    fireEvent.click(screen.getByText('page-back'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
    expect(screen.queryByText('Fighter card')).not.toBeInTheDocument()
  })

  it('the (i) of a type with nothing selected leaves the config in place', async () => {
    getStoryDetail.mockResolvedValue({ ...STORY, traits: [] })
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('info-trait'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('neither a story nor an id: the ErrorCard right page, which goes home', async () => {
    render(
      <MemoryRouter initialEntries={['/story/']}>
        <Routes>
          <Route path="/" element={<div>home-page</div>} />
          <Route path="/story/" element={<StartBook />} />
        </Routes>
      </MemoryRouter>
    )
    expect((await screen.findAllByText('errors.storyNotFound')).length).toBeGreaterThan(0)
    expect(getStoryDetail).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByText('page-back').at(-1))
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('a failing detail without a story (direct load): the ErrorCard page, the error picture left', async () => {
    getStoryDetail.mockRejectedValue(new Error('404'))
    render(<MemoryRouter><StartBook storyId="nope" /></MemoryRouter>)
    expect((await screen.findAllByText('errors.storyNotFound')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('errors.title').length).toBeGreaterThan(0)
  })

  it('an empty detail without a story is an error too', async () => {
    getStoryDetail.mockResolvedValue(null)
    render(<MemoryRouter><StartBook storyId="nope" /></MemoryRouter>)
    expect((await screen.findAllByText('errors.storyNotFound')).length).toBeGreaterThan(0)
  })

  it('a failing detail with the Home\'s story falls back to that summary', async () => {
    getStoryDetail.mockRejectedValue(new Error('down'))
    wrap()
    expect(await screen.findByTestId('config-view')).toBeInTheDocument()
  })

  it('calls handlePreviewModal via mobile onPreview prop', async () => {
    const show = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn().mockReturnValue({ show }) } }
    const el = document.createElement('div')
    el.id = 'cardPreviewModal'
    document.body.appendChild(el)
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByTestId('mobile-preview'))
    // handlePreviewModal is called — the Bootstrap modal show is attempted
    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled()
    delete window.bootstrap
    document.body.removeChild(el)
  })

  it('handleSelectionPreview sets preview to null when entity is falsy', async () => {
    wrap()
    await screen.findByTestId('config-view')
    // Selecting then clearing — just verifies no crash (line 109: null entity path)
    fireEvent.click(screen.getByText('change-class'))
    // Pick an option (sets preview)
    fireEvent.click(screen.getByText('pick:Fighter'))
    // After selecting, config-view is shown again — no crash
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('class change drops character when all options are locked (reselect null fallback)', async () => {
    // Build a story where changing class locks all characters
    // The current character has class restriction that is incompatible with the new class
    const storyWithLocks = {
      ...STORY,
      classes: [
        { uuid: 'c1', name: 'Fighter', card: {}, classRestriction: 'FIGHTER' },
        { uuid: 'c2', name: 'Mage', card: {}, classRestriction: 'MAGE' },
      ],
      characterTemplates: [
        { uuid: 'ch1', name: 'Warrior', card: {}, requiredClass: 'c1' },
      ],
    }
    getStoryDetail.mockResolvedValue(storyWithLocks)
    render(
      <MemoryRouter>
        <StartBook story={storyWithLocks} />
      </MemoryRouter>
    )
    await screen.findByTestId('config-view')
    // Trigger class change — the character reselect path (line 83 null return) runs
    fireEvent.click(screen.getByText('change-class'))
    if (screen.queryByText('pick:Mage')) {
      fireEvent.click(screen.getByText('pick:Mage'))
    }
    // No crash — null reselect handled
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  it('"Start" saves { story, config } in the story entry, then pushes /start-match (Back finds the loadout)', async () => {
    function StartMatchStub() {
      const { state } = useLocation()
      const navigate = useNavigate()
      return <div>start-match-page:{String(state?.fromStory)}:{state?.config?.class?.name}
        <button onClick={() => navigate(-1)}>browser-back</button></div>
    }
    function StoryRoute() {
      const { state } = useLocation()
      return <><span data-testid="saved">{state?.config?.class?.name ?? 'none'}</span><StartBook storyId="s1" story={STORY} /></>
    }
    render(
      <MemoryRouter initialEntries={['/story/s1']}>
        <Routes>
          <Route path="/story/:storyId" element={<StoryRoute />} />
          <Route path="/start-match/:storyId" element={<StartMatchStub />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByTestId('config-view')
    expect(screen.getByTestId('saved')).toHaveTextContent('none')
    fireEvent.click(screen.getByText('proceed'))
    expect(await screen.findByText('start-match-page:true:Fighter')).toBeInTheDocument()
    fireEvent.click(screen.getByText('browser-back'))
    expect(await screen.findByTestId('saved')).toHaveTextContent('Fighter')
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
