import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { HomeButtonProvider, useHomeButton, useHomeButtonHandler } from '../context/HomeButtonContext'

function Reader() {
  const home = useHomeButton()
  return <button onClick={() => { screen.ran = home.run() }} data-testid="run">{String(home.hasHandler())}</button>
}

function Page({ fn }) {
  useHomeButtonHandler(fn)
  return null
}

describe('HomeButtonContext (v1.13.0)', () => {
  it('outside a provider nothing is registered: run() answers false, the caller goes home', () => {
    const { result } = renderHook(() => useHomeButton())
    expect(result.current.hasHandler()).toBe(false)
    expect(result.current.run()).toBe(false)
    expect(() => renderHook(() => useHomeButtonHandler(() => {}))).not.toThrow()
  })

  it('a mounted page registers its handler; run() calls it; unmounting removes it', () => {
    const fn = vi.fn()
    function Harness() {
      const [mounted, setMounted] = useState(true)
      return <>{mounted && <Page fn={fn} />}<Reader /><button onClick={() => setMounted(false)}>unmount</button></>
    }
    render(<HomeButtonProvider><Harness /></HomeButtonProvider>)
    fireEvent.click(screen.getByTestId('run'))
    expect(fn).toHaveBeenCalledOnce()
    expect(screen.ran).toBe(true)
    fireEvent.click(screen.getByText('unmount'))
    fireEvent.click(screen.getByTestId('run'))
    expect(fn).toHaveBeenCalledOnce()
    expect(screen.ran).toBe(false)
  })

  it('a falsy handler registers nothing; the latest function runs without a new registration', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<HomeButtonProvider><Page fn={null} /><Reader /></HomeButtonProvider>)
    fireEvent.click(screen.getByTestId('run'))
    expect(screen.ran).toBe(false)
    rerender(<HomeButtonProvider><Page fn={first} /><Reader /></HomeButtonProvider>)
    rerender(<HomeButtonProvider><Page fn={second} /><Reader /></HomeButtonProvider>)
    fireEvent.click(screen.getByTestId('run'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
    // back to null (a match that ended): the handler goes
    rerender(<HomeButtonProvider><Page fn={null} /><Reader /></HomeButtonProvider>)
    fireEvent.click(screen.getByTestId('run'))
    expect(screen.ran).toBe(false)
  })

  it('a stale cleanup never drops a newer page\'s handler', () => {
    const a = vi.fn()
    const b = vi.fn()
    const { rerender } = render(<HomeButtonProvider><Page key="a" fn={a} /><Reader /></HomeButtonProvider>)
    rerender(<HomeButtonProvider><Page key="a" fn={a} /><Page key="b" fn={b} /><Reader /></HomeButtonProvider>)
    // the older page leaves after the newer one registered
    rerender(<HomeButtonProvider><Page key="b" fn={b} /><Reader /></HomeButtonProvider>)
    fireEvent.click(screen.getByTestId('run'))
    expect(b).toHaveBeenCalledOnce()
    expect(a).not.toHaveBeenCalled()
  })
})
