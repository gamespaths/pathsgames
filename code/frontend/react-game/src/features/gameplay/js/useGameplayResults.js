import { useCallback, useEffect, useRef, useState } from 'react'
import { getInventory, selectChoice } from '@/api/matches'
import { grantedItemUuids, itemRowForUuid, lastEffectCard } from '@/utils/gameResults'
import { itemPromiseBadges, statChangeItems } from '@/utils/statBadges'
import { scrollBookToTop } from './mobileView'

// How long the board shows its loading page after a reload was asked for.
const LOADING_TIMEOUT_MS = 1000 // TODO drive this off the in-flight reload instead of a timer

/**
 * useGameplayResults — everything the board does with the ANSWER of a gameplay call
 * (execute-event, select-choice, sleep, move, use/drop item): reload the board, then decide
 * which single card is the news and on which page it belongs.
 *
 * The priority is the same for every path and lives here once: an edge state (coma, sadness
 * overflow) outranks a granted item, which outranks the effect narrative. A pending choice
 * short-circuits all of it — nothing was applied yet.
 */
export default function useGameplayResults({
  matchUuid, accessToken, lang, t, playerUuid, playerStats, gameData, weather,
  view, viewActions, refreshChrome, onReload, onError,
}) {
  const [loading, setLoading] = useState(false)
  const [choiceInFlight, setChoiceInFlight] = useState(false)
  const loadingTimerRef = useRef(null)
  // Step 29 — true while an executed event is showing its effect card on the right page. If
  // the SAME event also changed the weather, the async weather reload must NOT cover the
  // effect: it attaches a forward arrow to it instead.
  const eventEffectActiveRef = useRef(false)
  const prevWeatherUuidRef = useRef(null)
  // Set right before a sleep/movement reload so the effect below scrolls the freshly-loaded
  // board (the new card) back to the top on mobile.
  const scrollTopAfterReloadRef = useRef(false)
  // The weather effect runs off [weather] and cannot see the latest view state; this mirror
  // lets it know whether choices or the wake-up list already own the right page.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])

  const stopLoading = useCallback(() => {
    clearTimeout(loadingTimerRef.current)
    setLoading(false)
  }, [])
  const startLoading = useCallback(() => {
    clearTimeout(loadingTimerRef.current)
    setLoading(true)
    loadingTimerRef.current = setTimeout(() => setLoading(false), LOADING_TIMEOUT_MS)
  }, [])
  useEffect(() => () => clearTimeout(loadingTimerRef.current), [])

  // Mobile: after a sleep/movement reload lands (new gameData), scroll the board back to the
  // top so the new card is in view instead of the old action button.
  useEffect(() => {
    if (!scrollTopAfterReloadRef.current) return
    scrollTopAfterReloadRef.current = false
    scrollBookToTop()
  }, [gameData])

  // Show the new weather as a right-page reading page (WeatherCard with a back arrow) when
  // the weather UUID changes (skips the initial load, where prevWeatherUuidRef is null).
  useEffect(() => {
    if (!weather) return
    const prevUuid = prevWeatherUuidRef.current
    prevWeatherUuidRef.current = weather.uuid
    if (prevUuid === null || weather.uuid === prevUuid) return
    const duringEvent = eventEffectActiveRef.current
    eventEffectActiveRef.current = false
    // Step 31/33 — a choice-event and the wake-up list own the right page: a weather change
    // never covers them. The weather stays reachable from the stats view, and the board
    // (with the current weather) returns once they are closed.
    if (viewRef.current.pendingChoices) return
    if (viewRef.current.counterZero?.length) return
    viewActions.setPreviewRight(prev => {
      // Step 29 — the effect only leads forward to the weather: drop its back arrow.
      if (duringEvent && prev && prev.kind === 'preview') {
        return { ...prev, additionalProps: { ...prev.additionalProps,
          onClose: undefined,
          onForward: () => viewActions.setPreviewRight({ kind: 'weather' }) } }
      }
      // Step 30 — a coma or sadness card is the important news; the weather waits behind a
      // forward arrow (→) on it rather than covering it. The card keeps its close arrow.
      if (duringEvent && prev && (prev.kind === 'coma' || prev.kind === 'sad')) {
        return { ...prev, onForward: () => viewActions.setPreviewRight({ kind: 'weather' }) }
      }
      return { kind: 'weather' }
    })
  }, [weather]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload the board and every side payload time may have changed, and put the open pages
  // away. The news the answer carries is written by the caller, right after.
  const reloadBoard = useCallback(() => {
    startLoading()
    refreshChrome()
    scrollTopAfterReloadRef.current = true
    onReload?.()
    viewActions.resetForReload()
  }, [startLoading, refreshChrome, onReload, viewActions])

  /**
   * Step 30 — an edge state outranks the narrative: falling into a coma or being crushed by
   * sadness is the news, not whatever the effect said on the way there. The party collapse
   * outranks a personal one, since it ends everyone's turn at once. Arms the weather flag so
   * a change from the same beat attaches a forward arrow instead of covering the card.
   */
  const applyEdgeState = useCallback(edge => {
    if (edge?.allPlayersInComa) {
      eventEffectActiveRef.current = true
      viewActions.setPreviewLeft({ kind: 'coma', allPlayers: true, card: edge.comaEventCard ?? null })
    } else if (edge?.comaUuids?.includes(playerUuid)) {
      eventEffectActiveRef.current = true
      viewActions.setPreviewLeft({ kind: 'coma', allPlayers: false, card: null })
    } else if (edge?.sadnessOverflowUuids?.includes(playerUuid)) {
      eventEffectActiveRef.current = true
      viewActions.setPreviewLeft({ kind: 'sad' })
    }
  }, [playerUuid, viewActions])

  /**
   * Step 31 — a choice-event answers CHOICES_PENDING: cost paid, effects withheld. The event
   * card fills the LEFT page and its options fill the RIGHT page (as small cards). Nothing
   * was applied, so there is no effect narrative; the weather flag is armed so a stray
   * reload attaches a forward arrow rather than covering the view.
   */
  const applyChoicesPending = useCallback(result => {
    eventEffectActiveRef.current = true
    viewActions.setChoices({ card: result?.card ?? null, choices: result?.pendingChoices ?? [] })
  }, [viewActions])

  /**
   * Step 33 — the automatic events an ARRIVAL fired. Several can fire on one arrival (the
   * history trigger and, independently, "you found the place empty"), so they are chained
   * with the same forward arrow the weather uses: read one, press →, read the next.
   */
  const showAutomaticEvents = useCallback(fired => {
    const cards = (fired ?? [])
      .map(f => ({ narrative: f?.card ?? lastEffectCard(f), fired: f }))
      .filter(entry => entry.narrative)
    if (cards.length === 0) return false
    // Built back to front, so each card's forward arrow already knows its successor.
    let onForward
    for (let i = cards.length - 1; i >= 0; i -= 1) {
      const { narrative, fired: f } = cards[i]
      const next = onForward
      onForward = () => {
        viewActions.setPreviewRight({
          kind: 'preview',
          card: narrative,
          type: 'event',
          lockedReason: null,
          statItemsToPageContent: statChangeItems(f, playerUuid, t),
          additionalProps: next ? { onClose: undefined, onForward: next } : {},
        })
      }
    }
    eventEffectActiveRef.current = true
    onForward()
    return true
  }, [playerUuid, t, viewActions])

  /**
   * Step 29/34/35 — an executed event answers with one entry per applied effect, each with
   * its OWN card; the story reads as the last one. An item handed over outranks it: the
   * player wants to see what they just got, not the effect row that gave it.
   *
   * `fallbackCard` — the item path only: a use-item answer carries the ITEM's own card in
   * `result.card`, and an author who wrote no per-effect card still deserves a narrative.
   * Left null for events on purpose: there `result.card` is the EVENT card.
   */
  const handleEventExecuted = useCallback((result, fallbackCard = null) => {
    reloadBoard()
    if (result?.status === 'CHOICES_PENDING') {
      applyChoicesPending(result)
      stopLoading()
      return
    }
    const grantedUuid = grantedItemUuids(result)[0] ?? null
    // Already carried one? Then match-info has resolved its card and there is nothing to
    // fetch. A brand-new row is only in the inventory, hence the fallback below.
    const grantedRow = itemRowForUuid(playerStats?.items, grantedUuid)
    const grantedCard = grantedRow?.card ?? null
    const effectCard = grantedUuid ? null : (lastEffectCard(result) ?? fallbackCard)
    const narrative = grantedCard ?? effectCard
    // The fallback IS an item card (the one just used), so it is styled as one — only a real
    // list_*_effects row reads as an effect.
    const narrativeType = (grantedCard || (effectCard && effectCard === fallbackCard))
      ? 'item' : 'effect'
    // Step 35 — the card of an item just RECEIVED describes the ITEM: what it weighs and what
    // using it promises, not the statChanges of the event that handed it over. Mixing "+2 exp
    // you just earned" with "+3 life if you drink this" under one picture unreads both.
    const stats = grantedCard
      ? itemPromiseBadges(grantedRow, t)
      : statChangeItems(result, playerUuid, t)
    // An item is on its way even when its card is not resolved yet, so it arms the flag too.
    eventEffectActiveRef.current = !!narrative || !!grantedUuid
    if (narrative) {
      viewActions.openPreview({ card: narrative, type: narrativeType, stats, side: 'right' })
    } else if (grantedUuid) {
      // The row was just created, so its card lives only in the inventory. A failure is
      // swallowed on purpose — the board is reloading anyway and the bag will show it.
      getInventory(matchUuid, accessToken, lang)
        .then(inventory => {
          const row = itemRowForUuid(inventory?.items, grantedUuid)
          if (row?.card) {
            viewActions.openPreview({ card: row.card, type: 'item',
              stats: itemPromiseBadges(row, t), side: 'right' })
          }
        })
        .catch(() => {})
    }
    applyEdgeState(result?.edgeState)
    stopLoading()
  }, [reloadBoard, applyChoicesPending, applyEdgeState, stopLoading, playerStats, playerUuid,
    t, viewActions, matchUuid, accessToken, lang])

  // Step 33 — a movement answers with what the destination did about the arrival.
  const handleMovementDone = useCallback(result => {
    reloadBoard()
    showAutomaticEvents(result?.automaticEvents)
    stopLoading()
  }, [reloadBoard, showAutomaticEvents, stopLoading])

  // Step 33 — a sleep answers with the location counters that ran out while the party slept,
  // already filtered for this player. Empty is the normal case and renders nothing.
  const handleSlept = useCallback(result => {
    reloadBoard()
    const fired = result?.counterZero ?? []
    viewActions.setCounterZero(fired.length ? fired : null)
  }, [reloadBoard, viewActions])

  // Step 34 — dropping applies nothing and narrates nothing. The bag stays open on purpose:
  // dropping is a tidying gesture and usually comes in a run, so the list the player is
  // working through must not vanish under them.
  const handleItemDropped = useCallback(() => {
    reloadBoard()
    viewActions.openItems()
  }, [reloadBoard, viewActions])

  // Step 35 — using an item closes the bag: the row is consumed, and what matters now is the
  // effect it applied — which narrates on the very page the item list was covering.
  const handleItemUsed = useCallback(result => {
    handleEventExecuted(result, result?.card ?? null)
  }, [handleEventExecuted])

  /**
   * Step 32 — picking an option: POST select-choice, then narrate what it did. The board
   * reloads first (the resolution may have moved the character, changed the weather or
   * written a key), which puts the LEFT page back on the current location; the RIGHT page
   * then shows the linked event's card when the option ran one, else the effect narrative.
   */
  const handleSelectChoice = useCallback(async choice => {
    if (!choice?.uuid || choiceInFlight) return
    setChoiceInFlight(true)
    try {
      const result = await selectChoice(matchUuid, choice.uuid, accessToken, lang)
      reloadBoard()
      // A linked choice-event: the story chained one choice onto another, so the options
      // list is re-armed rather than closed.
      if (result?.status === 'CHOICES_PENDING') {
        applyChoicesPending(result)
        return
      }
      viewActions.closeChoices()
      // The event an effect ran inline wins over the last effect card: the roadmap asks for
      // "la card del evento" on the right page.
      const narrative = result?.choiceEventCard ?? lastEffectCard(result)
      eventEffectActiveRef.current = !!narrative
      if (narrative) {
        viewActions.openPreview({ card: narrative, type: 'event',
          stats: statChangeItems(result, playerUuid, t), side: 'right' })
      }
      applyEdgeState(result?.edgeState)
    } catch (e) {
      // The option stays on screen: the cycle is still open, so retrying is legal.
      onError?.(e?.response?.data?.error || e?.message || 'select-choice-failed')
    } finally {
      setChoiceInFlight(false)
      stopLoading()
    }
  }, [choiceInFlight, matchUuid, accessToken, lang, reloadBoard, applyChoicesPending,
    applyEdgeState, stopLoading, playerUuid, t, viewActions, onError])

  return {
    loading, startLoading, stopLoading, choiceInFlight,
    reloadBoard, handleEventExecuted, handleMovementDone, handleSlept,
    handleItemDropped, handleItemUsed, handleSelectChoice, showAutomaticEvents,
  }
}
