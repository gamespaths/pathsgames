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
})
