import { useState } from 'react'
import { useTranslation } from '../../i18n/context'
import SelectionView from './SelectionView'
import TurnstileWidget from '../../components/common/TurnstileWidget'
import AntibotMessage from '../../components/common/AntibotMessage'
import { CF_KEY, TURNSTILE_APPEARANCE } from '../../utils/turnstile'

export default function StartBookMobile({
  activeStory,
  config,
  configTypes,
  loadingDetail,
  selectionType,
  setSelectionType,
  termsAccepted,
  setTermsAccepted,
  onClose,
  onStartGame,
  onSelect,
  getOptionsForType,
}) {
  const { t } = useTranslation()
  // 'idle' → terms + buttons, 'checking' → Turnstile, 'bot' → funny message.
  const [phase, setPhase] = useState('idle')

  function handleStartClick() {
    if (!termsAccepted) return
    if (!CF_KEY) { onStartGame(null); return }
    setPhase('checking')
  }

  return (
    <div className="book-mobile-layout">
      {selectionType ? (
        <div style={{ width: '100%' }}>
          <SelectionView
            type={selectionType}
            options={getOptionsForType(selectionType)}
            selected={config[selectionType]}
            story={activeStory}
            config={config}
            onSelect={onSelect}
            onBack={() => setSelectionType(null)}
          />
        </div>
      ) : (
        <>
          <div className="book-mobile-story-card">
            <img src={activeStory.card?.urlImage} alt={activeStory.title} className="book-mobile-story-img" />
            <div className="book-mobile-story-body">
              <h3 className="story-card-full-title" style={{ fontSize: '1rem', marginBottom: 4 }}>{activeStory.title}</h3>
              <p className="story-card-full-desc" style={{ fontSize: '0.82rem' }}>{activeStory.description}</p>
            </div>
          </div>

          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--color-ash)' }}>
              <i className="fas fa-spinner fa-spin fa-2x" />
            </div>
          ) : null}
          {!loadingDetail && configTypes.map(type => {
            const val = config[type]
            return (
              <div key={type} className="book-mobile-config-card">
                <div className="book-mobile-config-icon"><i className={val?.icon ?? 'fas fa-circle'} /></div>
                <div className="book-mobile-config-info">
                  <div className="book-mobile-config-label">{t(`book.${type}`)}</div>
                  <div className="book-mobile-config-value">{val?.name}</div>
                </div>
                <button className="config-change-btn" onClick={() => setSelectionType(type)}>
                  <i className="fas fa-sync-alt me-1" />{t('book.change')}
                </button>
              </div>
            )
          })}

          <div className="book-mobile-config-card" style={{ opacity: 0.45 }}>
            <div className="book-mobile-config-icon"><i className="fas fa-user" /></div>
            <div className="book-mobile-config-info">
              <div className="book-mobile-config-label">{t('book.gameType')}</div>
              <div className="book-mobile-config-value">{t('book.single')}</div>
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-ash)' }}>
              <i className="fas fa-lock me-1" />{t('book.locked')}
            </span>
          </div>

          <div className="book-mobile-config-card" style={{ opacity: 0.45 }}>
            <div className="book-mobile-config-icon"><i className="fas fa-user-circle" /></div>
            <div className="book-mobile-config-info">
              <div className="book-mobile-config-label">{t('book.login')}</div>
              <div className="book-mobile-config-value">{t('book.guest')}</div>
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-ash)' }}>
              <i className="fas fa-lock me-1" />{t('book.locked')}
            </span>
          </div>

          <div className="book-mobile-footer">
            {phase === 'bot' ? (
              <AntibotMessage />
            ) : phase === 'checking' ? (
              <div className="turnstile-checking">
                <p><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</p>
                <TurnstileWidget
                  appearance={TURNSTILE_APPEARANCE.config}
                  onSuccess={token => onStartGame(token)}
                  onError={() => setPhase('bot')}
                  onExpire={() => setPhase('bot')}
                />
              </div>
            ) : (
              <>
                <label className="terms-label" aria-label={t('book.acceptTerms')} style={{ marginBottom: 10, display: 'flex' }}>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                  <button
                    type="button"
                    className="terms-link-btn"
                    data-bs-toggle="modal"
                    data-bs-target="#termsModal"
                    onClick={e => e.stopPropagation()}
                  >
                    {t('book.acceptTerms')}
                  </button>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary-pg" onClick={onClose} style={{ flex: 1 }}>
                    <i className="fas fa-times me-1" />{t('modals.close')}
                  </button>
                  <button className="btn-start-game" disabled={!termsAccepted} onClick={handleStartClick} style={{ flex: 1 }}>
                    <i className="fas fa-play me-2" />{t('book.startGame')}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
