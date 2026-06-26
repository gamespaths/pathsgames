import { createContext, useContext, useState } from 'react'
import en from './en.json'
import it from './it.json'

const TRANSLATIONS = { en, it }
const STORAGE_KEY = 'pathsgames.lang'
const FALLBACK_LANG = 'en'

/** Language suggested by the browser (e.g. 'it-IT' → 'it'), if we support it. */
function browserLang() {
  try {
    const code = (navigator.language || '').slice(0, 2).toLowerCase()
    return TRANSLATIONS[code] ? code : FALLBACK_LANG
  } catch {
    return FALLBACK_LANG
  }
}

/**
 * Initial language: the user's persisted choice wins; otherwise fall back to
 * the browser language, then to English.
 */
function storedLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && TRANSLATIONS[saved]) return saved
  } catch {
    // ignore storage errors (e.g. private mode)
  }
  return browserLang()
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(storedLang)

  function setLang(next) {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  }

  function t(key) {
    const keys = key.split('.')
    let val = TRANSLATIONS[lang]
    for (const k of keys) {
      val = val?.[k]
    }
    return val ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
