import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import en from '../i18n/en.json'
import it_ from '../i18n/it.json'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { PREFERENCES_KEY } from '../auth/devicePreferences'
import { REDUCED_MOTION_MQ } from '../context/AnimationContext'

// Step 16 — the preferences card of the player-page grid and the editing card that replaces the grid.

const lookup = (obj, key) => key.split('.').reduce((v, k) => v?.[k], obj)
const i18n = vi.hoisted(() => ({ lang: 'it', setLang: vi.fn() }))
vi.mock('@/i18n/context', () => ({
  useTranslation: () => ({ t: k => lookup(en, k) ?? k, lang: i18n.lang, setLang: i18n.setLang }),
}))
const session = vi.hoisted(() => ({ value: null }))
vi.mock('@/features/guest-user/GuestUserContext', () => ({ useGuestUser: () => session.value }))
vi.mock('@/context/PolicyBookContext', () => ({ usePolicyBook: () => ({ openPolicyBook: vi.fn() }) }))

import PreferencesCard, { preferenceBadges, speedLabel } from '../features/preferences/PreferencesCard'
import PreferencesEditor from '../features/preferences/PreferencesEditor'

const t = k => lookup(en, k) ?? k
const html = document.documentElement
const stored = () => JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null')
const withPrefs = ui => render(<PreferencesProvider env={{}}>{ui}</PreferencesProvider>)
const badges = () => [...document.querySelectorAll('.preferences-card .bonus-badge')].map(b => b.textContent.trim())
const row = id => screen.getByTestId(`pref-${id}`)
const pill = (id, label) => within(row(id)).getByRole('radio', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })

afterEach(() => {
  localStorage.clear()
  ;['data-pg-theme', 'data-pg-size', 'data-pg-cols', 'data-pg-reduced'].forEach(a => html.removeAttribute(a))
  delete window.matchMedia
  delete navigator.vibrate
  session.value = null
  i18n.setLang.mockClear()
})

describe('PreferencesCard', () => {
  it('a little card with five badges (language, theme, size, animations, columns) and a "Change" action', () => {
    const onOpen = vi.fn()
    withPrefs(<PreferencesCard onOpen={onOpen} />)
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(document.querySelector('.preferences-card .fa-sliders-h')).not.toBeNull()
    expect(badges()).toEqual(['Language:IT', 'Theme:Medieval', 'Text size:M', 'Animations:On ¼×', 'Columns:Auto'])
    expect(screen.getByTestId('preferences-card-action').querySelector('.fa-pen')).not.toBeNull()
    expect(screen.getByTestId('preferences-card-action')).toHaveTextContent('Change')
    fireEvent.click(screen.getByTestId('preferences-card-action'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('the badges follow the stored choices; reduced motion shows the animations off', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, theme: 'parchment', size: 'large', columns: 3,
      anim: { speed: 1 } }))
    window.matchMedia = vi.fn(q => ({ matches: q === REDUCED_MOTION_MQ }))
    withPrefs(<PreferencesCard onOpen={vi.fn()} />)
    expect(badges()).toEqual(['Language:IT', 'Theme:Parchment', 'Text size:L', 'Animations:Off', 'Columns:3'])
  })

  it('preferenceBadges: every flag off reads Off; a speed out of the list shows its number', () => {
    const effective = { theme: 'medieval', size: 'small', columns: 4, cols: 2 }
    const anim = { deal: false, dealFaceDown: false, play: false, turn: false, speed: 2 }
    const values = preferenceBadges({ lang: undefined, effective, anim, t }).map(b => b.value)
    expect(values).toEqual(['', 'Medieval', 'S', 'Off', '2'])
    expect(speedLabel(2, t)).toBe('2×')
    expect(speedLabel(0.5, t)).toBe('½×')
  })
})

