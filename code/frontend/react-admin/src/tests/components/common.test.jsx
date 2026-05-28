import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorAlert from '../../components/common/ErrorAlert'
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── ErrorAlert ─────────────────────────────────────────────────
describe('ErrorAlert', () => {
  it('renders nothing when message is empty', () => {
    const { container } = render(<ErrorAlert message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the error message', () => {
    render(<ErrorAlert message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ErrorAlert message="Error!" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not render close button when onClose is undefined', () => {
    render(<ErrorAlert message="Error!" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

// ── LoadingSpinner ─────────────────────────────────────────────
describe('LoadingSpinner', () => {
  it('shows default text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows custom text', () => {
    render(<LoadingSpinner text="Fetching data…" />)
    expect(screen.getByText('Fetching data…')).toBeInTheDocument()
  })
})

// ── ConfirmModal ───────────────────────────────────────────────
describe('ConfirmModal', () => {
  it('renders title and message', () => {
    render(
      <ConfirmModal
        title="Delete item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onConfirm when Confirm is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal title="T" message="M" onConfirm={onConfirm} onCancel={vi.fn()} />
    )
    await userEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when backdrop is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    // click the backdrop (first element with pg-modal-backdrop)
    const backdrop = document.querySelector('.pg-modal-backdrop')
    await userEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalled()
  })
})
