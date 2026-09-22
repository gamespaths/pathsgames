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
  default: ({ card, onClose, statItemsToPageContent }) => (
    <div data-testid="book-page" data-stats={(statItemsToPageContent ?? []).map(i => i.key).join(',')}>
      {card?.title}
      {onClose && <button onClick={onClose}>page-back</button>}
    </div>
  ),
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
      <button onClick={() => onChangeClick('difficulty')}>change-difficulty</button>
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

describe('StartBookModal — the left page while a picker is open (v0.38.3)', () => {
  const BUDGETED = {
    ...STORY,
    traits: [{ uuid: 't1', id: 21, name: 'Brave', costPositive: 2, life: 5, card: { title: 'Brave' } }],
    difficulties: [{ uuid: 'd1', name: 'Easy', traitCostPositiveBudget: 3, card: { title: 'Easy' } }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(BUDGETED)
  })

  // Opening the trait picker puts the FIRST selected trait on the left page, cost first.
  it('previews the first selected trait, with its cost ahead of its stats', async () => {
    wrap(BUDGETED)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-trait'))
    const page = screen.getAllByTestId('book-page')[0]
    expect(page).toHaveTextContent('Brave')
    expect(page.dataset.stats).toBe('costPositive,life')
  })

  // The picker draws no back arrow any more, so the left page always carries one.
  it('carries a back arrow on the left page even with nothing previewed', async () => {
    const noTraits = { ...BUDGETED, traits: [] }
    getStoryDetail.mockResolvedValue(noTraits)
    wrap(noTraits)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-trait'))
    expect(screen.queryByTestId('config-view')).toBeNull()
    fireEvent.click(screen.getAllByText('page-back')[0])
    expect(screen.getByTestId('config-view')).toBeInTheDocument()
  })
})

describe('StartBookModal — reopened with a loadout (v0.38.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(STORY)
  })

  // Back from start-match: the modal shows the handed-back loadout, not the defaults,
  // and keeps it once the story detail lands.
  it('starts from initialConfig and keeps it after the detail load', async () => {
    const initialConfig = { character: STORY.characterTemplates[1], class: STORY.classes[1], traits: [], difficulty: STORY.difficulties[0] }
    render(<MemoryRouter><StartBookModal story={STORY} onClose={vi.fn()} initialConfig={initialConfig} /></MemoryRouter>)
    await screen.findByTestId('config-view')
    expect(screen.getByTestId('sel-class')).toHaveTextContent('Mage')
    expect(screen.getByTestId('sel-character')).toHaveTextContent('Wanderer')
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('none')
  })
})

describe('StartBookModal — difficulty budgets over the trait selection (v0.38.3)', () => {
  // Easy pays for both traits; Hard pays for the first one only.
  const BUDGETS = {
    ...STORY,
    traits: [
      { uuid: 't1', id: 21, name: 'Brave', costPositive: 2, card: { title: 'Brave' } },
      { uuid: 't2', id: 22, name: 'Greedy', costPositive: 3, card: { title: 'Greedy' } },
    ],
    difficulties: [
      { uuid: 'd1', name: 'Easy', traitCostPositiveBudget: 5, card: { title: 'Easy' } },
      { uuid: 'd2', name: 'Hard', traitCostPositiveBudget: 2, card: { title: 'Hard' } },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getStoryDetail.mockResolvedValue(BUDGETS)
  })

  // The bug this covers: traits picked under a lenient difficulty used to survive a
  // switch to a stricter one, and the server then refused the loadout.
  it('drops the traits a stricter difficulty can no longer pay for', async () => {
    wrap(BUDGETS)
    await screen.findByTestId('config-view')
    fireEvent.click(screen.getByText('change-trait'))
    fireEvent.click(screen.getByText('pick:Greedy'))
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('Brave,Greedy')
    fireEvent.click(screen.getByText('change-difficulty'))
    fireEvent.click(screen.getByText('pick:Hard'))
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('Brave')
    expect(screen.getByTestId('sel-traits')).not.toHaveTextContent('Greedy')
  })

  it('does not preselect a first trait the default difficulty cannot pay for', async () => {
    const story = { ...BUDGETS, difficulties: [BUDGETS.difficulties[1], BUDGETS.difficulties[0]],
                    traits: [BUDGETS.traits[1], BUDGETS.traits[0]] }
    getStoryDetail.mockResolvedValue(story)
    wrap(story)
    await screen.findByTestId('config-view')
    expect(screen.getByTestId('sel-traits')).toHaveTextContent('none')
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
