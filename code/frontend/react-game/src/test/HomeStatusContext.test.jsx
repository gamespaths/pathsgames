import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeStatusProvider, useHomeStatus } from '../context/HomeStatusContext'

function Probe() {
  const { error, setError } = useHomeStatus()
  return (
    <>
      <span data-testid="err">{error ?? 'none'}</span>
      <button onClick={() => setError('matches')}>fail</button>
      <button onClick={() => setError(null)}>clear</button>
    </>
  )
}

describe('HomeStatusContext (v0.37.6)', () => {
  it('starts with no error and shares updates through the provider', () => {
    render(<HomeStatusProvider><Probe /></HomeStatusProvider>)
    expect(screen.getByTestId('err').textContent).toBe('none')
    fireEvent.click(screen.getByText('fail'))
    expect(screen.getByTestId('err').textContent).toBe('matches')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('err').textContent).toBe('none')
  })

  it('is a harmless no-op outside the provider', () => {
    render(<Probe />)
    fireEvent.click(screen.getByText('fail'))
    expect(screen.getByTestId('err').textContent).toBe('none')
  })
})
