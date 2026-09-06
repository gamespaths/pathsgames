import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/matchApi', () => ({
  updateMatchRegistry: vi.fn(),
  deleteMatchRegistry: vi.fn(),
}))

import RegistryCard from '../../components/match/detail/RegistryCard'
import { updateMatchRegistry, deleteMatchRegistry } from '../../api/matchApi'

const SINGLE = { uuid: 'r-1', key: 'signal', values: ['green'], multiValue: false }
const MULTI  = { uuid: 'r-2', key: 'case_notes', values: ['Ledger', 'letter'], multiValue: true }
// v0.36.3 — only the admin payload carries one of these.
const HIDDEN = { uuid: 'r-3', key: 'secret_plan', values: ['ready'], multiValue: false, visible: false }

describe('RegistryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMatchRegistry.mockResolvedValue({ key: 'signal', values: ['red'] })
    deleteMatchRegistry.mockResolvedValue({ key: 'signal', values: [] })
  })

  it('renders the key, every member of its set and the multi flag', () => {
    render(<RegistryCard registry={[SINGLE, MULTI]} />)
    expect(screen.getByText('signal')).toBeInTheDocument()
    // v0.36.3 — one column holds the whole set, a chip per member rather than a joined string.
    expect(screen.getByText('Ledger')).toBeInTheDocument()
    expect(screen.getByText('letter')).toBeInTheDocument()
    expect(screen.getByText('yes')).toBeInTheDocument()
  })

  it('shows the members without a ✕ when there is no match to write to', () => {
    render(<RegistryCard registry={[MULTI]} />)
    expect(screen.getByText('Ledger')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Remove /)).not.toBeInTheDocument()
  })

  it('says of every key whether the player can see it', () => {
    render(<RegistryCard registry={[SINGLE, HIDDEN]} />)
    expect(screen.getByText('public')).toBeInTheDocument()
    expect(screen.getByText('hidden')).toBeInTheDocument()
  })

  it('counts the hidden keys in the title, so the console knows what it is holding', () => {
    render(<RegistryCard registry={[SINGLE, HIDDEN]} />)
    expect(screen.getByText(/Registry \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/1 hidden/)).toBeInTheDocument()
  })

  it('says nothing about hidden keys when every one of them is public', () => {
    render(<RegistryCard registry={[SINGLE, MULTI]} />)
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument()
  })

  it('treats an entry with no visible flag as public — an older payload is not a secret', () => {
    render(<RegistryCard registry={[{ key: 'legacy', values: ['x'], multiValue: false }]} />)
    expect(screen.getByText('public')).toBeInTheDocument()
  })

  it('shows an em dash for a key whose set is empty', () => {
    render(<RegistryCard registry={[{ key: 'gone', values: [], multiValue: true }]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    render(<RegistryCard registry={[]} />)
    expect(screen.getByText(/No registry entries/i)).toBeInTheDocument()
  })

  it('offers no edit controls without a match uuid — the read-only board', () => {
    render(<RegistryCard registry={[SINGLE]} />)
    expect(screen.queryByLabelText('Edit signal')).not.toBeInTheDocument()
    expect(screen.queryByText(/Add a key/i)).not.toBeInTheDocument()
  })

  it('writes a value and refreshes the card', async () => {
    const onChanged = vi.fn()
    render(<RegistryCard registry={[SINGLE]} matchUuid="m-1" onChanged={onChanged} />)

    await userEvent.click(screen.getByLabelText('Edit signal'))
    await userEvent.type(screen.getByLabelText('New value for signal'), 'red')
    await userEvent.click(screen.getByTitle('replace the value'))

    await waitFor(() => expect(updateMatchRegistry)
      .toHaveBeenCalledWith('m-1', { key: 'signal', value: 'red' }))
    expect(onChanged).toHaveBeenCalled()
  })

  it('empties a key outright when no value is named', async () => {
    render(<RegistryCard registry={[SINGLE]} matchUuid="m-1" />)

    await userEvent.click(screen.getByLabelText('Clear signal'))

    await waitFor(() => expect(deleteMatchRegistry).toHaveBeenCalledWith('m-1', 'signal'))
  })

  it('takes one member away from a multi key', async () => {
    render(<RegistryCard registry={[MULTI]} matchUuid="m-1" />)

    await userEvent.click(screen.getByTitle('remove Ledger'))

    await waitFor(() => expect(deleteMatchRegistry)
      .toHaveBeenCalledWith('m-1', 'case_notes', 'Ledger'))
  })

  it('puts the ✕ on the button and leaves the member itself as text', async () => {
    render(<RegistryCard registry={[MULTI]} matchUuid="m-1" />)

    // The clickable thing is the ✕, named for what it removes; the value is not a button.
    const remove = screen.getByLabelText('Remove Ledger from case_notes')
    expect(remove.tagName).toBe('BUTTON')
    expect(remove).toHaveTextContent('')
    expect(screen.getAllByText('Ledger').some(el => el.closest('button'))).toBe(false)

    await userEvent.click(remove)
    await waitFor(() => expect(deleteMatchRegistry)
      .toHaveBeenCalledWith('m-1', 'case_notes', 'Ledger'))
  })

  it('wraps the member list instead of running it off the table', () => {
    render(<RegistryCard registry={[MULTI]} matchUuid="m-1" />)

    const chip = screen.getByLabelText('Remove Ledger from case_notes').closest('span')
    expect(chip.parentElement).toHaveStyle({ display: 'flex', flexWrap: 'wrap' })
  })

  it('gives a single-valued key the same chip — its ✕ is the compare-and-clear', async () => {
    render(<RegistryCard registry={[SINGLE]} matchUuid="m-1" />)

    await userEvent.click(screen.getByLabelText('Remove green from signal'))

    await waitFor(() => expect(deleteMatchRegistry)
      .toHaveBeenCalledWith('m-1', 'signal', 'green'))
  })

  it('adds a key the match has never written', async () => {
    render(<RegistryCard registry={[]} matchUuid="m-1" />)

    await userEvent.click(screen.getByText(/Add a key/i))
    await userEvent.type(screen.getByLabelText('New registry key'), 'vault_seen')
    await userEvent.type(screen.getByLabelText('New registry value'), 'first')
    await userEvent.click(screen.getByText('Write'))

    await waitFor(() => expect(updateMatchRegistry)
      .toHaveBeenCalledWith('m-1', { key: 'vault_seen', value: 'first' }))
  })

  it('surfaces a failed write instead of silently swallowing it', async () => {
    updateMatchRegistry.mockRejectedValue(new Error('registry is locked'))
    render(<RegistryCard registry={[SINGLE]} matchUuid="m-1" />)

    await userEvent.click(screen.getByLabelText('Edit signal'))
    await userEvent.click(screen.getByTitle('replace the value'))

    expect(await screen.findByText(/registry is locked/i)).toBeInTheDocument()
  })

  it('Enter in the value box writes the key, as the check button would', async () => {
    render(<RegistryCard registry={[SINGLE]} matchUuid="m1" />)
    await userEvent.click(screen.getByLabelText('Edit signal'))
    const box = screen.getByLabelText('New value for signal')
    await userEvent.type(box, 'red{Enter}')

    await waitFor(() => expect(updateMatchRegistry).toHaveBeenCalledWith('m1', { key: 'signal', value: 'red' }))
  })

  it('any other key in the value box writes nothing', async () => {
    render(<RegistryCard registry={[SINGLE]} matchUuid="m1" />)
    await userEvent.click(screen.getByLabelText('Edit signal'))
    await userEvent.type(screen.getByLabelText('New value for signal'), 'red')

    expect(updateMatchRegistry).not.toHaveBeenCalled()
  })

  it('a multi key offers to add a member; a single one to replace the value', async () => {
    const { rerender } = render(<RegistryCard registry={[MULTI]} matchUuid="m1" />)
    await userEvent.click(screen.getByLabelText('Edit case_notes'))
    expect(screen.getByTitle('add this member')).toBeInTheDocument()

    rerender(<RegistryCard registry={[SINGLE]} matchUuid="m1" />)
    await userEvent.click(screen.getByLabelText('Edit signal'))
    expect(screen.getByTitle('replace the value')).toBeInTheDocument()
  })

  it('a failing write with no message shows the generic one', async () => {
    updateMatchRegistry.mockRejectedValue({})
    render(<RegistryCard registry={[SINGLE]} matchUuid="m1" />)
    await userEvent.click(screen.getByLabelText('Edit signal'))
    await userEvent.click(screen.getByTitle('replace the value'))

    expect(await screen.findByText('The registry write failed.')).toBeInTheDocument()
  })

  it('a row with no values at all still renders its dash and its buttons', () => {
    render(<RegistryCard registry={[{ key: 'bare', multiValue: true }]} matchUuid="m1" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByLabelText('Clear bare')).toBeInTheDocument()
  })
})
