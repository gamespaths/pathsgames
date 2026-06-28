import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityForm from '../../../../components/common/story/EntityForm'

// ── Mock the heavy sub-components so the EntityForm callbacks are reachable ────

vi.mock('../../../../components/common/story/PathsSelector', () => ({
  default: ({ name, displayValue, onOpenSelector, onOpenCreator, onClear }) => (
    <div data-testid={`paths-${name}`}>
      <span data-testid={`display-${name}`}>{displayValue}</span>
      <button type="button" onClick={onOpenSelector}>open-{name}</button>
      <button type="button" onClick={onOpenCreator}>creator-{name}</button>
      <button type="button" onClick={onClear}>clear-{name}</button>
    </div>
  ),
}))

vi.mock('../../../../components/common/story/FastTextSelectorModal', () => ({
  default: ({ open, onSelect, onClose }) => open ? (
    <div data-testid="text-selector-modal">
      <button type="button" onClick={() => onSelect(5)}>select-text-5</button>
      <button type="button" onClick={onClose}>close-text-selector</button>
    </div>
  ) : null,
}))

vi.mock('../../../../components/common/story/FastTextCreatorModal', () => ({
  default: ({ open, onClose }) => open ? (
    <div data-testid="text-creator-modal">
      <button type="button" onClick={() => onClose({ idText: 9 })}>save-text-creator</button>
      <button type="button" onClick={() => onClose(null)}>cancel-text-creator</button>
    </div>
  ) : null,
}))

vi.mock('../../../../components/common/story/PathsOptionsSelectorModal', () => ({
  default: ({ open, onSelect, onClose }) => open ? (
    <div data-testid="options-modal">
      <button type="button" onClick={() => onSelect('opt-1')}>select-option</button>
      <button type="button" onClick={onClose}>close-options</button>
    </div>
  ) : null,
}))

const MOCK_FIELDS = [
  { key: 'idTextName', label: 'Name', type: 'number' },
  { key: 'idTextDescription', label: 'Description', type: 'number' },
  { key: 'isSafe', label: 'Safe', type: 'checkbox' },
  { key: 'type', label: 'Type', type: 'select', options: [{ value: 'A', label: 'Alpha' }] },
  { key: 'comment', label: 'Comment', type: 'textarea' },
  { key: 'other', label: 'Other', type: 'text' },
]

const MOCK_TEXTS = [
  { idText: 1, lang: 'en', shortText: 'Text One EN' },
  { idText: 1, lang: 'it', shortText: 'Testo Uno IT' },
  { idText: 5, lang: 'en', shortText: 'Text Five EN' },
]

