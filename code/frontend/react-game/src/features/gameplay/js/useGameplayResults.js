import { useCallback, useEffect, useRef, useState } from 'react'
import { chromeScopeFor, movedBy } from './chromeScope'
import { getInventory, selectChoice } from '@/api/matches'
import { grantedItemUuids, itemRowForUuid, lastEffectCard } from '@/utils/gameResults'
import { itemPromiseBadges, registryChangeItems, statChangeItems } from '@/utils/statBadges'
import { scrollBookToTop } from './mobileView'
import { buildTrainedCard } from '@/utils/loadoutCards'
import { missionCard, missionCompletedBadge, missionPageStats } from '@/utils/missions'
import { useAnimationSettings } from '@/context/AnimationContext'
import { turnsActive } from '@/components/book/pageTurn'

// v0.37.6 — a drop-item answer carries no clock: read as "time did not move".
const DROP_ANSWER = Object.freeze({ timeEnded: false })
// Step 15 — a reload still running this long after the landing turns to the loading page.
export const SLOW_RELOAD_MS = 1000
// Step 15 — a hold never lasts longer than this (BookPages drops its copy at the same time).
export const HOLD_MAX_MS = 10000
// Step 15 — a play that moved the character turns forward; one that left it where it was fades.
const turnOf = result => (movedBy(result) ? 'forward' : 'fade')

/**
 * useGameplayResults — everything the board does with the ANSWER of a gameplay call
 * (execute-event, select-choice, sleep, move, use/drop item): reload the board, then decide
 * which single card is the news and on which page it belongs.
 *
 * The priority is the same for every path and lives here once: an edge state (coma, sadness
 * overflow) outranks a granted item, which outranks the effect narrative. A pending choice
 * short-circuits all of it — nothing was applied yet.
 * Step 15 — a played answer lands (`play`), the old pages are held while the board reloads, then ONE page turns (a fade when the play did not move).
 */
