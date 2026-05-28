import { useEffect } from 'react'
import { useTranslation } from '../i18n/context'
import { initCookieConsent, setConsentLanguage } from '../consent/cookieConsent'

// Headless component: boots the cookie-consent banner once (with the initial UI
// language) and keeps its language in sync when the user switches it/en.
export default function CookieConsentManager() {
  const { lang } = useTranslation()

  useEffect(() => {
    initCookieConsent(lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setConsentLanguage(lang)
  }, [lang])

  return null
}
