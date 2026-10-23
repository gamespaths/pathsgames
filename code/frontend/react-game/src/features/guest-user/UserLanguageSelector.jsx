import { useTranslation } from '@/i18n/context'
import { LANGUAGE_LABELS, bundleLanguages } from '@/i18n/bundles'
import { useGuestUser } from './GuestUserContext'

/**
 * UserLanguageSelector — v1.7.0 the language preference: the server languages that have a bundle;
 * a Google user saves it in the profile (PATCH /api/auth/me), a guest only on this device.
 */
export default function UserLanguageSelector() {
  const { lang, setLang } = useTranslation()
  const session = useGuestUser()
  const languages = bundleLanguages(session?.supportedLanguages)
  const busy = session?.profileBusy === true

  function choose(code) {
    if (code === lang) return
    if (session?.savePreferences) void session.savePreferences({ language: code })
    else setLang(code)
  }

  return (
    <div className="language-list-wrap" data-testid="language-selector">
      {languages.map(code => {
        const label = LANGUAGE_LABELS[code] ?? code
        return (
          <button key={code} type="button" className={`lang-btn ${lang === code ? 'active' : ''}`}
            onClick={() => choose(code)} title={label} disabled={busy}>
            {lang === code && <i className="fas fa-check mr-2" />}
            {label.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
