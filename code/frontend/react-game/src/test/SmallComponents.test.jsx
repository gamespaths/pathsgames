import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/context'

vi.mock('../consent/cookieConsent', () => ({
  initCookieConsent: vi.fn(),
  setConsentLanguage: vi.fn(),
}))

import AntibotMessage from '../components/common/AntibotMessage'
import UserLanguageSelector from '../components/modals/user/UserLanguageSelector'
import CookieConsentManager from '../components/CookieConsentManager'
import { initCookieConsent, setConsentLanguage } from '../consent/cookieConsent'

const wrap = (ui) => render(<LanguageProvider>{ui}</LanguageProvider>)

describe('AntibotMessage', () => {
  it('renders the antibot message block', () => {
    const { container } = wrap(<AntibotMessage />)
    expect(container.querySelector('.antibot-message')).toBeTruthy()
    expect(container.querySelector('.antibot-message-icon')).toBeTruthy()
  })
})

describe('UserLanguageSelector', () => {
  it('lists EN + IT and switches the active language on click', () => {
    const { container } = wrap(<UserLanguageSelector />)
    const buttons = container.querySelectorAll('.lang-btn')
    expect(buttons.length).toBe(2)
    // EN active by default
    expect(container.querySelector('.lang-btn.active').textContent).toContain('ENGLISH')
    fireEvent.click(screen.getByText('ITALIANO'))
    expect(container.querySelector('.lang-btn.active').textContent).toContain('ITALIANO')
  })
})

describe('CookieConsentManager', () => {
  beforeEach(() => vi.clearAllMocks())

  it('boots the consent banner with the current language and renders nothing', () => {
    const { container } = wrap(<CookieConsentManager />)
    expect(container.firstChild).toBeNull()
    expect(initCookieConsent).toHaveBeenCalledWith('en')
    expect(setConsentLanguage).toHaveBeenCalledWith('en')
  })
})
