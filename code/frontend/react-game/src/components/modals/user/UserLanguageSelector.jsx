import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n/context'

export default function UserLanguageSelector() {
  const { lang, setLang, t } = useTranslation()
  const [availableLangs, setAvailableLangs] = useState([])

  useEffect(() => {
    // In a real app, this could fetch available languages from the server or config
    setAvailableLangs([
      { code: 'en', label: 'English' },
      { code: 'it', label: 'Italiano' },
    ])
  }, [])

  return (
    <div className="language-list-wrap">
      <h3 className="matches-list-title language-list-title">
        <i className="fas fa-scroll me-2" />{t('modals.guestUser.languageTitle')}
      </h3>
        {availableLangs.map(l => (
            <button
            className={`lang-btn ${lang === l.code ? 'active' : ''}`}
            onClick={() => setLang(l.code)}
            title={l.label}
            >
                {lang === l.code && <i className="fas fa-check mr-2" />}
                {l.label.toUpperCase()}                
            </button>
        ))}
      
    </div>
  )
}