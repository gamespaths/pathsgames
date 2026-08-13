import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityForm from '../../../../components/common/story/EntityForm'
import FastTextSelectorModal from '../../../../components/common/story/FastTextSelectorModal'

/**
 * EntityForm's three selectors — text, option and fast card — driven over the
 * states the story editor puts them in: an entity that already names a text, one
 * that names none, an option list that is not there, and a fast-card call that
 * comes back with nothing.
 */

const FIELDS = [
  { key: 'idTextName', label: 'Name Text ID', type: 'number' },
  { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
  { key: 'idCard', label: 'Card ID', type: 'number' },
  { key: 'conditionKey', label: 'Condition Key', type: 'text' },
]

const TEXTS = [
  { uuid: 't1', idText: 5, lang: 'en', shortText: 'Gate', longText: 'Long gate' },
  { uuid: 't2', idText: 5, lang: 'it', shortText: 'Cancello' },
  { uuid: 't3', idText: 6, lang: 'en', shortText: '' },      // present but empty
]

function renderForm(props = {}) {
  return render(<EntityForm
    entity={null}
    fields={FIELDS}
    onSave={vi.fn()}
    onCancel={vi.fn()}
    storyUuid="story-1"
    storyOptions={[]}
    texts={TEXTS}
    onSaveFastText={vi.fn()}
    {...props} />)
}

describe('EntityForm selectors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the resolved short text, "(empty)" and the not-found label', () => {
    renderForm({ entity: { uuid: 'e-1', idTextName: 5, idTextDescription: 6, idCard: '' } })

    expect(screen.getByTitle('#5 Gate')).toBeInTheDocument()
    expect(screen.getByTitle('#6 (empty)')).toBeInTheDocument()
  })

  it('labels a text id that no row resolves', () => {
    renderForm({ entity: { uuid: 'e-1', idTextName: 99 } })
    expect(screen.getByTitle('Text #99 (EN not found)')).toBeInTheDocument()
  })

  it('opens the editor with the current translations when the field already names a text', async () => {
    renderForm({ entity: { uuid: 'e-1', idTextName: 5 } })

    await userEvent.click(screen.getByTitle('Select Name Text ID'))

    // The creator modal opens pre-filled with both languages of text #5.
    expect(await screen.findByDisplayValue('Gate')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cancello')).toBeInTheDocument()
  })

  it('opens the list selector when the field names no text, and mirrors the pick onto the description', async () => {
    renderForm()

    await userEvent.click(screen.getByTitle('Select Name Text ID'))
    const modal = (await screen.findByText('Fast Text Selector')).closest('.pg-modal')
    await userEvent.click(within(modal).getAllByRole('button', { name: 'Select' })[0])

    // idTextName mirrors onto idTextDescription until the description is picked by hand.
    await waitFor(() => expect(screen.getAllByTitle(/^#\d/).length).toBe(2))
  })

  it('stops mirroring once the description is chosen on its own', async () => {
    renderForm()

    await userEvent.click(screen.getByTitle('Select Desc Text ID'))
    let modal = (await screen.findByText('Fast Text Selector')).closest('.pg-modal')
    await userEvent.click(within(modal).getAllByRole('button', { name: 'Select' })[0])

    await userEvent.click(screen.getByTitle('Select Name Text ID'))
    modal = (await screen.findByText('Fast Text Selector')).closest('.pg-modal')
    await userEvent.click(within(modal).getAllByRole('button', { name: 'Select' })[1])

    const shown = screen.getAllByTitle(/^#\d/).map(el => el.getAttribute('title'))
    expect(new Set(shown).size).toBe(2)   // the two fields hold different texts
  })

  it('ignores the fast-card button when no handler is wired and clears an option field', async () => {
    const onSave = vi.fn()
    renderForm({
      entity: { uuid: 'e-1', conditionKey: 'gate' },
      pathSelectorOptions: { conditionKey: { options: [{ value: 'gate', label: 'The gate' }], valueType: 'string' } },
    })

    expect(screen.getByTitle('The gate')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle('Clear Condition Key'))
    expect(screen.getByTitle('No value selected')).toBeInTheDocument()
  })

  it('labels an option value that is not in the list, and copes with no list at all', async () => {
    renderForm({
      entity: { uuid: 'e-1', conditionKey: 'unknown' },
      pathSelectorOptions: { conditionKey: { options: [] } },
    })
    expect(screen.getByTitle('#unknown')).toBeInTheDocument()
  })

  it('keeps the card id untouched when the fast-card call returns nothing', async () => {
    const onCreateFastCard = vi.fn().mockResolvedValue(undefined)
    renderForm({ entity: { uuid: 'e-1' }, onCreateFastCard,
      pathSelectorOptions: { idCard: { options: [] } } })

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    await waitFor(() => expect(onCreateFastCard).toHaveBeenCalled())
    expect(screen.queryByTitle('#12')).not.toBeInTheDocument()
    expect(document.querySelector('input[name="idCard"]')).toHaveValue('')
  })

  it('adopts the id the fast-card call returns', async () => {
    const onCreateFastCard = vi.fn().mockResolvedValue(12)
    renderForm({ entity: { uuid: 'e-1' }, onCreateFastCard,
      pathSelectorOptions: { idCard: { options: [] } } })

    await userEvent.click(screen.getByRole('button', { name: /New Fast Card/i }))

    expect(await screen.findByTitle('#12')).toBeInTheDocument()
  })

  it('refuses a card back that repeats the forward card', async () => {
    const onSave = vi.fn()
    render(<EntityForm
      entity={{ uuid: 'e-1', idCard: 3, idCardBack: 3 }}
      fields={[{ key: 'idCard', label: 'Card ID', type: 'number' },
               { key: 'idCardBack', label: 'Card Back', type: 'number' }]}
      onSave={onSave}
      onCancel={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/must differ from Card/)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('FastTextSelectorModal', () => {
  const TEXT_ROWS = [
    { uuid: 't1', idText: 5, lang: 'en', shortText: 'Gate' },
    { uuid: 't2', idText: 6, lang: 'it', shortText: 'Solo italiano' },   // no english row
  ]

  it('dashes a row that has no english short text and searches the italian one', async () => {
    render(<FastTextSelectorModal
      open
      texts={TEXT_ROWS}
      selectedId={5}
      storyOptions={[]}
      storyUuid="story-1"
      onSelect={vi.fn()}
      onClose={vi.fn()}
      onSaveFastText={vi.fn()} />)

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    await userEvent.type(screen.getByPlaceholderText(/Search by text id/i), 'italiano')
    expect(screen.getByText('Solo italiano')).toBeInTheDocument()
  })

  it('skips an id that is already taken when numbering the generated text', async () => {
    const onSaveFastText = vi.fn().mockResolvedValue({ idText: 7 })
    const onSelect = vi.fn()
    render(<FastTextSelectorModal
      open
      texts={[{ uuid: 't1', idText: 1, lang: 'en', shortText: 'One' }]}
      selectedId=""
      storyOptions={[]}
      storyUuid="story-1"
      startMode="input-generator"
      onSelect={onSelect}
      onClose={vi.fn()}
      onSaveFastText={onSaveFastText} />)

    const input = await screen.findByPlaceholderText('Insert text value')
    await userEvent.type(input, 'Fresh{Enter}')

    await waitFor(() => expect(onSaveFastText).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'input-generator', uuidStory: 'story-1' })))
    expect(onSelect).toHaveBeenCalledWith(7)
  })

  it('does nothing on Enter while the text is still blank, and reports a save failure', async () => {
    const onSaveFastText = vi.fn().mockRejectedValue({})
    render(<FastTextSelectorModal
      open
      texts={[]}
      selectedId=""
      storyOptions={[]}
      storyUuid="story-1"
      startMode="input-generator"
      onSelect={vi.fn()}
      onClose={vi.fn()}
      onSaveFastText={onSaveFastText} />)

    const input = await screen.findByPlaceholderText('Insert text value')
    await userEvent.type(input, '{Enter}')
    expect(onSaveFastText).not.toHaveBeenCalled()

    await userEvent.type(input, 'Fresh{Enter}')
    expect(await screen.findByText('Cannot save generated text')).toBeInTheDocument()
  })
})