describe('EntityForm', () => {
  it('renders all field types', () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Safe')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment')).toBeInTheDocument()
    expect(screen.getByLabelText('Other')).toBeInTheDocument()
  })

  it('updates state on input change', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.type(screen.getByLabelText('Other'), 'Hello')
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ other: 'Hello' }))
  })

  it('handles checkbox change', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByLabelText('Safe'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isSafe: true }))
  })

  it('handles number input correctly', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.type(screen.getByLabelText('Name'), '123')
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idTextName: 123 }))
  })

  it('clearing a number field stores an empty string', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'e1', idTextName: 7 }} fields={MOCK_FIELDS}
                       onSave={onSave} onCancel={() => {}} />)
    await userEvent.clear(screen.getByLabelText('Name'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idTextName: '' }))
  })

  it('updates select and textarea values', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'A')
    await userEvent.type(screen.getByLabelText('Comment'), 'note')
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'A', comment: 'note' }))
  })

  it('handles cancel click', async () => {
    const onCancel = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={onCancel} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  // ── flagBack select + conditional idCardBack visibility (Loc Neighbors) ───────

  const FLAG_BACK_FIELDS = [
    { key: 'flagBack', label: 'Flag Back', type: 'select', valueType: 'number',
      options: [{ value: 1, label: 'YES' }, { value: 0, label: 'NO' }] },
    { key: 'idCardBack', label: 'Card Back ID', type: 'number', showIf: (d) => Number(d.flagBack) === 1 },
  ]

  it('shows an existing flagBack=0 (NO) value in the select instead of blank', () => {
    render(<EntityForm entity={{ uuid: 'n1', flagBack: 0 }}
                       fields={FLAG_BACK_FIELDS} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByLabelText('Flag Back')).toHaveValue('0')
  })

  it('saves flagBack=0 when NO is selected', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'n1', flagBack: 1 }}
                       fields={FLAG_BACK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.selectOptions(screen.getByLabelText('Flag Back'), '0')
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ flagBack: 0 }))
  })

  it('hides Card Back when flagBack is not YES and shows it when YES', async () => {
    render(<EntityForm entity={{ uuid: 'n1', flagBack: 1, idCardBack: 3 }}
                       fields={FLAG_BACK_FIELDS} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByLabelText('Card Back ID')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Flag Back'), '0')
    expect(screen.queryByLabelText('Card Back ID')).toBeNull()
  })

  it('clears idCardBack when flagBack is set to NO', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'n1', flagBack: 1, idCardBack: 3 }}
                       fields={FLAG_BACK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.selectOptions(screen.getByLabelText('Flag Back'), '0')
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ flagBack: 0, idCardBack: '' }))
  })

  // ── Step 0.28.2 — idCard must differ from idCardBack (neighbor return card) ───

  const CARD_BACK_FIELDS = [
    { key: 'idCard', label: 'Card ID', type: 'number' },
    { key: 'idCardBack', label: 'Card Back ID', type: 'number' },
  ]

  it('blocks save and shows an error when idCard equals idCardBack', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'n1', idCard: 5, idCardBack: 5 }}
                       fields={CARD_BACK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId('entity-form-error')).toBeInTheDocument()
  })

  it('allows save when idCard differs from idCardBack', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'n1', idCard: 5, idCardBack: 6 }}
                       fields={CARD_BACK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idCard: 5, idCardBack: 6 }))
    expect(screen.queryByTestId('entity-form-error')).not.toBeInTheDocument()
  })

  it('allows save when idCardBack is empty (optional field)', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'n1', idCard: 5 }}
                       fields={CARD_BACK_FIELDS} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idCard: 5 }))
  })

  it('handles backdrop click to cancel', () => {
    const onCancel = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('entity-form-backdrop'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows Edit title in edit mode and Create otherwise', () => {
    const { unmount } = render(
      <EntityForm entity={{ uuid: 'x' }} fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Edit Entity')).toBeInTheDocument()
    unmount()
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Create Entity')).toBeInTheDocument()
  })

  it('falls back to initialData when no entity is given', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} initialData={{ other: 'seed' }}
                       onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ other: 'seed' }))
  })

  // ── Text-selector path (PathsSelector for idText* keys) ──────────────────────

  it('renders a PathsSelector for text fields when storyUuid + onSaveFastText set', () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    expect(screen.getByTestId('paths-idTextName')).toBeInTheDocument()
  })

  it('opening a text selector with no value shows the FastTextSelectorModal', async () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('open-idTextName'))
    expect(screen.getByTestId('text-selector-modal')).toBeInTheDocument()
  })

  it('opening a text selector with an existing value shows the FastTextCreatorModal', async () => {
    render(<EntityForm entity={{ uuid: 'e1', idTextName: 1 }} fields={MOCK_FIELDS}
                       onSave={() => {}} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('open-idTextName'))
    expect(screen.getByTestId('text-creator-modal')).toBeInTheDocument()
  })

  it('selecting a text syncs idTextName into idTextDescription', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('open-idTextName'))
    await userEvent.click(screen.getByText('select-text-5'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ idTextName: 5, idTextDescription: 5 }))
  })

  it('clearing a text selector empties the field', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'e1', idTextName: 1 }} fields={MOCK_FIELDS}
                       onSave={onSave} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('clear-idTextName'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idTextName: '' }))
  })

  it('text creator modal save applies the chosen idText', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'e1', idTextName: 1 }} fields={MOCK_FIELDS}
                       onSave={onSave} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('open-idTextName'))
    await userEvent.click(screen.getByText('save-text-creator'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idTextName: 9 }))
  })

  it('opening the text creator path via the creator button', async () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={() => {}} onCancel={() => {}}
                       storyUuid="story-1" onSaveFastText={vi.fn()} texts={MOCK_TEXTS} />)
    await userEvent.click(screen.getByText('creator-idTextName'))
    expect(screen.getByTestId('text-selector-modal')).toBeInTheDocument()
  })

  // ── Option-selector path (pathSelectorOptions) ───────────────────────────────

  const OPTION_FIELDS = [{ key: 'idClass', label: 'Class', type: 'number' }]
  const OPTION_CONFIG = {
    idClass: { valueType: 'number', options: [{ value: 7, label: 'Warrior' }] },
  }

  it('renders a PathsSelector for option fields and shows the matching label', () => {
    render(<EntityForm entity={{ uuid: 'e1', idClass: 7 }} fields={OPTION_FIELDS}
                       onSave={() => {}} onCancel={() => {}}
                       pathSelectorOptions={OPTION_CONFIG} />)
    expect(screen.getByTestId('display-idClass').textContent).toBe('Warrior')
  })

  it('selecting an option value stores the normalized number', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={OPTION_FIELDS} onSave={onSave} onCancel={() => {}}
                       pathSelectorOptions={{
                         idClass: { valueType: 'number', options: [{ value: 'opt-1', label: 'X' }] },
                       }} />)
    await userEvent.click(screen.getByText('open-idClass'))
    await userEvent.click(screen.getByText('select-option'))
    await userEvent.click(screen.getByText('Save'))
    // 'opt-1' is not numeric → normalizeOptionValue returns ''
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idClass: '' }))
  })

  it('selecting a string-typed option keeps the raw value', async () => {
    const onSave = vi.fn()
    render(<EntityForm fields={[{ key: 'idClass', label: 'Class' }]} onSave={onSave}
                       onCancel={() => {}}
                       pathSelectorOptions={{
                         idClass: { valueType: 'string', options: [{ value: 'opt-1', label: 'X' }] },
                       }} />)
    await userEvent.click(screen.getByText('open-idClass'))
    await userEvent.click(screen.getByText('select-option'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idClass: 'opt-1' }))
  })

  it('clearing an option field empties it', async () => {
    const onSave = vi.fn()
    render(<EntityForm entity={{ uuid: 'e1', idClass: 7 }} fields={OPTION_FIELDS}
                       onSave={onSave} onCancel={() => {}}
                       pathSelectorOptions={OPTION_CONFIG} />)
    await userEvent.click(screen.getByText('clear-idClass'))
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idClass: '' }))
  })

  it('fast-card creation applies the returned idCard', async () => {
    const onSave = vi.fn()
    const onCreateFastCard = vi.fn().mockResolvedValue(42)
    render(<EntityForm fields={[{ key: 'idCard', label: 'Card', type: 'number' }]}
                       onSave={onSave} onCancel={() => {}}
                       storyUuid="story-1"
                       onCreateFastCard={onCreateFastCard}
                       pathSelectorOptions={{ idCard: { valueType: 'number', options: [] } }} />)
    await userEvent.click(screen.getByText('creator-idCard'))
    await userEvent.click(screen.getByText('Save'))
    expect(onCreateFastCard).toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idCard: 42 }))
  })
})
