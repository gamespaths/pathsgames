import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StoryImportPage from '../../pages/StoryImportPage'

vi.mock('../../api/storyApi', () => ({
  listAllStories: vi.fn(),
  deleteStory:    vi.fn(),
  importStory:    vi.fn(),
}))
import { importStory } from '../../api/storyApi'

function renderPage() {
  return render(<MemoryRouter><StoryImportPage /></MemoryRouter>)
}

describe('StoryImportPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders page title', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Import Story/i })).toBeInTheDocument()
  })

  it('Import button is disabled when textarea is empty', () => {
    renderPage()
    expect(screen.getByText(/Import Story/i, { selector: 'button' })).toBeDisabled()
  })

  it('shows JSON error on invalid JSON input', async () => {
    renderPage()
    const ta = screen.getByPlaceholderText(/uuid/)
    // fireEvent.change avoids userEvent's curly-brace parsing
    fireEvent.change(ta, { target: { value: 'not_valid_json' } })
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    expect(await screen.findByText(/Invalid JSON/i)).toBeInTheDocument()
  })

  it('loads example JSON on button click', async () => {
    renderPage()
    await userEvent.click(screen.getByText(/Load example JSON/i))
    const ta = screen.getByPlaceholderText(/uuid/)
    expect(ta.value).toContain('"author"')
  })

  it('calls importStory with parsed object on valid JSON', async () => {
    importStory.mockResolvedValue({ storyUuid: 'new-uuid', status: 'IMPORTED', textsImported: 2 })
    renderPage()
    await userEvent.click(screen.getByText(/Load example JSON/i))
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    await waitFor(() => expect(importStory).toHaveBeenCalledOnce())
    expect(await screen.findByText(/imported successfully/i)).toBeInTheDocument()
  })

  it('shows error alert when importStory fails', async () => {
    importStory.mockRejectedValue(new Error('Import failed'))
    renderPage()
    await userEvent.click(screen.getByText(/Load example JSON/i))
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    expect(await screen.findByText(/Import failed/i)).toBeInTheDocument()
  })
})
