import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchDetailModal from '../../components/match/MatchDetailModal'
import EntityTable from '../../components/common/story/EntityTable'
import EntityForm from '../../components/common/story/EntityForm'

/**
 * The remaining "the payload does not have that key at all" shapes: an /info body
 * with no locations and no registry, an entity table with no texts to resolve
 * against, and an option selector configured without an option list.
 */

describe('MatchDetailModal with neither locations nor registry', () => {
  it('counts both sections as zero and renders their empty rows', () => {
    render(<MatchDetailModal
      detail={{ uuid: 'm1', loading: false, error: null, storyCtx: null, info: { match: {} } }}
      onClose={vi.fn()} />)

    expect(screen.getByText(/Locations \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No locations.')).toBeInTheDocument()
    expect(screen.getByText(/Registry \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No registry entries.')).toBeInTheDocument()
  })
})

describe('EntityTable without a text list', () => {
  const columns = [
    { key: 'idTextName', label: 'Name', type: 'idTextName' },
    { key: 'note', label: 'Note' },
  ]

  it('renders the text column empty and keeps the row searchable by its raw values', async () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', idTextName: 7, note: 'alpha' }]}
      columns={columns}
      texts={null}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/Search in table/i), 'alpha')
    expect(screen.getByText('alpha')).toBeInTheDocument()
  })

  it('ignores a relation value that no option matches', async () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', note: 99 }]}
      columns={columns}
      relationOptionsByField={{ note: { options: [{ value: 1, label: 'One' }] } }}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/Search in table/i), 'one')
    expect(screen.getByText('No items found.')).toBeInTheDocument()
  })

  it('spans the empty row across the card columns when the table opts into them', async () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', idCard: 2, note: 'alpha' }]}
      columns={columns}
      showCardBackColumn
      onOpenIdCardForm={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    // idCard + idCardBack columns are both shown; the back cell offers the clone.
    expect(screen.getByTitle(/Duplicate the Card as Card Back/i)).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText(/Search in table/i), 'zzz')
    const emptyCell = screen.getByText('No items found.')
    expect(emptyCell).toHaveAttribute('colspan', '6')
  })
})

describe('EntityForm option selector without options', () => {
  it('labels the value by id and clears it back to an empty string', async () => {
    render(<EntityForm
      entity={{ uuid: 'e-1', idEvent: 4 }}
      fields={[{ key: 'idEvent', label: 'Event', type: 'number' }]}
      pathSelectorOptions={{ idEvent: {} }}   // configured, but with no list yet
      onSave={vi.fn()}
      onCancel={vi.fn()} />)

    expect(screen.getByTitle('#4')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('Clear Event'))
    expect(document.querySelector('input[name="idEvent"]')).toHaveValue('')
  })

  it('opens the option selector and writes the picked value back', async () => {
    const onSave = vi.fn()
    render(<EntityForm
      entity={{ uuid: 'e-1' }}
      fields={[{ key: 'idEvent', label: 'Event', type: 'number' }]}
      pathSelectorOptions={{ idEvent: { options: [{ value: 4, label: 'The ambush' }] } }}
      onSave={onSave}
      onCancel={vi.fn()} />)

    await userEvent.click(screen.getByTitle('Select Event'))
    await userEvent.click(await screen.findByRole('button', { name: 'Select' }))

    expect(screen.getByTitle('The ambush')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ idEvent: 4 }))
  })
})
