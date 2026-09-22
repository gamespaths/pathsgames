import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'
import ConfigView from './ConfigView'
import OptionPicker from './OptionPicker'
import StartBookMobile from './StartBookMobile'
import CardPreviewModal from '../../components/modals/CardPreviewModal'
import { getStoryDetail } from '../../api/stories'
import { buildClassesById, getNonZeroStats, getOptionLockInfo } from '../../utils/bonusStats'
import { canAddTrait, fitTraitsToBudget, isTraitHiddenOnStartMatch, selectableTraits, toggleTrait, traitCostItems } from '../../utils/traitBudget'
import { getOptionsForType, selectedEntityForType } from './startBookOptions'

function buildInitialConfig(story) {
  // v0.35.2 — the preselected trait must be one the player could have chosen: picking
  // `traits[0]` blindly would arm the loadout with a hidden trait the picker never shows,
  // leaving nobody able to remove it and the join refused with TRAIT_NOT_SELECTABLE.
  const pickable = selectableTraits(story?.traits)
  const difficulty = story?.difficulties?.[0] ?? null
  return {
    character: story?.characterTemplates?.[0] ?? null,
    class: story?.classes?.[0] ?? null,
    // Step 23 — multiple traits can be selected (within the difficulty budgets); a first
    // trait the default difficulty cannot pay for is not preselected (server would refuse).
    traits: pickable[0] && canAddTrait(pickable[0], [], difficulty) ? [pickable[0]] : [],
    difficulty,
  }
}

/** `initialConfig` (optional): a loadout to reopen with, e.g. coming back from start-match. */
export default function StartBookModal({ story, onClose, initialConfig = null }) {
  const navigate = useNavigate()
  const { t, lang } = useTranslation()

  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [config, setConfig] = useState(() => initialConfig ?? buildInitialConfig(story))
  // Consumed by the first detail load only: a later reload (language change) starts afresh.
  const reopenRef = useRef(initialConfig)
  const [selectionType, setSelectionType] = useState(null)
  const [preview, setPreview] = useState(null) // { entity, type } or null
  const [detailType, setDetailType] = useState(null) // single-option card whose detail fills the right page

  useEffect(() => {
    if (!story?.uuid) return
    setLoadingDetail(true)
    getStoryDetail(story.uuid, lang)
      .then(data => {
        setDetail(data)
        const reopen = reopenRef.current
        reopenRef.current = null
        setConfig(reopen ?? buildInitialConfig(data ?? story))
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
          tr => !isTraitHiddenOnStartMatch(tr)
            && !getOptionLockInfo({ type: 'trait', option: tr, config: next, classesById })
        )
      }
      // A stricter difficulty drops the traits its budgets can no longer pay for.
      if (changedType === 'difficulty') {
        next.traits = fitTraitsToBudget(next.traits, next.difficulty)
      }
      return next
    })
    setSelectionType(null)
    setPreview(null)
  }

  /** A trait's page badges: its budgeted cost first, then its stats — the picker's order. */
  function traitPageStats(trait) {
    return traitCostItems(trait, t, config.difficulty).concat(getNonZeroStats(trait, 'trait', t))
  }

  // From ConfigView: clicking "Cambia" or the magnifying glass on a selectable
  // card opens BOTH the selection list (right page) and the preview of the
  // currently-selected option (left page) — for traits, of the FIRST selected one.
  function handleChangeFromConfig(type) {
    setSelectionType(type)
    const entity = selectedEntityForType(type, config)
    setPreview(entity
      ? { entity, type, statItemsToPageContent: type === 'trait' ? traitPageStats(entity) : undefined }
      : null)
  }

  // From ConfigView: the (i) of a card with a single option (nothing to change) opens its
  // detail on the RIGHT page, in place of the config; "back" returns to ConfigView.
  function handleInfoFromConfig(type) {
    if (!selectedEntityForType(type, config)) return
    setDetailType(type)
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
    setDetailType(null)
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
    // The picker's own back arrow is gone: while a list is open the left page carries it,
    // even with nothing previewed (a trait picker opened on an empty selection).
    <Card variant="page" card={activeStory.card} loading={loadingDetail} story={activeStory}
      onClose={selectionType ? handleBackOrClose : undefined} />
  )

  let rightContent
  if (detailType) {
    rightContent = (
      <CardPreviewOverlay
        card={selectedEntityForType(detailType, config)?.card}
        entity={selectedEntityForType(detailType, config)}
        entityType={detailType}
        story={activeStory}
        onClose={handleBackOrClose}
      />
    )
  } else if (selectionType) {
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
        onInfoClick={handleInfoFromConfig}
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
            detailType={detailType}
            onChangeClick={handleChangeFromConfig}
            onInfoClick={handleInfoFromConfig}
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
