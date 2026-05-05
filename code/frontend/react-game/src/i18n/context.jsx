import { createContext, useContext, useState } from 'react'
import en from './en.json'
import it from './it.json'

const TRANSLATIONS = { en, it }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('it')

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
