import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import BookPageContent from '../../components/book/BookPageContent'
import ConfigView from './ConfigView'
import SelectionView from './SelectionView'
import StartBookMobile from './StartBookMobile'
import { getStoryDetail } from '../../api/stories'

function buildInitialConfig(story) {
  return {
    character: story?.characterTemplates?.[0] ?? null,
    class: story?.classes?.[0] ?? null,
    trait: story?.traits?.[0] ?? null,
    difficulty: story?.difficulties?.[0] ?? null,
  }
}

function getOptionsForType(type, story) {
  if (type === 'difficulty') return story?.difficulties ?? []
  if (type === 'character') return story?.characterTemplates ?? []
  if (type === 'class') return story?.classes ?? []
  if (type === 'trait') return story?.traits ?? []
  return []
}

export default function StartBookModal({ story, onClose }) {
  const navigate = useNavigate()
  const { lang } = useTranslation()

  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [config, setConfig] = useState(() => buildInitialConfig(story))
  const [selectionType, setSelectionType] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [previewCard, setPreviewCard] = useState(null)

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

  if (loadingDetail) {
    return (
      <div className="book-overlay">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      </div>
    )
  }
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
            {/* StoryLeftContent always rendered underneath */}
            <BookPageContent card={activeStory.card} loading={loadingDetail}  story={activeStory}/>
          </BookPageLeft>

          <BookPageRight>
            { previewCard ? (
              <CardPreviewOverlay card={previewCard} story={activeStory} onClose={() => setPreviewCard(null)} />
            ) : selectionType ? (
              <SelectionView
                type={selectionType}
                options={getOptionsForType(selectionType, activeStory)}
                selected={config[selectionType]}
                story={activeStory}
                onSelect={handleSelect}
                onBack={() => setSelectionType(null)}
                onPreview={setPreviewCard}
              />
            ) : (
              <ConfigView
                config={config}
                story={activeStory}
                onChangeClick={setSelectionType}
                onPreview={setPreviewCard}
                termsAccepted={termsAccepted}
                onTermsChange={setTermsAccepted}
                onStartGame={handleStartGame}
              />
            )}
          </BookPageRight>
        </div>

        {/* ── MOBILE: vertical layout ── */}
        <StartBookMobile
          activeStory={activeStory}
          config={config}
          configTypes={configTypes}
          loadingDetail={loadingDetail}
          selectionType={selectionType}
          setSelectionType={setSelectionType}
          termsAccepted={termsAccepted}
          setTermsAccepted={setTermsAccepted}
          onClose={onClose}
          onStartGame={handleStartGame}
          onSelect={handleSelect}
          getOptionsForType={(type) => getOptionsForType(type, activeStory)}
        />
      </div>
    </>
  )
}

function CardPreviewOverlay({ card, story, onClose }) {
  return (
    <div className="card-preview-overlay">
      <BookPageContent card={card} loading={false} story={story}  onClose={onClose}  />
    </div>
  )
}
