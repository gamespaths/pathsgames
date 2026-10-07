import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StoryImportPage from '../../pages/story/StoryImportPage'

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

  it('lifts a nested story header before sending it to the backend', async () => {
    importStory.mockResolvedValue({ storyUuid: 'u1', status: 'IMPORTED' })
    renderPage()
    const ta = screen.getByPlaceholderText(/uuid/)
    fireEvent.change(ta, { target: { value: JSON.stringify({ story: { uuid: '0a1b2c3d-4e5f-4a6b-8c7d-000000000001', author: 'A' }, texts: [] }) } })
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    await waitFor(() => expect(importStory).toHaveBeenCalledWith({ uuid: '0a1b2c3d-4e5f-4a6b-8c7d-000000000001', author: 'A', texts: [] }))
  })

  it('sends a JSON without null fields as it is', async () => {
    importStory.mockResolvedValue({ storyUuid: 'u2', status: 'IMPORTED' })
    renderPage()
    const ta = screen.getByPlaceholderText(/uuid/)
    fireEvent.change(ta, { target: { value: JSON.stringify({ uuid: '0a1b2c3d-4e5f-4a6b-8c7d-000000000002', items: [{ id: 1 }] }) } })
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    await waitFor(() => expect(importStory).toHaveBeenCalledWith({ uuid: '0a1b2c3d-4e5f-4a6b-8c7d-000000000002', items: [{ id: 1 }] }))
  })

  it('shows error alert when importStory fails', async () => {
    importStory.mockRejectedValue(new Error('Import failed'))
    renderPage()
    await userEvent.click(screen.getByText(/Load example JSON/i))
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    expect(await screen.findByText(/Import failed/i)).toBeInTheDocument()
  })

  it('v0.41.5 — a malformed story uuid is refused before the API call', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/uuid/), { target: { value: '{"uuid":"story-001"}' } })
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    expect(await screen.findByText(/Invalid story uuid "story-001"/)).toBeInTheDocument()
    expect(importStory).not.toHaveBeenCalled()
  })

  it('v0.41.5 — an uppercase story uuid is sent as is (the backend lowercases it)', async () => {
    importStory.mockResolvedValue({ storyUuid: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', status: 'IMPORTED' })
    renderPage()
    const uuid = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D'
    fireEvent.change(screen.getByPlaceholderText(/uuid/), { target: { value: `{"uuid":"${uuid}"}` } })
    await userEvent.click(screen.getByText(/Import Story/i, { selector: 'button' }))
    await waitFor(() => expect(importStory).toHaveBeenCalledWith({ uuid }))
  })
})

