import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from '../../components/common/ConfirmModal'
import EditStatsModal from '../../components/match/detail/EditStatsModal'
import PathsOptionsSelectorModal from '../../components/common/story/PathsOptionsSelectorModal'
import { buildTurnOrder } from '../../utils/turnPriority'
import {
  buildLocationOptions, buildKeysOptions, getOptionDisplay, getTextDisplay,
  normalizeIdCardPayload,
} from '../../pages/story/StoryEditorPageHelpers'

vi.mock('../../api/matchApi', () => ({ changePlayerStatistics: vi.fn() }))
import { changePlayerStatistics } from '../../api/matchApi'

/**
 * The small pieces of the console, driven through the shapes their callers can
 * legitimately hand them: a non-destructive confirm, a player whose flags come
 * from the legacy field names, helper lists that are simply not there yet.
 */

describe('ConfirmModal in its non-destructive form', () => {
  it('uses the question icon and the gold button when danger is off', () => {
    const { container } = render(
      <ConfirmModal title="Publish" message="Publish this story?" danger={false}
        onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(container.querySelector('.fa-question-circle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('pg-btn-gold')
  })
})

describe('EditStatsModal', () => {
  const player = { uuid: 'c1', sleeping: true, coma: true }   // legacy flag names

  beforeEach(() => {
    vi.clearAllMocks()
    changePlayerStatistics.mockResolvedValue({})
  })

  it('reads the legacy sleeping/coma flags and offers the wake-up note when coma is cleared', async () => {
    render(<EditStatsModal matchUuid="m1" player={player} onClose={vi.fn()} onSaved={vi.fn()} />)

    const comaBox = screen.getByTestId('stats-coma')
    expect(comaBox).toBeChecked()
    expect(screen.getByTestId('stats-sleeping')).toBeChecked()

    await userEvent.click(comaBox)
    expect(screen.getByText(/Clearing the coma also wakes the character/)).toBeInTheDocument()
  })

  it('sends -1 for a field that is not a number and reports the API message', async () => {
    changePlayerStatistics.mockRejectedValue({ response: { data: { message: 'stats refused' } } })
    render(<EditStatsModal matchUuid="m1" player={{ uuid: 'c1', dex: 'abc' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    expect(changePlayerStatistics).toHaveBeenCalledWith('m1', 'c1',
      expect.objectContaining({ dex: -1, sleeping: false, coma: false }))
    expect(await screen.findByText('stats refused')).toBeInTheDocument()
  })

  it('closes on a backdrop click and on Escape, but not on a click inside the panel', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <EditStatsModal matchUuid="m1" player={{ uuid: 'c1' }} onClose={onClose} onSaved={vi.fn()} />)

    const backdrop = container.firstChild
    await userEvent.click(screen.getByText('Edit statistics'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(backdrop, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(backdrop, { key: 'Escape' })
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('edits a numeric field and saves it', async () => {
    const onSaved = vi.fn()
    render(<EditStatsModal matchUuid="m1" player={{ uuid: 'c1', energy: 5 }} onClose={vi.fn()} onSaved={onSaved} />)

    const energy = screen.getAllByRole('spinbutton')[3]   // dex, int, con, energy…
    await userEvent.clear(energy)
    await userEvent.type(energy, '9')
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(changePlayerStatistics).toHaveBeenCalledWith('m1', 'c1', expect.objectContaining({ energy: 9 }))
  })
})

describe('PathsOptionsSelectorModal', () => {
  const options = [{ value: 1, label: 'The Tavern' }, { value: 2, label: null }]

  it('searches by label and treats a blank string value as no selection', async () => {
    const onSelect = vi.fn()
    render(<PathsOptionsSelectorModal
      open
      title="Locations"
      options={[...options, { value: '   ' }, { value: {} }]}
      selectedValue={null}
      onSelect={onSelect}
      onClose={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText('Search...'), 'tavern')
    expect(screen.getByText('The Tavern')).toBeInTheDocument()
  })

  it('keeps a non-empty string value as a selection', () => {
    render(<PathsOptionsSelectorModal
      open
      title="Locations"
      options={[{ value: 'gate', label: 'A named key' }]}
      selectedValue="gate"
      onSelect={vi.fn()}
      onClose={vi.fn()} />)

    expect(screen.getByText('gate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selected' })).toBeInTheDocument()
  })
})

describe('buildTurnOrder tie-breaks', () => {
  it('sorts equal priorities by uuid, tolerating a row without one', () => {
    const order = buildTurnOrder([
      { uuid: 'b', dexterity: 1 },
      { dexterity: 1 },          // no uuid at all
      { uuid: 'a', dexterity: 1 },
    ])
    expect(order.map(p => p.uuid)).toEqual([undefined, 'a', 'b'])
  })

  it('returns an empty order for a non-list', () => {
    expect(buildTurnOrder(null)).toEqual([])
  })
})

describe('StoryEditorPage helpers without the reference lists', () => {
  it('labels a location whose name text is missing', () => {
    expect(buildLocationOptions([{ id_location: 3, idTextName: 9 }], null))
      .toEqual([{ value: 3, label: '#3 (no name text)' }])
  })

  it('drops keys without a name and labels a valueless one by name alone', () => {
    expect(buildKeysOptions([{ value: 'x' }, { name: 'gate' }]))
      .toEqual([{ value: 'gate', label: 'gate' }])
    expect(buildKeysOptions(null)).toEqual([])
  })

  it('falls back to #value and to the not-found text label', () => {
    expect(getOptionDisplay(null, 7)).toBe('#7')
    expect(getTextDisplay(null, 7)).toBe('Text #7 (EN not found)')
    expect(getTextDisplay([{ idText: 7, lang: 'en', shortText: '' }], 7)).toBe('#7 (empty)')
  })

  it('normalises the snake-case card id and leaves a non-numeric one alone', () => {
    expect(normalizeIdCardPayload({ id_card: '12' })).toMatchObject({ idCard: 12, id_card: 12 })
    expect(normalizeIdCardPayload({ idCard: 'abc' })).toMatchObject({ idCard: 'abc' })
    expect(normalizeIdCardPayload({ idCard: null })).toMatchObject({ idCard: '', id_card: null })
    expect(normalizeIdCardPayload({ other: 1 })).toEqual({ other: 1 })
  })
})
