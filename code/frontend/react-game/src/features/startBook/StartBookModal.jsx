import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import ConfigView from './ConfigView'
import SelectionView from './SelectionView'
import CopyrightModal from '../../components/modals/CopyrightModal'
import { getStoryDetail } from '../../api/stories'

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
  const { t, lang } = useTranslation()

  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [config, setConfig] = useState(() => buildInitialConfig(story))
  const [selectionType, setSelectionType] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(true)

  useEffect(() => {
    if (!story?.uuid) return
    setLoadingDetail(true)
    getStoryDetail(story.uuid, lang)
      .then(data => {
        setDetail(data)
        setConfig(buildInitialConfig(data ?? story))
      })
      .finally(() => setLoadingDetail(false))
  }, [story?.uuid, lang])

  if (!story) return null

  const activeStory = detail ?? story

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
            <StoryLeftContent story={activeStory} loading={loadingDetail} />
          </BookPageLeft>

          <BookPageRight>
            {loadingDetail ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-ash)' }}>
                <i className="fas fa-spinner fa-spin fa-2x" />
              </div>
            ) : selectionType ? (
              <SelectionView
                type={selectionType}
                options={getOptionsForType(selectionType, activeStory)}
                selected={config[selectionType]}
                story={activeStory}
                onSelect={handleSelect}
                onBack={() => setSelectionType(null)}
              />
            ) : (
              <ConfigView
                config={config}
                story={activeStory}
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
                options={getOptionsForType(selectionType, activeStory)}
                selected={config[selectionType]}
                story={activeStory}
                onSelect={handleSelect}
                onBack={() => setSelectionType(null)}
              />
            </div>
          ) : (
            <>
              {/* Story card */}
              <div className="book-mobile-story-card">
                <img src={activeStory.card?.imageUrl} alt={activeStory.title} className="book-mobile-story-img" />
                <div className="book-mobile-story-body">
                  <h3 className="story-card-full-title" style={{ fontSize: '1rem', marginBottom: 4 }}>{activeStory.title}</h3>
                  <p className="story-card-full-desc" style={{ fontSize: '0.82rem' }}>{activeStory.description}</p>
                </div>
              </div>

              {/* Config cards */}
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

      <CopyrightModal cardInfo={activeStory.card} modalId="startBookCopyrightModal" />
    </>
  )
}

function StoryLeftContent({ story, loading }) {
  return (
    <div className="pg-card pg-card--large story-card-full">
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, background: 'rgba(0,0,0,0.3)', borderRadius: 'inherit' }}>
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      )}
      <div className="story-card-full-img-wrap">
        <img src={story.card?.imageUrl} alt={story.card?.title} className="story-card-full-img" />
        <div className="story-card-full-img-overlay" />
      </div>
      <div className="story-card-full-body">
        <h2 className="story-card-full-title">{story.card?.title}</h2>
        <p className="story-card-full-desc">{story.card?.description}</p>
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
