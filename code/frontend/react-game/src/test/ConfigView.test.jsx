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

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../features/startBook/ConfigCard', () => ({ default: () => <div /> }))
vi.mock('../components/common/BonusBadgeList', () => ({ default: () => <div /> }))

import ConfigView from '../features/startBook/ConfigView'

const config = { character: null, class: null, trait: null, difficulty: null }

function setup(props = {}) {
  const onStartGame = vi.fn()
  render(
    <ConfigView
      config={config}
      story={{}}
      onChangeClick={vi.fn()}
      onPreview={vi.fn()}
      termsAccepted={true}
      onTermsChange={vi.fn()}
      onStartGame={onStartGame}
      {...props}
    />
  )
  return { onStartGame }
}

describe('ConfigView — start-game antibot flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ts.behavior = 'success'
  })

  it('shows the start button first, then runs Turnstile and calls onStartGame with the token', async () => {
    const { onStartGame } = setup()
    fireEvent.click(screen.getByText('book.startGame'))
    await waitFor(() => expect(onStartGame).toHaveBeenCalledWith('test-token'))
    // button + terms are hidden while checking
    expect(screen.queryByText('book.startGame')).not.toBeInTheDocument()
  })

  it('shows the antibot message and does not start the game when flagged as a bot', async () => {
    ts.behavior = 'bot'
    const { onStartGame } = setup()
    fireEvent.click(screen.getByText('book.startGame'))
    expect(await screen.findByText('antibot.blocked')).toBeInTheDocument()
    expect(onStartGame).not.toHaveBeenCalled()
  })

  it('disables the start button until the terms are accepted', () => {
    setup({ termsAccepted: false })
    expect(screen.getByText('book.startGame').closest('button')).toBeDisabled()
  })
})
