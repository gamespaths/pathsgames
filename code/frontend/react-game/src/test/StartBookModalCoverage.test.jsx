import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Coverage-focused companion to StartBookModal.test.jsx: it drives the class
// re-validation branch (an incompatible character/trait is re-picked or dropped)
// and the option lists the main suite never asks for.

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../api/stories', () => ({ getStoryDetail: vi.fn(), getStories: vi.fn() }))
vi.mock('../components/book/Book', () => ({
  default: ({ left, right, mobile }) => <div data-testid="book">{left}{right}{mobile}</div>,
}))
vi.mock('../components/layout/Card', () => ({
  default: ({ card }) => <div data-testid="book-page">{card?.title}</div>,
}))
// ConfigView reports the current selection so the re-validation can be asserted.
vi.mock('../features/start-book/ConfigView', () => ({
  default: ({ config, onChangeClick, onPreview }) => (
    <div data-testid="config-view">
      <span data-testid="sel-class">{config.class?.name ?? 'none'}</span>
      <span data-testid="sel-character">{config.character?.name ?? 'none'}</span>
      <span data-testid="sel-traits">{(config.traits ?? []).map(t => t.name).join(',') || 'none'}</span>
      <button onClick={() => onChangeClick('class')}>change-class</button>
      <button onClick={() => onChangeClick('trait')}>change-trait</button>
      <button onClick={() => onPreview?.(null, 'bonuses', null, [])}>preview-null</button>
    </div>
  ),
}))
vi.mock('../features/start-book/OptionPicker', () => ({
  default: ({ type, options, onSelect, onBack }) => (
    <div data-testid={`selection-${type}`}>
      {options?.map((o, i) => <button key={i} onClick={() => onSelect(o)}>pick:{o.name}</button>)}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))
// The mobile column asks the modal for the options of every type, including the
// ones the desktop picker never opens.
vi.mock('../features/start-book/StartBookMobile', () => ({
  default: ({ getOptionsForType }) => (
    <div data-testid="mobile">
      <span data-testid="opt-trait">{getOptionsForType('trait').length}</span>
      <span data-testid="opt-difficulty">{getOptionsForType('difficulty').length}</span>
      <span data-testid="opt-character">{getOptionsForType('character').length}</span>
      <span data-testid="opt-unknown">{getOptionsForType('nonsense').length}</span>
    </div>
  ),
}))

import StartBookModal from '../features/start-book/StartBookModal'
import { getStoryDetail } from '../api/stories'

// c1 is the class the warrior template requires; c2 is the one the brave trait forbids.
const STORY = {
  uuid: 's1',
  title: 'Forest Quest',
  card: { title: 'Forest Quest' },
  classes: [
    { uuid: 'c1', id: 1, name: 'Fighter', card: { title: 'Fighter' } },
    { uuid: 'c2', id: 2, name: 'Mage', card: { title: 'Mage' } },
  ],
  characterTemplates: [
    { uuid: 'ch1', id: 11, name: 'Warrior', idClassPermitted: 1, card: { title: 'Warrior' } },
    { uuid: 'ch2', id: 12, name: 'Wanderer', card: { title: 'Wanderer' } },
  ],
  traits: [{ uuid: 't1', id: 21, name: 'Brave', idClassProhibited: 2, card: { title: 'Brave' } }],
  difficulties: [{ uuid: 'd1', name: 'Easy', card: { title: 'Easy' } }],
}

function wrap(story = STORY) {
  return render(<MemoryRouter><StartBookModal story={story} onClose={vi.fn()} /></MemoryRouter>)
}

describe('StartBookModal — class re-validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(STORY)
  })

  // Changing the class re-validates the rest of the loadout: the warrior requires
  // the fighter class so it is swapped for the first compatible template, and the
  // brave trait is forbidden to mages so it is dropped from the selection.
  it('re-picks an incompatible character and drops an incompatible trait', async () => {
    wrap()
    await screen.findByTestId('config-view')
    expect(screen.getByTestId('sel-character')).toHaveTextContent('Warrior')
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('Brave')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('pick:Mage'))
    expect(screen.getByTestId('sel-class')).toHaveTextContent('Mage')
    expect(screen.getByTestId('sel-character')).toHaveTextContent('Wanderer')
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('none')
  })

  // With no compatible template left the character selection is emptied rather
  // than kept in an invalid state.
  it('empties the character when no template is compatible with the new class', async () => {
    const story = { ...STORY, characterTemplates: [STORY.characterTemplates[0]] }
    getStoryDetail.mockResolvedValue(story)
    wrap(story)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('pick:Mage'))
    expect(screen.getByTestId('sel-character')).toHaveTextContent('none')
  })

  // Nothing selected yet → nothing to re-validate (the early return in reselect).
  it('leaves the character empty when the story has no templates at all', async () => {
    const story = { ...STORY, characterTemplates: [] }
    getStoryDetail.mockResolvedValue(story)
    wrap(story)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('pick:Mage'))
    expect(screen.getByTestId('sel-character')).toHaveTextContent('none')
  })

  // Switching back to the compatible class keeps the already-valid character.
  it('keeps a character that is still compatible with the new class', async () => {
    const story = {
      ...STORY,
      characterTemplates: [{ uuid: 'ch2', id: 12, name: 'Wanderer', card: { title: 'Wanderer' } }],
    }
    getStoryDetail.mockResolvedValue(story)
    wrap(story)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-class'))
    fireEvent.click(screen.getByText('pick:Mage'))
    expect(screen.getByTestId('sel-character')).toHaveTextContent('Wanderer')
  })

  // Traits are multi-select: picking the selected one toggles it off, and the
  // selection list stays open.
  it('toggles a trait off without leaving the trait selection list', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-trait'))
    expect(screen.getByTestId('selection-trait')).toBeInTheDocument()
    fireEvent.click(screen.getByText('pick:Brave'))
    // The list stays open after a toggle (traits are multi-select).
    expect(screen.getByTestId('selection-trait')).toBeInTheDocument()
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('none')
    // Toggling it back on restores the selection.
    fireEvent.click(screen.getByText('change-trait'))
    fireEvent.click(screen.getByText('pick:Brave'))
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('Brave')
  })

  // A preview with no entity clears the reading page instead of opening an empty one.
  it('clears the preview when the previewed entity is null', async () => {
    wrap()
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('preview-null'))
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })

  // The mobile column resolves the option list of every type; an unknown type is
  // simply empty.
  it('serves the option list of every type to the mobile column', async () => {
    wrap()
    await screen.findByTestId('config-view')
    expect(screen.getByTestId('opt-trait')).toHaveTextContent('1')
    expect(screen.getByTestId('opt-difficulty')).toHaveTextContent('1')
    expect(screen.getByTestId('opt-character')).toHaveTextContent('2')
    expect(screen.getByTestId('opt-unknown')).toHaveTextContent('0')
  })
})

