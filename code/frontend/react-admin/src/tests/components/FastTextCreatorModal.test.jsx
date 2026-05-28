import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FastTextCreatorModal from '../../components/common/story/FastTextCreatorModal'

describe('FastTextCreatorModal', () => {
  const MOCK_STORY_OPTIONS = [
    { value: 's1', label: 'Story 1' },
    { value: 's2', label: 'Story 2' }
  ]

  const onSave = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<FastTextCreatorModal open={false} onClose={onClose} onSave={onSave} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders correctly when open', () => {
    render(<FastTextCreatorModal open={true} onClose={onClose} onSave={onSave} storyOptions={MOCK_STORY_OPTIONS} />)
    expect(screen.getByText('Fast Text Creator')).toBeInTheDocument()
    expect(screen.getByLabelText('Story')).toBeInTheDocument()
    expect(screen.getByLabelText('Text ID')).toBeInTheDocument()
  })

  it('handles input changes and submission', async () => {
    onSave.mockResolvedValue({ idText: 500 })
    render(<FastTextCreatorModal open={true} onClose={onClose} onSave={onSave} storyOptions={MOCK_STORY_OPTIONS} />)
    
    await userEvent.type(screen.getByLabelText('Text ID'), '500')
    await userEvent.selectOptions(screen.getByLabelText('Story'), 's2')
    
    await userEvent.type(screen.getByLabelText('en-short'), 'English Title') 
    await userEvent.type(screen.getByLabelText('en-long'), 'English Long Description') 
    
    await userEvent.click(screen.getByText('Save Text'))
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      uuidStory: 's2',
      idText: 500,
      translations: expect.objectContaining({
        en: { shortText: 'English Title', longText: 'English Long Description' }
      })
    }))
    
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error when submission fails', async () => {
    onSave.mockRejectedValue(new Error('API Error'))
    render(<FastTextCreatorModal open={true} onClose={onClose} onSave={onSave} storyOptions={MOCK_STORY_OPTIONS} initialTextId={123} />)
    
    await userEvent.click(screen.getByText('Save Text'))
    
    expect(await screen.findByText(/API Error/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose(null) on cancel', async () => {
    render(<FastTextCreatorModal open={true} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledWith(null)
  })
})
