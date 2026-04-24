import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityTable from '../../components/common/EntityTable'

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
    expect(screen.getByText('Resolved Name')).toBeInTheDocument()
    expect(screen.getByText('#501')).toBeInTheDocument()
  })

  it('calls onEdit and onDelete callbacks', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<EntityTable columns={MOCK_COLS} entities={MOCK_ENTITIES} onEdit={onEdit} onDelete={onDelete} />)
    
    const editBtns = screen.getAllByRole('button').filter(b => b.querySelector('.fa-edit'))
    const trashBtns = screen.getAllByRole('button').filter(b => b.querySelector('.fa-trash'))
    
    await userEvent.click(editBtns[0])
    expect(onEdit).toHaveBeenCalledWith(MOCK_ENTITIES[0])
    
    await userEvent.click(trashBtns[1])
    expect(onDelete).toHaveBeenCalledWith(MOCK_ENTITIES[1])
  })
})
