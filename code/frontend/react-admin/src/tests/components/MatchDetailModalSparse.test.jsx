import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchDetailModal, { StatusBadge } from '../../components/match/MatchDetailModal'
import EntityTable from '../../components/common/story/EntityTable'

/**
 * Both of these render around a story context that may be missing entirely: the
 * admin lists a match whose story was deleted, or a story tab whose texts have not
 * loaded. This suite drives those shapes — the `|| fallback` half of every lookup.
 */

describe('MatchDetailModal without a story context', () => {
  const baseInfo = {
    match: {},
    currentLocationUuid: 'loc-x',
    locations: [{ idLocation: 4 }],           // no uuid, no flags, no clock
    registry: [{ key: 'gate', stringValue: 'OPEN' }],
  }

  it('dashes out every story field the context cannot resolve', () => {
    render(<MatchDetailModal
      detail={{ uuid: 'match-uuid-1234', loading: false, info: baseInfo, error: null, storyCtx: null }}
      onClose={vi.fn()} />)

    expect(screen.getByText('unknown')).toBeInTheDocument()          // story title
    expect(screen.getByText('Single')).toBeInTheDocument()           // singlePlayer !== 0
    expect(screen.getByText(/Current location: —/)).toBeInTheDocument()
    expect(screen.getByText(/Locations \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Registry \(1\)/)).toBeInTheDocument()

    // The location row falls back to #id, and its flags/clock to no/no/0.
    const row = screen.getByText('#4').closest('tr')
    const cells = within(row).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('no')
    expect(cells[3]).toHaveTextContent('no')
    expect(cells[4]).toHaveTextContent('0')

    // The registry row has no int value.
    const regRow = screen.getByText('gate').closest('tr')
    expect(within(regRow).getAllByRole('cell')[2]).toHaveTextContent('—')
  })

  it('shows the raw uuids when difficulty, character and class do not resolve', () => {
    render(<MatchDetailModal
      detail={{
        uuid: 'match-uuid-1234',
        loading: false,
        error: null,
        storyCtx: { story: {}, texts: null, difficulties: [], characters: null, classes: [], traits: [], storyLocations: [] },
        info: {
          ...baseInfo,
          match: {
            singlePlayer: 0,
            difficultyUuid: 'diff-uuid',
            characterTemplateUuid: 'ct-uuid',
            classUuid: 'class-uuid',
            traitUuids: ['trait-uuid'],
          },
        },
      }}
      onClose={vi.fn()} />)

    expect(screen.getByText('Multiplayer')).toBeInTheDocument()
    expect(screen.getByText('diff-uuid')).toBeInTheDocument()
    expect(screen.getByText('ct-uuid')).toBeInTheDocument()
    expect(screen.getByText('class-uuid')).toBeInTheDocument()
    expect(screen.getByText('trait-uu…')).toBeInTheDocument()  // unresolved trait → short uuid
  })

  it('resolves the named entities when the story context has them', () => {
    const texts = [{ idText: 7, lang: 'en', shortText: 'Hardened' }]
    render(<MatchDetailModal
      detail={{
        uuid: 'match-uuid-1234',
        loading: false,
        error: null,
        storyCtx: {
          story: { title: 'Tale', author: null, creator: 'A creator' },
          texts,
          difficulties: [{ uuid: 'diff-uuid', idTextName: 7 }],
          characters: [{ uuid: 'ct-uuid' }],                 // no idTextName → dash
          classes: [{ uuid: 'class-uuid', idTextName: 99 }], // unknown text → #99
          traits: [{ uuid: 'trait-uuid', idTextName: 7 }],
          storyLocations: [{ uuid: 'loc-x', idTextName: 7 }],
        },
        info: {
          ...baseInfo,
          match: {
            difficultyUuid: 'diff-uuid',
            characterTemplateUuid: 'ct-uuid',
            classUuid: 'class-uuid',
            traitUuids: ['trait-uuid'],
          },
        },
      }}
      onClose={vi.fn()} />)

    expect(screen.getByText('A creator')).toBeInTheDocument()  // author null → creator
    expect(screen.getByText('#99')).toBeInTheDocument()        // class text id not in texts
    expect(screen.getByText(/Current location: Hardened/)).toBeInTheDocument()
  })

  it('keeps the modal open when the panel itself is clicked', async () => {
    const onClose = vi.fn()
    render(<MatchDetailModal
      detail={{ uuid: 'm', loading: false, info: baseInfo, error: null, storyCtx: null }}
      onClose={onClose} />)

    const panel = document.querySelector('.pg-modal')
    await userEvent.click(panel)
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('StatusBadge falls back to the info colour and a dash', () => {
    const { container } = render(<StatusBadge status={undefined} />)
    expect(container.firstChild).toHaveClass('pg-badge-info')
    expect(container.firstChild).toHaveTextContent('—')
  })
})

describe('EntityTable with unresolvable references', () => {
  const columns = [{ key: 'idTextName', label: 'Name' }, { key: 'note', label: 'Note' }]

  it('renders the empty state when nothing matches the search', async () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', note: 'alpha' }]}
      columns={columns}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/Search in table/i), 'nothing-like-this')
    expect(screen.getByText('No items found.')).toBeInTheDocument()
  })

  it('searches over raw values while ignoring nulls and unresolvable text ids', async () => {
    render(<EntityTable
      entities={[
        { id: 1, uuid: 'e-1', idTextName: 500, note: null },   // text id not in `texts`
        { id: 2, uuid: 'e-2', idTextName: 7, note: 'beta' },
      ]}
      columns={columns}
      texts={[{ idText: 7, lang: 'it', shortText: 'Sentiero' }]}  // no `en` row → falls back
      relationOptionsByField={{ note: { options: [] } }}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    const search = screen.getByPlaceholderText(/Search in table/i)
    await userEvent.type(search, 'sentiero')
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.queryByText('500')).not.toBeInTheDocument()
  })

  it('falls back to the row index and a dash when a row has neither id nor uuid', () => {
    render(<EntityTable
      entities={[{ note: 'orphan' }]}
      columns={columns}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    const row = screen.getByText('orphan').closest('tr')
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('—')
  })

  it('offers the duplicate action when a row carries the key but no card back', async () => {
    const onDuplicateCardBack = vi.fn()
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', idCard: 3, idCardBack: null, note: 'x' }]}
      columns={columns}
      onOpenIdCardForm={vi.fn()}
      onDuplicateCardBack={onDuplicateCardBack}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    expect(screen.getByText('Card Back')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle(/Duplicate the Card as Card Back/i))
    expect(onDuplicateCardBack).toHaveBeenCalled()
  })

  it('dashes the card-back cell when the row has neither card nor card back', () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', idCardBack: null, note: 'x' }]}
      columns={columns}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    const row = screen.getByText('x').closest('tr')
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('—')
  })

  it('labels a relation by its value when the option carries no label', async () => {
    render(<EntityTable
      entities={[{ id: 1, uuid: 'e-1', note: 42 }]}
      columns={columns}
      relationOptionsByField={{ note: { options: [{ value: 42 }] } }}
      onEdit={vi.fn()}
      onDelete={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/Search in table/i), '#42')
    expect(screen.queryByText('No items found.')).not.toBeInTheDocument()
  })
})
