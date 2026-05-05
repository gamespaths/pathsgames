import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import ConfigView from './ConfigView'
import SelectionView from './SelectionView'
import CopyrightModal from '../../components/modals/CopyrightModal'

function buildInitialConfig(story) {
  return {
    character: story?.characters?.[0] ?? null,
    class: story?.classes?.[0] ?? null,
    trait: story?.traits?.[0] ?? null,
    difficulty: story?.difficulties?.[0] ?? null,
  }
}

function getOptionsForType(type, story) {
  if (type === 'difficulty') return story?.difficulties ?? []
  if (type === 'character') return story?.characters ?? []
  if (type === 'class') return story?.classes ?? []
  if (type === 'trait') return story?.traits ?? []
  return []
}

export default function StartBookModal({ story, onClose }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [config, setConfig] = useState(() => buildInitialConfig(story))
  const [selectionType, setSelectionType] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(true)

  if (!story) return null

  function handleSelect(opt) {
    setConfig(prev => ({ ...prev, [selectionType]: opt }))
    setSelectionType(null)
  }

  function handleStartGame() {
    if (!termsAccepted) return
    onClose()
    navigate(`/play/${story.uuid}`)
  }

  const configTypes = ['character', 'class', 'trait', 'difficulty']

  return (
    <>
      <div className="book-overlay">
        <button
          className="book-close-btn"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 1100 }}
          onClick={onClose}
        >
          <i className="fas fa-times" />
        </button>

        {/* ── DESKTOP: book ── */}
        <div className="book-wrapper">
          <div className="book-spine" />

          <BookPageLeft>
            <StoryLeftContent story={story} />
          </BookPageLeft>

          <BookPageRight>
            {selectionType ? (
              <SelectionView
                type={selectionType}
                options={getOptionsForType(selectionType, story)}
                selected={config[selectionType]}
                story={story}
                onSelect={handleSelect}
                onBack={() => setSelectionType(null)}
              />
            ) : (
              <ConfigView
                config={config}
                story={story}
                onChangeClick={setSelectionType}
                termsAccepted={termsAccepted}
                onTermsChange={setTermsAccepted}
                onStartGame={handleStartGame}
              />
            )}
          </BookPageRight>
        </div>

        {/* ── MOBILE: vertical layout ── */}
        <div className="book-mobile-layout">
          {selectionType ? (
            /* Mobile inline selection — no separate overlay */
            <div style={{ width: '100%' }}>
              <SelectionView
                type={selectionType}
                options={getOptionsForType(selectionType, story)}
                selected={config[selectionType]}
                story={story}
                onSelect={handleSelect}
                onBack={() => setSelectionType(null)}
              />
            </div>
          ) : (
            <>
              {/* Story card */}
              <div className="book-mobile-story-card">
                <img src={story.card?.imageUrl} alt={story.title} className="book-mobile-story-img" />
                <div className="book-mobile-story-body">
                  <h3 className="story-card-full-title" style={{ fontSize: '1rem', marginBottom: 4 }}>{story.title}</h3>
                  <p className="story-card-full-desc" style={{ fontSize: '0.82rem' }}>{story.description}</p>
                </div>
              </div>

              {/* Config cards */}
              {configTypes.map(type => {
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
                  <button className="btn-start-game" disabled={!termsAccepted} onClick={handleStartGame} style={{ flex: 1 }}>
                    <i className="fas fa-play me-2" />{t('book.startGame')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <CopyrightModal cardInfo={story.card} modalId="startBookCopyrightModal" />
    </>
  )
}

function StoryLeftContent({ story }) {
  return (
    <div className="pg-card pg-card--large story-card-full">
      <div className="story-card-full-img-wrap">
        <img src={story.card?.imageUrl} alt={story.title} className="story-card-full-img" />
        <div className="story-card-full-img-overlay" />
      </div>
      <div className="story-card-full-body">
        <h2 className="story-card-full-title">{story.title}</h2>
        <p className="story-card-full-desc">{story.description}</p>
        {story.card?.copyrightText && (
          <button
            className="card-info-btn story-card-info-btn"
            data-bs-toggle="modal"
            data-bs-target="#startBookCopyrightModal"
            aria-label="Photo credit"
          >
            <i className="fas fa-info-circle" />
          </button>
        )}
      </div>
    </div>
  )
}
