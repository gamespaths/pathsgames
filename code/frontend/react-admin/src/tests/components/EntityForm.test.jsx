import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityForm from '../../components/common/story/EntityForm'

// Mock sub-modals to simplify testing EntityForm
vi.mock('../../components/common/story/FastTextSelectorModal', () => ({
  default: ({ open, onSelect, onClose }) => open ? (
    <div data-testid="fast-text-modal">
      <button onClick={() => onSelect(999)}>Select 999</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
}))

vi.mock('../../components/common/story/PathsOptionsSelectorModal', () => ({
  default: ({ open, onSelect, onClose }) => open ? (
    <div data-testid="options-modal">
      <button onClick={() => onSelect('val1')}>Select val1</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
}))

describe('EntityForm', () => {
  const MOCK_FIELDS = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'type', label: 'Type', type: 'select', options: [{ value: 'A', label: 'Alpha' }] },
    { key: 'active', label: 'Active', type: 'checkbox' },
    { key: 'desc', label: 'Description', type: 'textarea' },
    { key: 'idTextName', label: 'Text Name' } 
  ]

  const onSave = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly for creation', () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByText('Create Entity')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Age')).toBeInTheDocument()
  })

  it('renders correctly for editing', () => {
    const entity = { uuid: '123', name: 'Original', age: 30 }
    render(<EntityForm entity={entity} fields={MOCK_FIELDS} onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByText('Edit Entity')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Original')).toBeInTheDocument()
  })

  it('updates state on input change', async () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={onCancel} />)
    const nameInput = screen.getByLabelText('Name')
    const ageInput = screen.getByLabelText('Age')
    
    await userEvent.type(nameInput, 'New Name')
    await userEvent.type(ageInput, '42')
    
    await userEvent.click(screen.getByText('Save'))
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Name',
      age: 42
    }))
  })

  it('handles checkbox and select', async () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={onCancel} />)
    
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    
    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'A')
    
    await userEvent.click(screen.getByText('Save'))
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      type: 'A'
    }))
  })

  it('calls onCancel when backdrop or cancel button is clicked', async () => {
    render(<EntityForm fields={MOCK_FIELDS} onSave={onSave} onCancel={onCancel} />)
    
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
    
    const backdrop = screen.getByTestId('entity-form-backdrop')
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('opens FastTextSelectorModal when PathsSelector is used', async () => {
    const onSaveFastText = vi.fn()
    render(
      <EntityForm 
        fields={MOCK_FIELDS} 
        onSave={onSave} 
        onCancel={onCancel} 
        onSaveFastText={onSaveFastText}
        storyUuid="s1"
        texts={[]}
      />
    )
    
    const selectBtn = screen.getByTitle(/Select Text Name/i)
    await userEvent.click(selectBtn)
    
    expect(screen.getByTestId('fast-text-modal')).toBeInTheDocument()
    
    await userEvent.click(screen.getByText('Select 999'))
    expect(screen.queryByTestId('fast-text-modal')).not.toBeInTheDocument()
    
    await userEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idTextName: 999 }))
  })
})
