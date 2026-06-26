import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider, useTranslation } from '../i18n/context'

/** Force navigator.language so tests don't depend on the host's locale. */
function setBrowserLang(value) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(value)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  setBrowserLang('en-US')
})

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

  it('persists the chosen language to localStorage', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    fireEvent.click(screen.getByText('switch-it'))
    expect(localStorage.getItem('pathsgames.lang')).toBe('it')
  })

  it('initialises from a persisted language (overriding the browser)', () => {
    setBrowserLang('en-US')
    localStorage.setItem('pathsgames.lang', 'it')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('it')
  })

  it('defaults to the browser language when nothing is persisted', () => {
    setBrowserLang('it-IT')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('it')
  })

  it('falls back to en when the browser language is unsupported', () => {
    setBrowserLang('fr-FR')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('falls back to the browser language when the persisted value is invalid', () => {
    setBrowserLang('it-IT')
    localStorage.setItem('pathsgames.lang', 'zz')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('it')
  })
})
