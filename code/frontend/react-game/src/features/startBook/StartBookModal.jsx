import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import BookPageContent from '../../components/book/BookPageContent'
import ConfigView from './ConfigView'
import SelectionView from './SelectionView'
import StartBookMobile from './StartBookMobile'
import { getStoryDetail } from '../../api/stories'
import { buildClassesById, getOptionLockInfo } from '../../utils/bonusStats'

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
  const [preview, setPreview] = useState(null) // { entity, type } or null

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
    const changedType = selectionType
    setConfig(prev => {
      const next = { ...prev, [changedType]: opt }
      // When the class changes, re-validate character and trait against the
      // new class. If the current selection becomes incompatible, replace it
      // with the first compatible option from the story.
      if (changedType === 'class') {
        const classesById = buildClassesById(activeStory?.classes)
        const reselect = (type, optionsList) => {
          const current = next[type]
          if (!current) return null
          const currentLock = getOptionLockInfo({ type, option: current, config: next, classesById })
          if (!currentLock) return current
          return optionsList.find(o => !getOptionLockInfo({ type, option: o, config: next, classesById })) ?? null
        }
        next.character = reselect('character', activeStory?.characterTemplates ?? [])
        next.trait = reselect('trait', activeStory?.traits ?? [])
      }
      return next
    })
    setSelectionType(null)
    setPreview(null)
  }

  // From ConfigView: clicking "Cambia" or the magnifying glass on a selectable
  // card opens BOTH the selection list (right page) and the preview of the
  // currently-selected option (left page).
  function handleChangeFromConfig(type) {
    setSelectionType(type)
    const entity = config[type]
    setPreview(entity ? { entity, type } : null)
  }

  // From SelectionView / ConfigView: clicking the magnifying glass on an option
  // swaps the left-page preview without leaving the selection list.
  function handleSelectionPreview(entity, type) {
    setPreview(entity ? { entity, type } : null)
  }

  // Any "back" / "close" action — on either the preview or the selection list —
  // exits the whole change flow and returns to ConfigView.
  function handleBackOrClose() {
    setPreview(null)
    setSelectionType(null)
  }

  function handleStartGame() {
    if (!termsAccepted) return
    onClose()
    // Hand the chosen story + loadout to the StartMatch page, which creates the
    // match (POST /api/matches) before entering the game.
    navigate(`/start-match/${story.uuid}`, { state: { story: activeStory, config } })
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
  const leftContent = preview ? (
    <CardPreviewOverlay
      card={preview.entity?.card}
      entity={preview.entity}
      entityType={preview.type}
      story={activeStory}
      onClose={handleBackOrClose}
    />
  ) : (
    <BookPageContent card={activeStory.card} loading={loadingDetail} story={activeStory} />
  )

  const rightContent = selectionType ? (
    <SelectionView
      type={selectionType}
      options={getOptionsForType(selectionType, activeStory)}
      selected={config[selectionType]}
      story={activeStory}
      config={config}
      onSelect={handleSelect}
      onBack={handleBackOrClose}
      onPreview={handleSelectionPreview}
    />
  ) : (
    <ConfigView
      config={config}
      story={activeStory}
      onChangeClick={handleChangeFromConfig}
      onPreview={handleSelectionPreview}
      termsAccepted={termsAccepted}
      onTermsChange={setTermsAccepted}
      onStartGame={handleStartGame}
    />
  )

  return (
    <Book
      onClose={onClose}
      left={leftContent}
      right={rightContent}
      mobile={
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
      }
    />
  )
}

function CardPreviewOverlay({ card, entity, entityType, story, onClose }) {
  return (
    <div className="card-preview-overlay">
      <BookPageContent
        card={card}
        entity={entity}
        entityType={entityType}
        loading={false}
        story={story}
        onClose={onClose}
      />
    </div>
  )
}
