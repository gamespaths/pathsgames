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

describe('RegistryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMatchRegistry.mockResolvedValue({ key: 'signal', values: ['red'] })
    deleteMatchRegistry.mockResolvedValue({ key: 'signal', values: [] })
  })

  it('renders the key, its whole set and the multi flag', () => {
    render(<RegistryCard registry={[SINGLE, MULTI]} />)
    expect(screen.getByText('signal')).toBeInTheDocument()
    expect(screen.getByText('Ledger, letter')).toBeInTheDocument()
    expect(screen.getByText('yes')).toBeInTheDocument()
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
})