describe('PreferencesEditor', () => {
  it('a reading page with its title, intro and back arrow (back to the grid)', () => {
    const onBack = vi.fn()
    withPrefs(<PreferencesEditor onBack={onBack} />)
    expect(screen.getByRole('heading', { name: /Preferences/ })).toBeInTheDocument()
    expect(screen.getByText(en.preferences.intro)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-back'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('rows are radio groups of pills (aria-checked), the defaults checked', () => {
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(within(row('theme')).getByRole('radiogroup')).toHaveAttribute('aria-labelledby', 'pref-theme-name')
    expect(pill('theme', 'Medieval')).toHaveAttribute('aria-checked', 'true')
    expect(pill('theme', 'Parchment')).toHaveAttribute('aria-checked', 'false')
    expect(pill('size', 'Normal')).toHaveAttribute('aria-checked', 'true')
    expect(pill('columns', 'Auto')).toHaveAttribute('aria-checked', 'true')
    expect(pill('speed', '¼×')).toHaveAttribute('aria-checked', 'true')
    expect(pill('deck', 'Under the book')).toHaveClass('lang-btn', 'active')
  })

  it('every row writes at once: theme, size, columns and the seven animation rows (Deck under / over included)', () => {
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    fireEvent.click(pill('theme', 'Parchment'))
    fireEvent.click(pill('size', 'Small'))
    fireEvent.click(pill('columns', '2'))
    for (const flag of ['deal', 'dealFaceDown', 'play', 'turn']) fireEvent.click(within(row(flag)).getByRole('radio', { name: /Off/ }))
    fireEvent.click(pill('turnMode', 'Simple'))
    fireEvent.click(pill('speed', '1×'))
    fireEvent.click(pill('deck', 'Over the book'))
    expect(stored()).toEqual({ v: 1, theme: 'parchment', size: 'small', columns: 2,
      anim: { deal: false, dealFaceDown: false, play: false, turn: false, turnMode: 'simple', speed: 1, deck: 'over' } })
    expect(html).toHaveAttribute('data-pg-theme', 'parchment')
    expect(html).toHaveAttribute('data-pg-size', 'small')
    expect(html).toHaveAttribute('data-pg-cols', '2')
    expect(pill('deck', 'Over the book')).toHaveAttribute('aria-checked', 'true')
    // the checked pill does nothing
    fireEvent.click(pill('theme', 'Parchment'))
    expect(stored().theme).toBe('parchment')
  })

  it('back to defaults removes the key', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, theme: 'parchment' }))
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(pill('theme', 'Parchment')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByTestId('pref-reset'))
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull()
    expect(pill('theme', 'Medieval')).toHaveAttribute('aria-checked', 'true')
  })

  it('under reduced motion the animation rows are disabled with a note; vibration is not', () => {
    navigator.vibrate = vi.fn()
    window.matchMedia = vi.fn(q => ({ matches: q === REDUCED_MOTION_MQ }))
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(screen.getByTestId('pref-reduced-note')).toHaveTextContent(en.preferences.reducedNote)
    for (const id of ['deal', 'dealFaceDown', 'play', 'turn', 'turnMode', 'speed', 'deck']) {
      within(row(id)).getAllByRole('radio').forEach(b => expect(b).toBeDisabled())
    }
    // the configured value stays checked (env on), even though the effect is off
    expect(within(row('deal')).getByRole('radio', { name: /On/ })).toHaveAttribute('aria-checked', 'true')
    within(row('vibration')).getAllByRole('radio').forEach(b => expect(b).not.toBeDisabled())
    expect(pill('theme', 'Parchment')).not.toBeDisabled()
  })

  it('vibration: shown only with the Vibration API, on by default, writes off', () => {
    const first = withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(screen.queryByTestId('pref-vibration')).toBeNull()
    expect(screen.queryByTestId('pref-reduced-note')).toBeNull()
    first.unmount()
    navigator.vibrate = vi.fn()
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(within(row('vibration')).getByRole('radio', { name: /On/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(row('vibration')).getByRole('radio', { name: /Off/ }))
    expect(stored()).toEqual({ v: 1, vibration: false })
  })

  it('column options outside the current layout are disabled; a stored value shows clamped', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ v: 1, columns: 4 }))
    window.matchMedia = vi.fn(q => ({ matches: q === '(max-width: 767px)' || q === '(max-width: 1120px)' }))
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    expect(pill('columns', 'Auto')).not.toBeDisabled()
    expect(pill('columns', '1')).not.toBeDisabled()
    expect(pill('columns', '2')).toHaveAttribute('aria-checked', 'true')
    expect(pill('columns', '3')).toBeDisabled()
    expect(pill('columns', '4')).toBeDisabled()
    window.matchMedia = vi.fn(() => ({ matches: false }))
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(pill('columns', '1')).toBeDisabled()
    expect(pill('columns', '4')).toHaveAttribute('aria-checked', 'true')
  })

  it('language: a Google user saves it in the profile (savePreferences), a guest without session on the device (setLang)', () => {
    session.value = { supportedLanguages: ['en', 'it'], savePreferences: vi.fn(), profileBusy: false }
    const first = withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    fireEvent.click(within(row('language')).getByText('ENGLISH'))
    expect(session.value.savePreferences).toHaveBeenCalledWith({ language: 'en' })
    first.unmount()
    session.value = null
    withPrefs(<PreferencesEditor onBack={vi.fn()} />)
    fireEvent.click(within(row('language')).getByText('ENGLISH'))
    expect(i18n.setLang).toHaveBeenCalledWith('en')
  })
})

describe('preferences — i18n', () => {
  it('EN and IT carry the same preferences.* keys, none empty', () => {
    const keys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
      (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
    expect(keys(it_.preferences).sort()).toEqual(keys(en.preferences).sort())
    for (const key of keys(en.preferences)) {
      expect(lookup(en.preferences, key)).toBeTruthy()
      expect(lookup(it_.preferences, key)).toBeTruthy()
    }
  })

  it('the privacy and cookies policies name the new key and the browser-only display choices (EN/IT)', () => {
    expect(en.modals.cookies.necessaryBody).toContain('pathsgames.preferences')
    expect(it_.modals.cookies.necessaryBody).toContain('pathsgames.preferences')
    expect(en.modals.privacy.dataBody).toContain('never sent to our servers')
    expect(it_.modals.privacy.dataBody).toContain('mai inviate ai nostri server')
    expect(en.modals.privacy.updated).toBe('Last updated: November 2026')
    expect(en.modals.cookies.updated).toBe('Last updated: November 2026')
    expect(it_.modals.privacy.updated).toBe('Ultimo aggiornamento: Novembre 2026')
    expect(it_.modals.cookies.updated).toBe('Ultimo aggiornamento: Novembre 2026')
  })
})