export default function useGameplayResults({
  matchUuid, accessToken, lang, t, playerUuid, playerStats, gameData, weather, clock,
  view, viewActions, refreshChrome, onReload, onError, play = null,
}) {
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  useEffect(() => { loadingRef.current = loading }, [loading])
  // Step 15 — the animation settings read when an answer lands; the chrome of the latest reload.
  const anim = useAnimationSettings()
  const animRef = useRef(anim)
  animRef.current = anim
  const chromeRef = useRef(null)
  const holdSeqRef = useRef(0)
  // Step 15 — the hold to release once the answer has landed: { seq, direction } (see the effect after the weather).
  const [releaseAsk, setReleaseAsk] = useState(null)
  const [choiceInFlight, setChoiceInFlight] = useState(false)
  // v0.37.4 — the reload in flight, numbered: only the LATEST one may put the loading page away.
  const reloadSeqRef = useRef(0)
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
  // v0.37.6 — the clock the board knows, read when an action answers (not a dep of reloadBoard).
  const clockRef = useRef(null)
  useEffect(() => { clockRef.current = clock?.currentClock ?? null }, [clock])

  const stopLoading = useCallback(() => setLoading(false), [])
  const startLoading = useCallback(() => setLoading(true), [])

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
    // Step 31 — a choice-event owns the right page: a weather change never covers it. The
    // weather stays reachable from the stats view, and the board returns once it is closed.
    if (viewRef.current.pendingChoices) return
    // Step 39 — after a sleep the new weather comes first, then (→) the wake-up list
    // (counter-zero, start-time, random event) waiting underneath it.
    if (viewRef.current.counterZero?.length) {
      viewActions.setPreviewRight(prev => prev
        ? prev
        : { kind: 'weather', onForward: () => viewActions.setPreviewRight(null) })
      return
    }
    viewActions.setPreviewRight(prev => {
      // Step 29 — the effect only leads forward to the weather: drop its back arrow.
      // v0.38.2 — a card that already led somewhere (a mission just closed) keeps its chain:
      // the weather slots in and leads on to it.
      if (duringEvent && prev && prev.kind === 'preview') {
        const after = prev.additionalProps?.onForward
        return { ...prev, additionalProps: { ...prev.additionalProps,
          onClose: undefined,
          onForward: () => viewActions.setPreviewRight({ kind: 'weather', onForward: after }) } }
      }
      // Step 30 — a coma or sadness card is the important news; the weather waits behind a
      // forward arrow (→) on it rather than covering it. The card keeps its close arrow.
      if (duringEvent && prev && (prev.kind === 'coma' || prev.kind === 'sad')) {
        return { ...prev, onForward: () => viewActions.setPreviewRight({ kind: 'weather' }) }
      }
      return { kind: 'weather' }
    })
  }, [weather]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 15 — released after the answer's news effects (weather, missions) dispatched: they land inside the ONE turn.
  useEffect(() => {
    if (!releaseAsk) return undefined
    const id = setTimeout(() => {
      if (holdSeqRef.current === releaseAsk.seq) viewActions.releaseTurn(releaseAsk.direction)
    }, 0)
    return () => clearTimeout(id)
  }, [releaseAsk]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload the board and every side payload time may have changed, and put the open pages
  // away. The news the answer carries is written by the caller, right after.
  // v0.37.4 — resolves when the NEW board has landed (or the reload failed): the loading page
  // used to be a fixed timer, so a slow /info showed the old location back before the new one.
  // The caller keeps its own "Executing" until this settles, which is what the player sees.
  // v0.37.6 — `result` is the action's answer: only the side payloads it made stale are
  // asked again (chromeScopeFor); no answer at all means every one of them.
  const reloadBoard = useCallback((result = null) => {
    const seq = ++reloadSeqRef.current
    startLoading()
    chromeRef.current = refreshChrome(chromeScopeFor(result, clockRef.current))
    scrollTopAfterReloadRef.current = true
    const reload = Promise.resolve().then(() => onReload?.()).catch(() => {})
      .then(() => { if (seq === reloadSeqRef.current) setLoading(false) })
    viewActions.resetForReload()
    return reload
  }, [startLoading, refreshChrome, onReload, viewActions])

  // Step 15 — ONE turn once board and chrome settled, or 1 s after the landing while still loading; a newer hold wins.
  const releaseWhenLanded = useCallback((seq, direction, reload) => {
    let done = false
    let slow = null
    let safety = null
    const release = () => {
      if (done) return
      done = true
      clearTimeout(slow)
      clearTimeout(safety)
      setReleaseAsk({ seq, direction })
    }
    slow = setTimeout(() => { if (loadingRef.current) release() }, SLOW_RELOAD_MS)
    safety = setTimeout(release, HOLD_MAX_MS)
    Promise.all([reload, chromeRef.current]).catch(() => {}).then(release)
  }, [])

  // Step 15 — land, then hold + end + reload in ONE commit (the hold copies the emptied page); no play, no turn: sync.
  const played = useCallback((direction, apply) => {
    const landing = play?.land?.() ?? null
    const turning = turnsActive(animRef.current)
    if (!landing && !turning) {
      play?.end?.()
      return apply()
    }
    return (async () => {
      if (landing) await landing
      const seq = turning ? ++holdSeqRef.current : 0
      if (turning) viewActions.holdTurn()
      play?.end?.()
      const reload = apply()
      if (turning) releaseWhenLanded(seq, direction, reload)
      return reload
    })()
  }, [play, viewActions, releaseWhenLanded])

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
    } else {
      return false
    }
    return true
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
   * Step 40 — an action that ended the time early (execute-event, select-choice, a move)
   * answers the time-start's news: the weather card only if it changed, then the wake-up
   * list. Returns the step the action's own card leads to with its forward arrow (null when
   * there is nothing to tell) and pre-sets the weather uuid so the [weather] effect keeps quiet.
   */
  const timeEndTail = useCallback(result => {
    if (!result?.timeEnded) return null
    const news = result.weather ?? null
    const fired = Array.isArray(result.counterZero) ? result.counterZero : []
    if (news?.uuid) prevWeatherUuidRef.current = news.uuid
    if (fired.length) viewActions.setCounterZero(fired)
    const toList = fired.length ? () => viewActions.setPreviewRight(null) : undefined
    if (news?.changed) return () => viewActions.setPreviewRight({ kind: 'weather', onForward: toList })
    return toList ?? null
  }, [viewActions])

  /**
   * Step 33 — the automatic events an ARRIVAL fired. Several can fire on one arrival (the
   * history trigger and, independently, "you found the place empty"), so they are chained
   * with the same forward arrow the weather uses: read one, press →, read the next.
   * Step 40 — `tail` is where the last card leads (the news of a time-end the arrival forced).
   */
  const showAutomaticEvents = useCallback((fired, tail = null) => {
    const cards = (fired ?? [])
      .map(f => ({ narrative: f?.card ?? lastEffectCard(f), fired: f }))
      .filter(entry => entry.narrative)
    if (cards.length === 0) {
      tail?.()
      return !!tail
    }
    // Built back to front, so each card's forward arrow already knows its successor.
    let onForward = tail ?? undefined
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
   * v0.38.2 — the missions the reload just CLOSED, each on its own reading page with a back
   * arrow. They land after the answer's own news (the effect card, a coma), so they chain
   * behind it with the forward arrow the weather uses rather than covering it; a page that
   * already led somewhere (the weather) is led to again from the last mission.
   */
  const showMissionsCompleted = useCallback(missions => {
    const rows = (missions ?? []).filter(Boolean)
    if (rows.length === 0) return false
    viewActions.setPreviewRight(prev => {
      const behindCard = prev?.kind === 'preview'
      // Where the last mission leads: what the card in front already led to, or the page
      // itself when it cannot carry an arrow (the weather).
      let next = behindCard
        ? prev.additionalProps?.onForward
        : (prev ? () => viewActions.setPreviewRight(prev) : undefined)
      let first = null
      // Built back to front, so each card's forward arrow already knows its successor.
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const page = {
          kind: 'preview',
          card: missionCard(rows[i]),
          type: 'missions',
          lockedReason: null,
          // "Mission completed" in place of "Status: Completed": news, not a state.
          statItemsToPageContent: [missionCompletedBadge(t),
            ...missionPageStats(t, rows[i]).filter(s => s.key !== 'missionStatus')],
          // "Mission completed" is a sentence: without showZeros the badge list would drop it.
          additionalProps: { bonusBadgeShowZeros: true,
            ...(next ? { onClose: undefined, onForward: next } : {}) },
        }
        next = () => viewActions.setPreviewRight(page)
        first = page
      }
      if (behindCard) {
        return { ...prev, additionalProps: { ...prev.additionalProps,
          onClose: undefined, onForward: next } }
      }
      return first
    })
    return true
  }, [t, viewActions])

  /**
   * Step 29/34/35 — an executed event answers with one entry per applied effect, each with
   * its OWN card; the story reads as the last one. An item handed over outranks it: the
   * player wants to see what they just got, not the effect row that gave it.
   *
   * `fallbackCard` — the item path only: a use-item answer carries the ITEM's own card in
   * `result.card`, and an author who wrote no per-effect card still deserves a narrative.
   * Left null for events on purpose: there `result.card` is the EVENT card.
   */
  const applyEvent = useCallback((result, fallbackCard = null) => {
    const reload = reloadBoard(result)
    if (result?.status === 'CHOICES_PENDING') {
      applyChoicesPending(result)
      stopLoading()
      return reload
    }
    const tail = timeEndTail(result)
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
    // A key the event wrote rides beside them: it is part of the same outcome, and the board
    // already holds the titles to name it with.
    const registryBadges = registryChangeItems(result, gameData?.info?.registry)
    const stats = [
      ...(grantedCard ? itemPromiseBadges(grantedRow, t) : statChangeItems(result, playerUuid, t)),
      ...registryBadges,
    ]
    // BonusBadgeList drops any badge whose value is not a non-zero NUMBER, and a registry
    // value is a word. Armed only when there is one, so the item path keeps its own reading.
    const badgeProps = registryBadges.length > 0 ? { bonusBadgeShowZeros: true } : null
    // An item is on its way even when its card is not resolved yet, so it arms the flag too.
    eventEffectActiveRef.current = !!narrative || !!grantedUuid
    if (narrative) {
      viewActions.openPreview({ card: narrative, type: narrativeType, stats, side: 'right',
        props: tail ? { ...(badgeProps ?? {}), onClose: undefined, onForward: tail } : badgeProps })
    } else {
      tail?.()
    }
    if (!narrative && grantedUuid) {
      // The row was just created, so its card lives only in the inventory. A failure is
      // swallowed on purpose — the board is reloading anyway and the bag will show it.
      getInventory(matchUuid, accessToken, lang)
        .then(inventory => {
          const row = itemRowForUuid(inventory?.items, grantedUuid)
          if (!row?.card) return
          const page = { kind: 'preview', card: row.card, type: 'item', lockedReason: null,
            statItemsToPageContent: [...itemPromiseBadges(row, t), ...registryBadges],
            additionalProps: badgeProps ?? {} }
          // v0.38.2 — the item is read FIRST: whatever landed meanwhile (a mission it closed,
          // the weather) waits behind its forward arrow rather than being covered.
          viewActions.setPreviewRight(prev => prev
            ? { ...page, additionalProps: { ...page.additionalProps, onClose: undefined,
                onForward: () => viewActions.setPreviewRight(prev) } }
            : page)
        })
        .catch(() => {})
    }
    const edge = applyEdgeState(result?.edgeState)
    // v0.37.4 — news covers the reload; with none, the loading page stays until the new
    // board lands. Putting it away at once showed the OLD location back for the whole wait.
    if (narrative || grantedUuid || edge || tail) stopLoading()
    return reload
  }, [reloadBoard, applyChoicesPending, applyEdgeState, stopLoading, playerStats, playerUuid,
    t, viewActions, matchUuid, accessToken, lang, gameData, timeEndTail])

  // Step 15 — an executed event answers with ONE forward turn when it moved the character, else a fade.
  const handleEventExecuted = useCallback((result, fallbackCard = null) =>
    played(turnOf(result), () => applyEvent(result, fallbackCard)), [played, applyEvent])

  // Step 33 — a movement answers with what the destination did about the arrival.
  // v0.35.6 — an arrival kills as an event does: the edge state comes last, so a collapse
  // covers the arrival's own card rather than the other way round.
  const handleMovementDone = useCallback(result => played('forward', () => {
    const reload = reloadBoard(result)
    const fired = showAutomaticEvents(result?.automaticEvents, timeEndTail(result))
    const edge = applyEdgeState(result?.edgeState)
    // v0.37.4 — same rule as an event: no news, the loading page stays until the destination lands.
    if (fired || edge) stopLoading()
    return reload
  }), [played, reloadBoard, showAutomaticEvents, applyEdgeState, stopLoading, timeEndTail])

  // Step 33 — a sleep answers with the location counters that ran out while the party slept,
  // already filtered for this player. Empty is the normal case and renders nothing.
  // Step 15 — a sleep never moves: the held pages fade.
  const handleSlept = useCallback(result => played('fade', () => {
    const reload = reloadBoard(result)
    const fired = result?.counterZero ?? []
    viewActions.setCounterZero(fired.length ? fired : null)
    // v0.35.6 — the recovery and the events a time-start fires can empty a life bar; waking
    // up comatose with nothing on screen to say why was the whole complaint.
    applyEdgeState(result?.edgeState)
    return reload
  }), [played, reloadBoard, viewActions, applyEdgeState])

  // Step 34 — dropping applies nothing and narrates nothing. The bag stays open on purpose:
  // dropping is a tidying gesture and usually comes in a run, so the list the player is
  // working through must not vanish under them.
  const handleItemDropped = useCallback(() => {
    // A drop touches the bag and the weight only: nothing of the chrome moves.
    const reload = reloadBoard(DROP_ANSWER)
    // Step 15 — the bag reopens on itself: no turn.
    viewActions.openItems(null)
    return reload
  }, [reloadBoard, viewActions])

  // Step 35 — using an item closes the bag: the row is consumed, and what matters now is the
  // effect it applied — which narrates on the very page the item list was covering.
  // Step 15 — the bag closes: ONE back turn.
  const handleItemUsed = useCallback(result =>
    played('back', () => applyEvent(result, result?.card ?? null)), [played, applyEvent])

  // Step 38 — buying a point closes the training page: the answer carries its two
  // statChanges (+1 stat, -cost exp) in the execute-event shape, so the event handler
  // narrates it under the "trained" card with the badges it already has.
  const handleExpUsed = useCallback(result =>
    played('back', () => applyEvent(result, buildTrainedCard(t))), [played, applyEvent, t])

  /**
   * Step 32 — picking an option: POST select-choice, then narrate what it did. The board
   * reloads first (the resolution may have moved the character, changed the weather or
   * written a key), which puts the LEFT page back on the current location; the RIGHT page
   * then shows the linked event's card when the option ran one, else the effect narrative.
   */
  const applyChoice = useCallback(result => {
    const reload = reloadBoard(result)
    // A linked choice-event: the story chained one choice onto another, so the options
    // list is re-armed rather than closed.
    if (result?.status === 'CHOICES_PENDING') {
      applyChoicesPending(result)
      return reload
    }
    viewActions.closeChoices()
    const tail = timeEndTail(result)
    // The event an effect ran inline wins over the last effect card: the roadmap asks for
    // "la card del evento" on the right page.
    const narrative = result?.choiceEventCard ?? lastEffectCard(result)
    eventEffectActiveRef.current = !!narrative
    if (narrative) {
      // An option writes the registry as an event effect does, so its outcome card says so
      // the same way — the badges live on the OUTCOME, whichever door reached it.
      const registryBadges = registryChangeItems(result, gameData?.info?.registry)
      const badgeProps = registryBadges.length > 0 ? { bonusBadgeShowZeros: true } : null
      viewActions.openPreview({ card: narrative, type: 'event',
        stats: [...statChangeItems(result, playerUuid, t), ...registryBadges], side: 'right',
        props: tail ? { ...(badgeProps ?? {}), onClose: undefined, onForward: tail } : badgeProps })
    } else {
      tail?.()
    }
    applyEdgeState(result?.edgeState)
    return reload
  }, [reloadBoard, applyChoicesPending, applyEdgeState, playerUuid, t, viewActions, gameData, timeEndTail])

  const handleSelectChoice = useCallback(async choice => {
    if (!choice?.uuid || choiceInFlight) return
    setChoiceInFlight(true)
    try {
      const result = await selectChoice(matchUuid, choice.uuid, accessToken, lang)
      // The option stays "in flight" until the new board has landed, not just until answered.
      await played(turnOf(result), () => applyChoice(result))
    } catch (e) {
      // Step 15 — the lifted option is put down; it stays on screen: the cycle is still open.
      play?.cancel?.()
      onError?.(e?.response?.data?.error || e?.message || 'select-choice-failed')
    } finally {
      setChoiceInFlight(false)
      stopLoading()
    }
  }, [choiceInFlight, matchUuid, accessToken, lang, played, applyChoice, play, stopLoading, onError])

  return {
    loading, startLoading, stopLoading, choiceInFlight,
    reloadBoard, handleEventExecuted, handleMovementDone, handleSlept,
    handleItemDropped, handleItemUsed, handleExpUsed, handleSelectChoice, showAutomaticEvents,
    showMissionsCompleted,
  }
}
