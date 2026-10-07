import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChipListInput from '../../../../components/common/story/ChipListInput'

describe('ChipListInput (Step 37)', () => {
  it('renders one chip per member of the pipe list, trimmed', () => {
    render(<ChipListInput id="c" value=" ledger | letter " onChange={() => {}} />)

    expect(screen.getByTestId('chip-ledger')).toBeTruthy()
    expect(screen.getByTestId('chip-letter')).toBeTruthy()
  })

  it('says so when the list is empty, because an empty condition never fires', () => {
    render(<ChipListInput id="c" value="" onChange={() => {}} />)

    expect(screen.getByText(/never satisfied/i)).toBeTruthy()
  })

  it('adds a value on Enter and hands back the pipe form, never the typed one', async () => {
    const onChange = vi.fn()
    render(<ChipListInput id="c" value="ledger" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'letter{Enter}')

    expect(onChange).toHaveBeenCalledWith('ledger|letter')
  })

  it('adds on the button too, and refuses a duplicate whatever case it is typed in', async () => {
    const onChange = vi.fn()
    render(<ChipListInput id="c" value="ledger" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'LEDGER')
    await userEvent.click(screen.getByLabelText('Add value'))
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox'), 'letter')
    await userEvent.click(screen.getByLabelText('Add value'))
    expect(onChange).toHaveBeenCalledWith('ledger|letter')
  })

  it('ignores a blank draft', async () => {
    const onChange = vi.fn()
    render(<ChipListInput id="c" value="ledger" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a member, and an emptied list is handed back as an empty string', async () => {
    const onChange = vi.fn()
    render(<ChipListInput id="c" value="ledger|letter" onChange={onChange} />)

    await userEvent.click(screen.getByLabelText('Remove ledger'))
    expect(onChange).toHaveBeenCalledWith('letter')

    onChange.mockClear()
    render(<ChipListInput id="d" value="only" onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Remove only'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
