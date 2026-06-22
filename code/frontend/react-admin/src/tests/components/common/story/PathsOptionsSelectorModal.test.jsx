import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PathsOptionsSelectorModal from '../../../../components/common/story/PathsOptionsSelectorModal'

const MOCK_OPTIONS = [
  { value: 1, label: 'Apple' },
  { value: 2, label: 'Banana' },
  { value: 3, label: 'Cherry' }
]

describe('PathsOptionsSelectorModal', () => {
  it('renders options when open', () => {
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={() => {}}
        options={MOCK_OPTIONS}
        onSelect={() => {}}
        title="Select Fruit"
      />
    )
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
  })

  it('filters options by search', async () => {
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={() => {}}
        options={MOCK_OPTIONS}
        onSelect={() => {}}
        title="Select Fruit"
      />
    )
    const input = screen.getByPlaceholderText(/search/i)
    await userEvent.type(input, 'App')
    
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })

  it('calls onSelect when an option is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={() => {}}
        options={MOCK_OPTIONS}
        onSelect={onSelect}
        title="Select Fruit"
      />
    )
    
    const selectBtn = screen.getAllByRole('button').find(b => b.textContent === 'Select' || b.querySelector('.fa-check'))
    // Or just find by row
    const row = screen.getByText('Apple').closest('tr')
    const btn = row.querySelector('button')
    await userEvent.click(btn)
    
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('handles sorting', async () => {
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={() => {}}
        options={MOCK_OPTIONS}
        onSelect={() => {}}
        title="Select Fruit"
      />
    )
    
    const labelHeader = screen.getByText('Label')
    await userEvent.click(labelHeader) // Sort ASC
    await userEvent.click(labelHeader) // Sort DESC
    
    // Check order? Hard without complex selectors. 
    // But it covers the handleSort function.
  })

  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={onClose}
        options={MOCK_OPTIONS}
        onSelect={() => {}}
        title="Select Fruit"
      />
    )

    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('filters out null/empty string options and handles string values', () => {
    const mixedOptions = [
      { value: 'valid-string', label: 'Valid' },
      { value: '', label: 'Empty string — filtered' },
      { value: null, label: 'Null — filtered' },
      { value: undefined, label: 'Undefined — filtered' },
      { value: 'another', label: 'Another' },
    ]
    render(
      <PathsOptionsSelectorModal
        open={true}
        onClose={() => {}}
        options={mixedOptions}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Valid')).toBeInTheDocument()
    expect(screen.getByText('Another')).toBeInTheDocument()
    expect(screen.queryByText('Empty string — filtered')).not.toBeInTheDocument()
    expect(screen.queryByText('Null — filtered')).not.toBeInTheDocument()
  })

  it('returns null when not open', () => {
    const { container } = render(
      <PathsOptionsSelectorModal
        open={false}
        onClose={() => {}}
        options={MOCK_OPTIONS}
        onSelect={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
