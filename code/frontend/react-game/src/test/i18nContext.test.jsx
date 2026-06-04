import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider, useTranslation } from '../i18n/context'

function Probe() {
  const { t, lang, setLang } = useTranslation()
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="known">{t('modals.close')}</span>
      <span data-testid="missing">{t('this.key.does.not.exist')}</span>
      <button onClick={() => setLang('it')}>switch-it</button>
    </div>
  )
}

describe('i18n LanguageProvider', () => {
  it('defaults to en and resolves a known nested key', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('en')
    expect(screen.getByTestId('known').textContent).toBe('Close')
  })

  it('returns the key itself when the translation is missing', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('missing').textContent).toBe('this.key.does.not.exist')
  })

  it('switches language via setLang', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    fireEvent.click(screen.getByText('switch-it'))
    expect(screen.getByTestId('lang').textContent).toBe('it')
  })
})
