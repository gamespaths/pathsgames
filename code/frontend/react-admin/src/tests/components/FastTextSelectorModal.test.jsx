import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FastTextSelectorModal from '../../components/common/story/FastTextSelectorModal'

const MOCK_TEXTS = [
  { idText: 1, lang: 'en', shortText: 'Hello', longText: 'Hello world' },
  { idText: 1, lang: 'it', shortText: 'Ciao', longText: 'Ciao mondo' },
  { idText: 2, lang: 'en', shortText: 'Bye', longText: 'Goodbye' },
]

describe('FastTextSelectorModal', () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const onSaveFastText = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when open is false', () => {
    render(
      <FastTextSelectorModal 
        open={false} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
      />
    )
    expect(screen.queryByText(/Fast Text Selector/i)).toBeNull()
  })

  it('renders list of texts when open is true', () => {
    render(
      <FastTextSelectorModal 
        open={true} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
      />
    )
    expect(screen.getByText(/Fast Text Selector/i)).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Ciao')).toBeInTheDocument()
    expect(screen.getByText('Bye')).toBeInTheDocument()
  })

  it('filters texts based on search input', () => {
    render(
      <FastTextSelectorModal 
        open={true} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
      />
    )
    const input = screen.getByPlaceholderText(/Search by text id/i)
    fireEvent.change(input, { target: { value: 'Bye' } })
    
    expect(screen.queryByText('Hello')).toBeNull()
    expect(screen.getByText('Bye')).toBeInTheDocument()
  })

  it('calls onSelect and onClose when a text is selected', () => {
    render(
      <FastTextSelectorModal 
        open={true} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
      />
    )
    const selectButtons = screen.getAllByText('Select')
    fireEvent.click(selectButtons[0])
    
    expect(onSelect).toHaveBeenCalledWith(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('switches to input-generator mode when New is clicked', () => {
    render(
      <FastTextSelectorModal 
        open={true} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
      />
    )
    fireEvent.click(screen.getByText('New'))
    expect(screen.getByText(/New text generator/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Insert text value')).toBeInTheDocument()
  })

  it('saves generated text and calls onSelect', async () => {
    onSaveFastText.mockResolvedValue({ idText: 3 })
    render(
      <FastTextSelectorModal 
        open={true} 
        onClose={onClose} 
        texts={MOCK_TEXTS} 
        onSelect={onSelect} 
        onSaveFastText={onSaveFastText}
        storyUuid="story-1"
      />
    )
    fireEvent.click(screen.getByText('New'))
    
    const input = screen.getByPlaceholderText('Insert text value')
    fireEvent.change(input, { target: { value: 'New Generated Text' } })
    fireEvent.click(screen.getByText('Save'))
    
    await waitFor(() => {
      expect(onSaveFastText).toHaveBeenCalledWith(expect.objectContaining({
        uuidStory: 'story-1',
        translations: expect.objectContaining({
          en: { shortText: 'New Generated Text', longText: 'New Generated Text' }
        })
      }))
      expect(onSelect).toHaveBeenCalledWith(3)
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('saves the generated text when Enter is pressed', async () => {
    onSaveFastText.mockResolvedValue({ idText: 9 })
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        onSaveFastText={onSaveFastText} storyUuid="story-1" />
    )
    fireEvent.click(screen.getByText('New'))
    const input = screen.getByPlaceholderText('Insert text value')
    fireEvent.change(input, { target: { value: 'Via Enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onSaveFastText).toHaveBeenCalled())
  })

  it('shows an error when the generated text cannot be saved', async () => {
    onSaveFastText.mockRejectedValue(new Error('save boom'))
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        onSaveFastText={onSaveFastText} storyUuid="story-1" />
    )
    fireEvent.click(screen.getByText('New'))
    fireEvent.change(screen.getByPlaceholderText('Insert text value'), { target: { value: 'X' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText(/save boom/i)).toBeInTheDocument()
  })

  it('returns to the list from the generator cancel button', () => {
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        onSaveFastText={onSaveFastText} storyUuid="story-1" />
    )
    fireEvent.click(screen.getByText('New'))
    // the ghost cancel button (the first <button> in the generator footer with the times icon)
    const cancelBtn = document.querySelector('.pg-btn-ghost')
    fireEvent.click(cancelBtn)
    expect(screen.getByPlaceholderText(/Search by text id/i)).toBeInTheDocument()
  })

  it('opens the creator modal in edit mode from the pen button', () => {
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        onSaveFastText={onSaveFastText} storyUuid="story-1" />
    )
    const penButtons = document.querySelectorAll('.fa-pen')
    fireEvent.click(penButtons[0].closest('button'))
    // FastTextCreatorModal is now open in edit mode
    expect(screen.getByText('Save Text')).toBeInTheDocument()
    expect(document.querySelector('.fa-edit')).toBeTruthy()
  })

  it('starts directly in input-generator mode when startMode is input-generator', () => {
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        onSaveFastText={onSaveFastText} storyUuid="story-1" startMode="input-generator" />
    )
    expect(screen.getByText(/New text generator/i)).toBeInTheDocument()
  })

  it('marks the currently selected id with the Selected label', () => {
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect}
        selectedId={1} />
    )
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('shows the empty state when no text matches the search', () => {
    render(
      <FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS} onSelect={onSelect} />
    )
    fireEvent.change(screen.getByPlaceholderText(/Search by text id/i), { target: { value: 'zzz' } })
    expect(screen.getByText('No text found')).toBeInTheDocument()
  })

  it('renders with no text list at all', () => {
    render(<FastTextSelectorModal open onClose={onClose} onSelect={onSelect} />)
    expect(screen.getByText('No text found')).toBeInTheDocument()
  })

  it('editing a row that has only English fills the Italian side with empty strings', () => {
    render(<FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS}
                                  onSelect={onSelect} onSaveFastText={onSaveFastText} />)
    // Row #2 carries no Italian translation at all.
    fireEvent.click(document.querySelectorAll('.fa-pen')[1].closest('button'))
    expect(screen.getByText(/Fast Text Creator/i)).toBeInTheDocument()
  })

  it('closing the creator without a result selects nothing', () => {
    render(<FastTextSelectorModal open onClose={onClose} texts={MOCK_TEXTS}
                                  onSelect={onSelect} onSaveFastText={onSaveFastText} />)
    fireEvent.click(document.querySelectorAll('.fa-pen')[0].closest('button'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('the generator refuses to save a blank text', async () => {
    render(<FastTextSelectorModal open startMode="input-generator" onClose={onClose}
                                  texts={MOCK_TEXTS} onSelect={onSelect}
                                  onSaveFastText={onSaveFastText} />)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onSaveFastText).not.toHaveBeenCalled())
  })

  it('the generator falls back to the id it proposed when the answer names none', async () => {
    onSaveFastText.mockResolvedValue({})
    render(<FastTextSelectorModal open startMode="input-generator" onClose={onClose}
                                  texts={MOCK_TEXTS} onSelect={onSelect}
                                  onSaveFastText={onSaveFastText} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A new line' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(3))
    expect(onClose).toHaveBeenCalled()
  })

  it('a failing save with no message shows the generic error', async () => {
    onSaveFastText.mockRejectedValue({})
    render(<FastTextSelectorModal open startMode="input-generator" onClose={onClose}
                                  texts={MOCK_TEXTS} onSelect={onSelect}
                                  onSaveFastText={onSaveFastText} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A new line' } })
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByText('Cannot save generated text')).toBeInTheDocument()
  })
})
