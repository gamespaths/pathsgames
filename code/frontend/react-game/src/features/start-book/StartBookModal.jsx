import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'
import ConfigView from './ConfigView'
import OptionPicker from './OptionPicker'
import StartBookMobile from './StartBookMobile'
import CardPreviewModal from '../../components/modals/CardPreviewModal'
import { getStoryDetail } from '../../api/stories'
import { buildClassesById, getOptionLockInfo } from '../../utils/bonusStats'
import { canAddTrait, toggleTrait } from '../../utils/traitBudget'

function buildInitialConfig(story) {
  return {
    character: story?.characterTemplates?.[0] ?? null,
    class: story?.classes?.[0] ?? null,
    // Step 23 — multiple traits can be selected (within the difficulty budgets)
    traits: story?.traits?.[0] ? [story.traits[0]] : [],
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
    // Step 23 — traits are multi-select: toggle in/out (budget enforced by the
    // picker via canAddTrait) and keep the selection list open.
    if (changedType === 'trait') {
      setConfig(prev => {
        const alreadySelected = (prev.traits ?? []).some(t => t?.uuid === opt.uuid)
        if (!alreadySelected && !canAddTrait(opt, prev.traits, prev.difficulty)) {
          return prev
        }
        return { ...prev, traits: toggleTrait(opt, prev.traits) }
      })
      return
    }
    setConfig(prev => {
      const next = { ...prev, [changedType]: opt }
      // When the class changes, re-validate character and traits against the
      // new class. An incompatible character is replaced with the first
      // compatible option; incompatible traits are dropped from the selection.
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
        next.traits = (next.traits ?? []).filter(
          tr => !getOptionLockInfo({ type: 'trait', option: tr, config: next, classesById })
        )
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

  // From OptionPicker / ConfigView: clicking the magnifying glass on an option
  // swaps the left-page preview without leaving the selection list.
  function handleSelectionPreview(entity, type , lockedReason , statItemsToPageContent) {
    //console.log("entity", entity, "type", type, "lockedReason", lockedReason, "statItemsToPageContent", statItemsToPageContent);
    setPreview(entity ? { entity, type, lockedReason, statItemsToPageContent } : null)
  }

  // Mobile has no left page, so the (i) lens opens the big card in a modal.
  function handlePreviewModal(entity, type, lockedReason, statItemsToPageContent) {
    setPreview(entity ? { entity: entity, type, lockedReason, statItemsToPageContent } : null)
    if (typeof window === 'undefined') return
    const el = document.getElementById('cardPreviewModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).show()
  }

  // Any "back" / "close" action — on either the preview or the selection list —
  // exits the whole change flow and returns to ConfigView.
  function handleBackOrClose() {
    setPreview(null)
    setSelectionType(null)
  }

  // "Start Game" — the only step in the book now. Hand the chosen loadout to the
  // start-match page, which owns the antibot check and the terms gate.
  function handleStartGame() {
    onClose()
    navigate(`/start-match/${story.uuid}`, { state: { story: activeStory, config } })
  }


  if (loadingDetail) {
    return (
      <div className="book-overlay">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      </div>
    )
  }
  
  //console.log("preview",preview);
  const leftContent = preview ? ( 
     <CardPreviewOverlay
      card={preview?.entity?.card}
      entity={preview?.entity}
      entityType={preview?.type}
      story={activeStory}
      onClose={handleBackOrClose}
      lockedReason={preview?.lockedReason}
      statItemsToPageContent={preview?.statItemsToPageContent}
    />
  ) : (
    <Card variant="page" card={activeStory.card} loading={loadingDetail} story={activeStory}/>
  )

  let rightContent
  if (selectionType) {
    rightContent = (
      <OptionPicker
        type={selectionType}
        options={getOptionsForType(selectionType, activeStory)}
        selected={selectionType === 'trait' ? config.traits : config[selectionType]}
        story={activeStory}
        config={config}
        onSelect={handleSelect}
        onBack={handleBackOrClose}
        onPreview={handleSelectionPreview}
      />
    )
  } else {
    rightContent = (
      <ConfigView
        config={config}
        story={activeStory}
        onChangeClick={handleChangeFromConfig}
        onPreview={handleSelectionPreview}
        onProceed={handleStartGame}
      />
    )
  }

  return (
    <>
      <Book
        onClose={onClose}
        left={leftContent}
        right={rightContent}
        mobile={
          <StartBookMobile
            activeStory={activeStory}
            config={config}
            loadingDetail={loadingDetail}
            selectionType={selectionType}
            onChangeClick={handleChangeFromConfig}
            onPreview={handlePreviewModal}
            onProceed={handleStartGame}
            onSelect={handleSelect}
            onBackSelection={handleBackOrClose}
            getOptionsForType={(type) => getOptionsForType(type, activeStory)}
          />
        }
      />
      <CardPreviewModal preview={preview} story={activeStory} />
    </>
  )
}

export function CardPreviewOverlay({ card, entity, entityType, story, onClose, lockedReason , statItemsToPageContent}) {
  //console.log("CardPreviewOverlay", card, entity, entityType, story, lockedReason , statItemsToPageContent );
  return (
    <div className="card-preview-overlay">
      <Card variant="page"
        card={card}
        entity={entity}
        entityType={entityType}
        loading={false}
        story={story}
        onClose={onClose}
        lockedReason={lockedReason}
        statItemsToPageContent={statItemsToPageContent}
      />
    </div>
  )
}
