import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityTable from '../../components/common/story/EntityTable'

const MOCK_COLS = [
  { key: 'name', label: 'Name' },
  { key: 'val', label: 'Value' }
]

const MOCK_ENTITIES = [
  { uuid: '1', name: 'Alpha', val: 10 },
  { uuid: '2', name: 'Beta', val: 20 }
]

describe('EntityTable', () => {
  it('renders table headers and data', () => {
    render(<EntityTable columns={MOCK_COLS} entities={MOCK_ENTITIES} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('filters rows based on search input', async () => {
    render(<EntityTable columns={MOCK_COLS} entities={MOCK_ENTITIES} onEdit={()=>{}} onDelete={()=>{}} />)
    const input = screen.getByPlaceholderText(/Search in table/i)
    await userEvent.type(input, 'Alpha')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).toBeNull()
  })

  it('resolves idTextName correctly', () => {
    const cols = [{ key: 'idName', label: 'Name', type: 'idTextName' }]
    const ents = [{ uuid: '1', idName: 501 }]
    const texts = [{ idText: 501, lang: 'en', shortText: 'Resolved Name' }]
    render(<EntityTable columns={cols} entities={ents} texts={texts} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText(/Resolved Name/i)).toBeInTheDocument()
    expect(screen.getByText(/#501/i)).toBeInTheDocument()
  })

  it('calls onEdit and onDelete callbacks', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<EntityTable columns={MOCK_COLS} entities={MOCK_ENTITIES} onEdit={onEdit} onDelete={onDelete} />)
    
    const editBtns = screen.getAllByRole('button').filter(b => b.querySelector('.fa-edit'))
    const trashBtns = screen.getAllByRole('button').filter(b => b.querySelector('.fa-trash'))
    
    await userEvent.click(editBtns[1])
    expect(onEdit).toHaveBeenCalledWith(MOCK_ENTITIES[0])
    
    await userEvent.click(trashBtns[0])
    expect(onDelete).toHaveBeenCalledWith(MOCK_ENTITIES[1])
  })

  it('shows the empty-state row when there are no entities', () => {
    render(<EntityTable columns={MOCK_COLS} entities={[]} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('No items found.')).toBeInTheDocument()
  })

  it('renders the special column types', () => {
    const cols = [
      { key: 'mono', label: 'Mono', type: 'monoId' },
      { key: 'lang', label: 'Lang', type: 'langBadge' },
      { key: 'long', label: 'Long', type: 'longTextIcon' },
    ]
    const ents = [{ uuid: '1', id: 1, mono: 9, lang: 'en', long: 'a long text' }]
    render(<EntityTable columns={cols} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('#9')).toBeInTheDocument()
    expect(screen.getByText('en')).toBeInTheDocument()
    expect(document.querySelector('.fa-file-alt')).toBeInTheDocument()
  })

  it('renders boolean columns as Yes/No', () => {
    const cols = [{ key: 'flag', label: 'Flag', type: 'boolean' }]
    const ents = [
      { uuid: '1', id: 1, flag: true },
      { uuid: '2', id: 2, flag: false },
    ]
    render(<EntityTable columns={cols} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('uses a custom render function when provided', () => {
    const cols = [{ key: 'val', label: 'Value', render: (e) => `R-${e.val}` }]
    const ents = [{ uuid: '1', id: 1, val: 3 }]
    render(<EntityTable columns={cols} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('R-3')).toBeInTheDocument()
  })

  it('shows the idCard column and fires onOpenIdCardForm', async () => {
    const onOpenIdCardForm = vi.fn()
    const ents = [{ uuid: '1', id: 1, name: 'X', idCard: 12 }]
    render(<EntityTable columns={MOCK_COLS} entities={ents}
                       onOpenIdCardForm={onOpenIdCardForm}
                       onEdit={()=>{}} onDelete={()=>{}} />)
    await userEvent.click(screen.getByText('#12'))
    expect(onOpenIdCardForm).toHaveBeenCalledWith(12)
  })

  // ── Step 0.28.2 — "Card Back" column for Loc Neighbors ───────────────────────

  it('shows the Card Back column and opens the back card when idCardBack is set', async () => {
    const onOpenIdCardForm = vi.fn()
    const ents = [{ uuid: '1', id: 1, name: 'X', idCard: 12, idCardBack: 34 }]
    render(<EntityTable columns={MOCK_COLS} entities={ents}
                       onOpenIdCardForm={onOpenIdCardForm}
                       onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Card Back')).toBeInTheDocument()
    await userEvent.click(screen.getByText('#34'))
    expect(onOpenIdCardForm).toHaveBeenCalledWith(34)
  })

  it('offers a duplicate icon and fires onDuplicateCardBack when idCardBack is empty', async () => {
    const onDuplicateCardBack = vi.fn()
    const ent = { uuid: '1', id: 1, name: 'X', idCard: 12, idCardBack: null }
    render(<EntityTable columns={MOCK_COLS} entities={[ent]}
                       onDuplicateCardBack={onDuplicateCardBack}
                       onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Card Back')).toBeInTheDocument()
    const dupBtn = screen.getAllByRole('button').find(b => b.querySelector('.fa-clone'))
    expect(dupBtn).toBeTruthy()
    await userEvent.click(dupBtn)
    expect(onDuplicateCardBack).toHaveBeenCalledWith(ent)
  })

  it('shows a dash in Card Back when neither idCardBack nor idCard is set', () => {
    const ents = [{ uuid: '1', id: 1, name: 'X', idCardBack: null }]
    render(<EntityTable columns={MOCK_COLS} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Card Back')).toBeInTheDocument()
    expect(document.querySelector('.fa-clone')).toBeNull()
  })

  it('hides the Card Back column for entity types without idCardBack', () => {
    const ents = [{ uuid: '1', id: 1, name: 'X', idCard: 12 }]
    render(<EntityTable columns={MOCK_COLS} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.queryByText('Card Back')).toBeNull()
  })

  it('forces the Card Back column via showCardBackColumn even without the key', async () => {
    const onDuplicateCardBack = vi.fn()
    // Row has NO idCardBack key (e.g. a backend that does not echo it) but has idCard.
    const ent = { uuid: '1', id: 1, name: 'X', idCard: 12 }
    render(<EntityTable columns={MOCK_COLS} entities={[ent]} showCardBackColumn
                       onDuplicateCardBack={onDuplicateCardBack}
                       onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Card Back')).toBeInTheDocument()
    const dupBtn = screen.getAllByRole('button').find(b => b.querySelector('.fa-clone'))
    await userEvent.click(dupBtn)
    expect(onDuplicateCardBack).toHaveBeenCalledWith(ent)
  })

  it('resolves a relation label from relationOptionsByField', () => {
    const cols = [{ key: 'idClass', label: 'Class' }]
    const ents = [{ uuid: '1', id: 1, idClass: 7 }]
    const rel = { idClass: { options: [{ value: 7, label: 'Warrior' }] } }
    render(<EntityTable columns={cols} entities={ents} relationOptionsByField={rel}
                       onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Warrior')).toBeInTheDocument()
  })

  it('renders a dash for an empty idTextName cell', () => {
    const cols = [{ key: 'idName', label: 'Name', type: 'idTextName' }]
    const ents = [{ uuid: '1', id: 1, idName: null }]
    render(<EntityTable columns={cols} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('truncates idTextName text to 33 characters with ellipsis', () => {
    const longText = 'A very long location name that definitely exceeds thirty-three characters'
    const cols = [{ key: 'idName', label: 'Name', type: 'idTextName' }]
    const ents = [{ uuid: '1', id: 1, idName: 42 }]
    const texts = [{ idText: 42, lang: 'en', shortText: longText }]
    render(<EntityTable columns={cols} entities={ents} texts={texts} onEdit={()=>{}} onDelete={()=>{}} />)
    const badge = screen.getByTitle(longText)
    expect(badge.textContent).toContain('…')
    expect(badge.textContent.replace(/^#\d+\s*/, '')).toHaveLength(34) // 33 chars + '…'
  })

  it('does not truncate idTextName text shorter than 34 characters', () => {
    const shortText = 'Short name'
    const cols = [{ key: 'idName', label: 'Name', type: 'idTextName' }]
    const ents = [{ uuid: '1', id: 1, idName: 7 }]
    const texts = [{ idText: 7, lang: 'en', shortText: shortText }]
    render(<EntityTable columns={cols} entities={ents} texts={texts} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText(/Short name/)).toBeInTheDocument()
    expect(screen.queryByText(/…/)).toBeNull()
  })

  it('shows only the first 3 definition columns by default', () => {
    const cols = [
      { key: 'a', label: 'ColA' }, { key: 'b', label: 'ColB' },
      { key: 'c', label: 'ColC' }, { key: 'd', label: 'ColD' },
    ]
    const ents = [{ uuid: '1', id: 1, a: 1, b: 2, c: 3, d: 4 }]
    render(<EntityTable columns={cols} entities={ents} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('ColC')).toBeInTheDocument()
    expect(screen.queryByText('ColD')).toBeNull()
  })

  it('shows a 4th column when maxColumns is raised (Loc Neighbors Direction)', () => {
    const cols = [
      { key: 'flagBack', label: 'Back' }, { key: 'idLocationFrom', label: 'From' },
      { key: 'idLocationTo', label: 'To' }, { key: 'direction', label: 'Direction' },
    ]
    const ents = [{ uuid: '1', id: 1, flagBack: 1, idLocationFrom: 1, idLocationTo: 2, direction: 'NORTH' }]
    render(<EntityTable columns={cols} entities={ents} maxColumns={4} onEdit={()=>{}} onDelete={()=>{}} />)
    expect(screen.getByText('Direction')).toBeInTheDocument()
    expect(screen.getByText('NORTH')).toBeInTheDocument()
  })
})
