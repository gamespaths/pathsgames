import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/context'
import Book from '../../components/book/Book'
import Card from '../../components/layout/Card'
import LoadingCard from '../../components/layout/LoadingCard'
import ErrorCard from '../../components/layout/ErrorCard'
import ConfigView from './ConfigView'
import OptionPicker from './OptionPicker'
import FadeIn, { previewKey } from '../../components/layout/FadeIn'
import useBookTurn from '../../hooks/useBookTurn'
import { scrollBookToTop } from '../gameplay/js/mobileView'
import { getStoryDetail } from '../../api/stories'
import { buildClassesById, getNonZeroStats, getOptionLockInfo } from '../../utils/bonusStats'
import { canAddTrait, fitTraitsToBudget, isTraitHiddenOnStartMatch, selectableTraits, toggleTrait, traitCostItems } from '../../utils/traitBudget'
import { getOptionsForType, selectedEntityForType } from './startBookOptions'
import { buildErrorCard } from '../../utils/loadoutCards'

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

/**
 * StartBook — v1.13.0: the book of `/story/:storyId` (was StartBookModal). `story` shows while the detail loads;
 * without it an unknown or failing story shows the ErrorCard page. `initialConfig`: a loadout to reopen with.
 * Step 15 — "Change" turns forward to a picker, back out of it; an (i) or a single-option detail fades.
 */
export default function StartBook({ story = null, storyId = null, initialConfig = null }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t, lang } = useTranslation()
  const uuid = storyId ?? story?.uuid ?? null

  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [failed, setFailed] = useState(false)
  const [config, setConfig] = useState(() => initialConfig ?? buildInitialConfig(story))
  // Consumed by the first detail load only: a later reload (language change) starts afresh.
  const reopenRef = useRef(initialConfig)
  const [selectionType, setSelectionType] = useState(null)
  const [preview, setPreview] = useState(null) // { entity, type } or null
  const [detailType, setDetailType] = useState(null) // single-option card whose detail fills the right page
  const { pageKey, direction, turnTo } = useBookTurn()

  useEffect(() => {
    if (!uuid) {
      setFailed(true)
      setLoadingDetail(false)
      return
    }
    setLoadingDetail(true)
    setFailed(false)
    void getStoryDetail(uuid, lang)
      .then(data => {
        if (!data && !story) { setFailed(true); return }
        setDetail(data)
        const reopen = reopenRef.current
        reopenRef.current = null
        setConfig(reopen ?? buildInitialConfig(data ?? story))
      })
      .catch(() => {
        // The summary of the Home is enough to start; a direct load has nothing to show.
        if (!story) { setFailed(true); return }
        setDetail(story)
        setConfig(reopenRef.current ?? buildInitialConfig(story))
      })
      .finally(() => setLoadingDetail(false))
  }, [uuid, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingDetail || failed) {
    const left = story?.card
      ? <Card variant="page" card={story.card} loading={false} story={story} entityType="story" />
      : failed
        ? <Card variant="page" card={buildErrorCard(t)} entityType="error" loading={false} />
        : <LoadingCard story={null} />
    const right = failed
      ? <ErrorCard message={t('errors.storyNotFound')} onClose={() => navigate('/')} />
      : <LoadingCard story={story} />
    return <Book left={left} right={right} pageKey={pageKey} direction={direction} coverTitle={story?.title} />
  }

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
    turnTo('back')
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
    turnTo('forward')
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
    turnTo('fade')
  }

  // From OptionPicker / ConfigView: clicking the magnifying glass on an option
  // swaps the left-page preview without leaving the selection list.
  function handleSelectionPreview(entity, type , lockedReason , statItemsToPageContent) {
    //console.log("entity", entity, "type", type, "lockedReason", lockedReason, "statItemsToPageContent", statItemsToPageContent);
    setPreview(entity ? { entity, type, lockedReason, statItemsToPageContent } : null)
    turnTo('fade')
    // Phones: the preview takes the top card's place; the screen goes back to the very top.
    if (entity) scrollBookToTop()
  }

  // Any "back" / "close" action — on either the preview or the selection list —
  // exits the whole change flow and returns to ConfigView.
  function handleBackOrClose() {
    setPreview(null)
    setSelectionType(null)
    setDetailType(null)
    turnTo(selectionType ? 'back' : 'fade')
  }

  // "Start Game": the loadout is saved in this entry first (Back finds it), then the start-match page.
  function handleStartGame() {
    const state = { story: activeStory, config }
    navigate(pathname, { replace: true, state })
    navigate(`/start-match/${uuid ?? activeStory.uuid}`, { state: { ...state, fromStory: true } })
  }

  //console.log("preview",preview);
  const leftContent = preview ? (
    <FadeIn key={previewKey({ type: preview.type, card: preview.entity?.card ?? preview.entity })}><CardPreviewOverlay
      card={preview?.entity?.card}
      entity={preview?.entity}
      entityType={preview?.type}
      story={activeStory}
      onClose={handleBackOrClose}
      lockedReason={preview?.lockedReason}
      statItemsToPageContent={preview?.statItemsToPageContent}
    /></FadeIn>
  ) : (
    // The picker's own back arrow is gone: while a list is open the left page carries it,
    // even with nothing previewed (a trait picker opened on an empty selection).
    <Card variant="page" card={activeStory.card} loading={loadingDetail} story={activeStory} entityType="story"
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
    <Book
      left={leftContent}
      right={rightContent}
      pageKey={pageKey}
      direction={direction}
      coverTitle={activeStory?.title}
    />
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
