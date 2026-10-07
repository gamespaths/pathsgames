import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PathsSelector from '../../../../components/common/story/PathsSelector'

/**
 * The hidden input is what a surrounding <form> submits, so it must never carry the
 * literal "null" or "undefined" a missing value would otherwise stringify to.
 */
describe('PathsSelector', () => {
  it('a missing value is submitted as an empty string, never as "null"', () => {
    const { rerender } = render(<PathsSelector label="Card ID" name="idCard" value={null} />)
    expect(document.querySelector('input[name="idCard"]')).toHaveValue('')

    rerender(<PathsSelector label="Card ID" name="idCard" />)
    expect(document.querySelector('input[name="idCard"]')).toHaveValue('')

    rerender(<PathsSelector label="Card ID" name="idCard" value={7} />)
    expect(document.querySelector('input[name="idCard"]')).toHaveValue('7')
  })

  it('shows the placeholder until a display value is given', () => {
    const { rerender } = render(<PathsSelector label="Card ID" name="idCard" />)
    expect(screen.getByText('Not selected')).toBeInTheDocument()

    rerender(<PathsSelector label="Card ID" name="idCard" displayValue="#7 Hall" />)
    expect(screen.getByText('#7 Hall')).toBeInTheDocument()
  })

  it('the select, new and clear buttons call their handlers', () => {
    const onOpenSelector = vi.fn()
    const onOpenCreator = vi.fn()
    const onClear = vi.fn()
    render(<PathsSelector label="Card ID" name="idCard"
                          onOpenSelector={onOpenSelector} onOpenCreator={onOpenCreator}
                          onClear={onClear} />)

    fireEvent.click(screen.getByTitle('Select Card ID'))
    fireEvent.click(screen.getByTitle('New Card ID'))
    fireEvent.click(screen.getByTitle('Clear Card ID'))

    expect(onOpenSelector).toHaveBeenCalled()
    expect(onOpenCreator).toHaveBeenCalled()
    expect(onClear).toHaveBeenCalled()
  })
})