describe('StartBookModal — traits hidden from the start-match page (v0.35.2)', () => {
  // The hidden one comes FIRST on purpose: that is the case that used to arm the loadout
  // with a trait the picker never shows, leaving nobody able to remove it.
  const HIDDEN_FIRST = {
    ...STORY,
    traits: [
      { uuid: 't0', id: 20, name: 'Cursed', hideOnStartMatch: true, card: { title: 'Cursed' } },
      { uuid: 't1', id: 21, name: 'Brave', card: { title: 'Brave' } },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(HIDDEN_FIRST)
  })

  it('never offers a hidden trait in the picker', async () => {
    wrap(HIDDEN_FIRST)
    await screen.findByTestId('config-view')

    fireEvent.click(screen.getByText('change-trait'))
    expect(screen.getByText('pick:Brave')).toBeInTheDocument()
    expect(screen.queryByText('pick:Cursed')).toBeNull()
    // The mobile column asks the same question and must get the same answer.
    expect(screen.getByTestId('opt-trait').textContent).toBe('1')
  })

  it('preselects the first PICKABLE trait, not the first one', async () => {
    wrap(HIDDEN_FIRST)
    await screen.findByTestId('config-view')

    // Arming the loadout with 'Cursed' would fail the join with TRAIT_NOT_SELECTABLE, and
    // the player would have no way to take it off: the picker does not list it.
    expect(screen.getByTestId('sel-traits').textContent).toBe('Brave')
  })

  it('selects nothing when every trait of the story is hidden', async () => {
    const ALL_HIDDEN = {
      ...STORY,
      traits: [{ uuid: 't0', id: 20, name: 'Cursed', hideOnStartMatch: true, card: {} }],
    }
    getStoryDetail.mockResolvedValue(ALL_HIDDEN)
    wrap(ALL_HIDDEN)
    await screen.findByTestId('config-view')

    expect(screen.getByTestId('sel-traits').textContent).toBe('none')
    expect(screen.getByTestId('opt-trait').textContent).toBe('0')
  })
})
