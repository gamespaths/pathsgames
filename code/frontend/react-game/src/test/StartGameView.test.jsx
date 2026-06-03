import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Controllable Turnstile mock: fires onSuccess (human) by default, onError when
// `ts.behavior` is 'bot'.
const ts = vi.hoisted(() => ({ behavior: 'success' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    Turnstile: ({ onSuccess, onError }) => {
      useEffect(() => {
        if (ts.behavior === 'bot') onError?.()
        else onSuccess?.('test-token')
      }, [])
      return <div data-testid="turnstile-mock" />
    },
  }
})

vi.mock('../utils/turnstile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, CF_KEY: 'test-site-key' }
})

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
// Expose each card's type + buttons so we can assert the two-row reveal.
vi.mock('../features/startBook/ConfigCard', () => ({
  default: ({ type, onSelect, onPreview }) => (
    <div data-testid={`card-${type}`}>
      {onSelect && <button onClick={onSelect}>toggle-{type}</button>}
      {onPreview && <button onClick={onPreview}>preview-{type}</button>}
    </div>
  ),
}))
vi.mock('../components/common/BonusBadgeList', () => ({ default: () => <div /> }))

import StartGameView from '../features/startBook/StartGameView'

const config = { character: null, class: null, trait: null, difficulty: null }

function setup(props = {}) {
  const onStartGame = vi.fn()
  const onTermsChange = vi.fn()
  const onBack = vi.fn()
  render(
    <StartGameView
      story={{ title: 'Forest Quest', card: {} }}
      config={config}
      termsAccepted={true}
      onTermsChange={onTermsChange}
      onPreview={vi.fn()}
      onStartGame={onStartGame}
      onBack={onBack}
      {...props}
    />
  )
  return { onStartGame, onTermsChange, onBack }
}

describe('StartGameView — start-game confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
  })

  it('hides the second row while checking, then reveals it and calls onStartGame with the token', async () => {
    const { onStartGame } = setup()
    // first row always present
    expect(screen.getByTestId('card-terms')).toBeInTheDocument()
    // Turnstile resolves → second row appears
    expect(await screen.findByTestId('card-antibot')).toBeInTheDocument()
    expect(screen.getByTestId('card-freeToPlay')).toBeInTheDocument()
    expect(screen.getByTestId('card-story')).toBeInTheDocument()

    fireEvent.click(screen.getByText('book.startGame'))
    expect(onStartGame).toHaveBeenCalledWith('test-token')
  })

  it('offers a retry (instead of blocking) and keeps the second row hidden on widget error', async () => {
    ts.behavior = 'bot'
    const { onStartGame } = setup()
    expect(await screen.findByText('antibot.error')).toBeInTheDocument()
    expect(screen.getByText('startMatch.retry')).toBeInTheDocument()
    expect(screen.queryByTestId('card-antibot')).not.toBeInTheDocument()
    expect(onStartGame).not.toHaveBeenCalled()
  })

  it('recovers when the retry succeeds (re-runs the check)', async () => {
    ts.behavior = 'bot'
    setup()
    const retry = await screen.findByText('startMatch.retry')
    ts.behavior = 'success' // the remounted widget will pass this time
    fireEvent.click(retry)
    expect(await screen.findByTestId('card-antibot')).toBeInTheDocument()
  })

  it('toggles terms acceptance from the terms card', async () => {
    const { onTermsChange } = setup()
    fireEvent.click(screen.getByText('toggle-terms'))
    expect(onTermsChange).toHaveBeenCalledWith(false)
  })

  it('disables Start until terms are accepted', async () => {
    setup({ termsAccepted: false })
    await screen.findByTestId('card-antibot')
    expect(screen.getByText('book.startGame').closest('button')).toBeDisabled()
  })
})
