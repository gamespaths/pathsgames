// v1.7.0 V1 step 11 — the reason dialog of the admin user actions.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReasonModal from '../../../components/user/ReasonModal'
import { suspendBounds, freeTextMax } from '../../../constants/userAdmin'

const renderModal = (props = {}) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(<ReasonModal title="Ban user" message="Really?" onConfirm={onConfirm} onCancel={onCancel} {...props} />)
  return { onConfirm, onCancel }
}

const pick = (value) => fireEvent.change(screen.getByLabelText('Reason'), { target: { value } })
const write = (value) => fireEvent.change(screen.getByLabelText('Details'), { target: { value } })
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

describe('ReasonModal', () => {
  afterEach(() => vi.useRealTimers())

  it('shows the six reasons and the no personal data warning', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Ban user' })).toBeInTheDocument()
    expect(screen.getByText('Really?')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(7)
    expect(screen.getByText(/No personal data/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Suspended until/)).not.toBeInTheDocument()
  })

  it('refuses a missing reason and a short text', () => {
    const { onConfirm } = renderModal()
    confirm()
    expect(screen.getByRole('status')).toHaveTextContent('Pick a reason.')
    pick('SPAM')
    write('too short')
    expect(screen.getByTestId('reason-count')).toHaveTextContent(`9 / ${freeTextMax('SPAM')}`)
    confirm()
    expect(screen.getByRole('status')).toHaveTextContent('Write at least 10 characters.')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('caps the text so the final reason stays within 500 characters', () => {
    renderModal()
    pick('SUPPORT_REQUEST')
    expect(screen.getByLabelText('Details')).toHaveAttribute('maxLength', String(freeTextMax('SUPPORT_REQUEST')))
  })

  it('sends the composed reason', () => {
    const { onConfirm } = renderModal()
    pick('CHEATING')
    write('  used an auto-clicker bot  ')
    confirm()
    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Cheating: used an auto-clicker bot', until: undefined })
  })

  it('the suspend dialog requires a date within 90 days', () => {
    const { onConfirm } = renderModal({ withUntil: true, danger: false, title: 'Suspend user' })
    const { min, max } = suspendBounds()
    const date = screen.getByLabelText(/Suspended until/)
    expect(date).toHaveAttribute('min', min)
    expect(date).toHaveAttribute('max', max)
    pick('ABUSE')
    write('rude words in the chat')
    confirm()
    expect(screen.getByRole('status')).toHaveTextContent('Pick the end date of the suspension.')
    fireEvent.change(date, { target: { value: '2999-01-01' } })
    confirm()
    expect(screen.getByRole('status')).toHaveTextContent(/must be between/)
    fireEvent.change(date, { target: { value: min } })
    confirm()
    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Abuse: rude words in the chat', until: min })
  })

  it('shows the server error and blocks the buttons while busy', () => {
    const { onConfirm, onCancel } = renderModal({ busy: true, error: 'Refused (ADMIN_NOT_BANNABLE)' })
    expect(screen.getByRole('alert')).toHaveTextContent('ADMIN_NOT_BANNABLE')
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.click(screen.getByRole('presentation'))
    fireEvent.keyDown(document, { key: 'Escape' })
    pick('SPAM')
    write('valid reason text here')
    fireEvent.click(screen.getByRole('button', { name: 'Working…' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes on Cancel, on Escape and on the backdrop', () => {
    const { onCancel } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('presentation'))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(3)
  })
})
