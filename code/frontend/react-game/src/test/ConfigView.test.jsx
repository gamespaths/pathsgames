import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (k) => k, lang: 'en', setLang: vi.fn() }),
}))
vi.mock('../features/startBook/ConfigCard', () => ({ default: () => <div /> }))
vi.mock('../components/common/BonusBadgeList', () => ({ default: () => <div /> }))

import ConfigView from '../features/startBook/ConfigView'

const config = { character: null, class: null, trait: null, difficulty: null }

function setup(props = {}) {
  const onProceed = vi.fn()
  render(
    <ConfigView
      config={config}
      story={{}}
      onChangeClick={vi.fn()}
      onPreview={vi.fn()}
      onProceed={onProceed}
      {...props}
    />
  )
  return { onProceed }
}

describe('ConfigView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('advances to the start-game confirmation when "Start Game" is clicked', () => {
    const { onProceed } = setup()
    fireEvent.click(screen.getByText('book.startGame'))
    expect(onProceed).toHaveBeenCalled()
  })
})
