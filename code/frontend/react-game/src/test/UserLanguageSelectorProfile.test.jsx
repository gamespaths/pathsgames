// v1.7.0 V1 step 7 — the language preference: server languages with a bundle, saved through the session.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const ctx = vi.hoisted(() => ({ value: null }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => ctx.value }))
const i18n = vi.hoisted(() => ({ lang: 'en', setLang: vi.fn() }))
vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k, lang: i18n.lang, setLang: i18n.setLang }) }))

const extra = vi.hoisted(() => ({ langs: null }))
vi.mock('@/i18n/bundles', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, bundleLanguages: (s) => extra.langs ?? actual.bundleLanguages(s) }
})

import UserLanguageSelector from '@/features/guest-user/UserLanguageSelector'

describe('UserLanguageSelector v1.7.0', () => {
  it('lists only the server languages that have a bundle and saves the choice', () => {
    ctx.value = { supportedLanguages: ['it', 'fr', 'en'], savePreferences: vi.fn(), profileBusy: false }
    render(<UserLanguageSelector />)
    const buttons = screen.getByTestId('language-selector').querySelectorAll('button')
    expect([...buttons].map(b => b.textContent)).toEqual(['ITALIANO', 'ENGLISH'])
    fireEvent.click(screen.getByText('ENGLISH'))
    expect(ctx.value.savePreferences).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('ITALIANO'))
    expect(ctx.value.savePreferences).toHaveBeenCalledWith({ language: 'it' })
    expect(i18n.setLang).not.toHaveBeenCalled()
  })

  it('disables the buttons while a save is in flight', () => {
    ctx.value = { supportedLanguages: ['en', 'it'], savePreferences: vi.fn(), profileBusy: true }
    render(<UserLanguageSelector />)
    expect(screen.getByText('ITALIANO').closest('button').disabled).toBe(true)
  })

  it('without a session it only switches the language of the page', () => {
    ctx.value = null
    render(<UserLanguageSelector />)
    fireEvent.click(screen.getByText('ITALIANO'))
    expect(i18n.setLang).toHaveBeenCalledWith('it')
  })

  it('a bundle without a name shows its code', () => {
    ctx.value = null
    extra.langs = ['en', 'de']
    render(<UserLanguageSelector />)
    expect(screen.getByText('DE')).toBeTruthy()
    extra.langs = null
  })
})
