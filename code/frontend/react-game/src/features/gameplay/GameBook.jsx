import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/context'
import LocationCard from './cards/LocationCard'
import PlayerStats from './cards/PlayerStats'
import EndGameBook from './EndGameBook'
import GameBookMobile from './GameBookMobile'
import { endMatch, getMatchClock, getMatchWeather, getMatchLocations, selectChoice } from '../../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import Book from '../../components/book/Book'
import CardPreviewModal from '@/components/modals/CardPreviewModal'
import Card from '../../components/layout/Card'
import {
  buildCardCharacteristics,
  buildCardCharacteristicsRight,
  storySelectionCount,
  selectedTraitCount,
  checkShowToSleepCard,
} from '@/utils/gamebook'
import CloseGameCard from './cards/CloseGameCard'
import GoToSleepCard from './cards/GoToSleepCard'
import MovementCard from './cards/MovementCard'
import ActionCard from './cards/ActionCard'
import WeatherCard from './cards/WeatherCard'
import ComaCard from './cards/ComaCard'
import SadnessCard from './cards/SadnessCard'
import PendingChoicesList from './cards/PendingChoicesList'
import EndGameCard from './cards/EndGameCard'
import PlayerCards from './cards/PlayerCards'
import MapCard from './cards/MapCard'
import MatchLogCard from '@/features/matches/MatchLogCard'
import MapPage from '@/components/layout/Map'
import LoadingCard from '@/components/layout/LoadingCard'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { buildCardToSleep } from '@/utils/loadoutCards'

// Mobile is a single stacked column (left on top, right below) that scrolls as a
// whole inside `.book-overlay`. These helpers move a card into view there; on
// desktop the `.book-mobile-*` wrappers are display:none so they are no-ops.
const MOBILE_MQ = '(max-width: 767px)'
function isMobileViewport() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_MQ).matches
}
function scrollMobileIntoView(selector) {
  if (!isMobileViewport()) return
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  })
}
function scrollBookToTop() {
  requestAnimationFrame(() => {
    document.querySelector('.book-overlay')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    document.querySelector('.book-mobile-left')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  })
}

/**
 * The card an executed event narrates: the LAST applied effect that carries one. The effects
 * come back in the order the engine applied them (a chain runs several), and the story reads
 * as the one that landed last. Effects without a card are skipped — they change stats, they
 * do not tell anything.
 */
export function lastEffectCard(result) {
  const effects = result?.effects ?? []
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    if (effects[i]?.card) return effects[i].card
  }
  return null
}

// The engine names the statistics as the story authors them; the badges (and their
// translations) use the longer in-game names. Anything not listed has no badge.
const STAT_CHANGE_KEYS = {
  life: 'life',
  energy: 'energy',
  sad: 'sadness',
  exp: 'experience',
  dex: 'dexterity',
  int: 'intelligence',
  cos: 'constitution',
  food: 'food',
  magic: 'magic',
  coin: 'coins',
}

/**
 * The badges an executed event earned the player: its `statChanges`, which carry the delta
 * ACTUALLY applied (after the clamp — a -10 life on a character with 3 left is a -3), one row
 * per character and per statistic. Rows of the other characters standing in the location are
 * dropped, and a chain that touches the same statistic twice is summed into one badge.
 * A net delta of 0 earns no badge.
 */
export function statChangeItems(result, characterUuid, t = (k) => k) {
  const totals = new Map()
  for (const change of result?.statChanges ?? []) {
    if (characterUuid && change?.characterUuid && change.characterUuid !== characterUuid) continue
    const key = STAT_CHANGE_KEYS[String(change?.statistic ?? '').toLowerCase()]
    const delta = Number(change?.delta)
    if (!key || !Number.isFinite(delta)) continue
    totals.set(key, (totals.get(key) ?? 0) + delta)
  }
  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([key, delta]) => ({
      key,
      label: t(`game.stats.${key}`),
      value: delta > 0 ? `+${delta}` : String(delta),
    }))
}

export default function GameBook({ gameData, matchUuid, story, storyDetail, onReload, onClose, onError }) {//info=
  const LOADING_TIMEOUT_MS = 1000; //TODO change into constant env vars!

  const { t, lang } = useTranslation()
  const { user } = useGuestUser()
  const [loading, setLoading] = useState(false)

  const { actualLocationCard, playerStats, locations, actions, endGameCard } = gameData ?? {}
  const storyCard = story?.card ?? null
  // The location the character currently stands on (for the map's "enter" arrow).
  const hereLocationId = gameData?.info?.players?.[0]?.idLocation ?? null
  // The character this client plays: an event with target ALL also changes the stats of the
  // other characters in the location, and those are not this player's badges.
  const playerUuid = gameData?.info?.players?.[0]?.uuid ?? null

  const [gameEnded, setGameEnded] = useState(false)
  // Desktop dual-page preview. `previewLeft` fills the book's LEFT reading page
  // (the location card and its (i) lens live here); `previewRight` fills the
  // RIGHT page. Each card decides its side via a `previewSide` prop that flows
  // into handleSelectionPreviewFull as the last argument. `previewRight` also
  // hosts the dedicated event pages via a discriminating `kind`
  // (weather | close | endgame); a plain right preview uses kind: 'preview'.
  const [previewLeft, setPreviewLeft] = useState(null)   // { card, type, ... } | null
  const [previewRight, setPreviewRight] = useState(null) // { kind, ... } | null
  // Step 31 — an open choice-event: the event card fills the LEFT page, its options fill
  // the RIGHT page (PendingChoicesList). Kept apart from previewLeft/right so an (i)
  // preview of an option can overlay the RIGHT page and closing it returns to the list.
  const [pendingChoices, setPendingChoices] = useState(null) // { card, choices } | null
  // Step 32 — true while select-choice is in flight, so a double click cannot resolve the
  // same option twice (the second call would answer CHOICE_NOT_OPEN anyway, but the board
  // should not have to learn that from an error).
  const [choiceInFlight, setChoiceInFlight] = useState(false)
  const [statisticsCards, setStatisticsCards] = useState(false)
  // Step 0.28.5 — the world map view: MapPage on the LEFT page, the current
  // location on the RIGHT page. Opened by MapCard in the statistics list.
  const [mapView, setMapView] = useState(false)
  // The explored location clicked on the map: its card fills the right page
  // (null → the current location) and the map marks it as selected.
  const [mapSelected, setMapSelected] = useState(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState(null)
  const [clock, setClock] = useState(null)
  const [weather, setWeather] = useState(null)
  const [previewModal, setPreviewModal] = useState(null)
  const [locationCosts, setLocationCosts] = useState({})
  // Step 0.28.5 — the full GET /match/{uuid}/locations payload (the visited
  // locations with their directional neighbors), consumed by MapPage.
  const [matchLocations, setMatchLocations] = useState(null)
  const prevWeatherUuidRef = useRef(null)
  // Step 29 — true while an executed event is showing its effect card on the
  // right page. If the SAME event also changed the weather, the async weather
  // reload must NOT cover the effect: it attaches a forward arrow to it instead.
  const eventEffectActiveRef = useRef(false)
  // Step 31 — mirrors `pendingChoices` so the async weather reload (which runs off a
  // [weather] effect and can't see the latest state) knows a choice-event owns the right
  // page and must not cover its options with the weather card.
  const pendingChoicesRef = useRef(null)
  const [activeAction, setActiveAction] = useState(null)//used into endGame overlay and in future: action overlay
  // Set right before a sleep/movement reload so the effect below scrolls the
  // freshly-loaded board (the new card) back to the top on mobile.
  const scrollTopAfterReloadRef = useRef(false)
  const [showGoToSleepCard,setShowGoToSleepCard]=useState(false);

  // Load the clock cycle state once the match is known, and after each sleep.
  async function refreshClock() {
    if (!matchUuid) return
    try {
      setClock(await getMatchClock(matchUuid, user?.accessToken))
    } catch {
      // Clock is non-critical chrome; leave the previous value on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchClock(matchUuid, user?.accessToken)
      .then(c => { if (!cancelled) setClock(c) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken])

  // Step 27 — load the current weather once the match is known, and after each
  // sleep that advances the clock (a new time unit re-selects the weather).
  async function refreshWeather() {
    if (!matchUuid) return
    try {
      setWeather(await getMatchWeather(matchUuid, user?.accessToken))
    } catch {
      // Weather is non-critical chrome; leave the previous value on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchWeather(matchUuid, user?.accessToken)
      .then(w => { if (!cancelled) setWeather(w) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken])

  // Step 31 — keep the ref the weather effect reads in sync with the state.
  useEffect(() => { pendingChoicesRef.current = pendingChoices }, [pendingChoices])

  // Show the new weather as a right-page reading page (WeatherCard with a back
  // arrow) when the weather UUID changes (skips the initial load where
  // prevWeatherUuidRef is still null).
  useEffect(() => {
    if (!weather) return
    const prevUuid = prevWeatherUuidRef.current
    prevWeatherUuidRef.current = weather.uuid
    if (prevUuid === null || weather.uuid === prevUuid) return
    // Step 29 — if the weather changed as part of an event that also narrated an
    // effect card (still shown on the right page), don't cover it: attach a
    // forward arrow (→) to the effect card that opens the new weather page.
    // Otherwise (e.g. a sleep-driven change) show the weather page directly.
    const duringEvent = eventEffectActiveRef.current
    eventEffectActiveRef.current = false
    // Step 31 — a choice-event owns the right page: never let a weather change cover its
    // options. The weather is still reachable from the stats view; the board (with the
    // current weather) returns when the choices are closed.
    if (pendingChoicesRef.current) return
    setPreviewRight(prev => {
      if (duringEvent && prev && prev.kind === 'preview') {
        return { ...prev, additionalProps: { ...prev.additionalProps,
          // The effect only leads forward to the weather: drop its back arrow.
          onClose: undefined,
          onForward: () => setPreviewRight({ kind: 'weather' }) } }
      }
      // Step 30 — a coma or sadness card is the important news; the weather waits behind a
      // forward arrow (→) on it rather than covering it. The card keeps its close arrow.
      if (duringEvent && prev && (prev.kind === 'coma' || prev.kind === 'sad')) {
        return { ...prev, onForward: () => setPreviewRight({ kind: 'weather' }) }
      }
      return { kind: 'weather' }
    })
  }, [weather]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile: when the player opens a right-page preview (the close prompt, an
  // endgame or a right-routed card (i)), bring it into view — it renders at the
  // bottom of the stacked column. Weather is event-driven (it may fire together
  // with a sleep reload) so it is excluded here to not fight the scroll-to-top.
  useEffect(() => {
    if (previewRight && previewRight.kind !== 'weather') scrollMobileIntoView('.book-mobile-right')
  }, [previewRight])

  // Mobile: after a sleep/movement reload lands (new gameData), scroll the board
  // back to the top so the new card is in view instead of the old action button.
  useEffect(() => {
    if (!scrollTopAfterReloadRef.current) return
    scrollTopAfterReloadRef.current = false
    scrollBookToTop()
  }, [gameData])

  // Step 28 — load the per-neighbor total energy cost; the weather can change it,
  // so it is refreshed together with the clock/weather after a board reload.
  function buildLocationCosts(payload) {
    const map = {}
    for (const loc of payload?.locations ?? []) {
      for (const n of loc.neighbors ?? []) {
        if (n.uuid != null) map[n.uuid] = n.totalEnergyCost
      }
    }
    return map
  }
  async function refreshLocations() {
    if (!matchUuid) return
    try {
      const payload = await getMatchLocations(matchUuid, user?.accessToken, lang)
      setMatchLocations(payload)
      setLocationCosts(buildLocationCosts(payload))
    } catch {
      // Move costs are non-critical chrome; leave the previous map on failure.
    }
  }
  useEffect(() => {
    let cancelled = false
    if (!matchUuid) return undefined
    getMatchLocations(matchUuid, user?.accessToken, lang)
      .then(p => { if (!cancelled) { setMatchLocations(p); setLocationCosts(buildLocationCosts(p)) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [matchUuid, user?.accessToken, lang])

  function refreshComponents(){
    setLoading(true);
    setMatchLocations({})
    setLocationCosts({})
    setPreviewLeft(null)
    setPreviewModal(null)
    setPreviewRight(null)
    setMapView(false)
    setMapSelected(null)
    setShowGoToSleepCard(false);
    const el = document.getElementById('cardPreviewModal')
    const Modal = window.bootstrap?.Modal
    if (el && Modal) Modal.getOrCreateInstance(el).hide()
    setTimeout(() => setLoading(false), LOADING_TIMEOUT_MS);
  }
  function handleReloadClockWeatherAndMatchData() {
    setLoading(true);
    // Sleep may advance the clock (when all characters are done): refresh the
    // clock chrome AND reload the board so stats/energy/location reflect it.
    refreshClock()
    // Step 27 — the clock may have advanced to a new time unit: re-select weather.
    refreshWeather()
    // Step 28 — weather/position changed: refresh the per-neighbor move costs.
    refreshLocations()
    // Ask the post-reload effect to scroll the new board to the top (mobile).
    scrollTopAfterReloadRef.current = true
    onReload?.()
    handleBackOrClose()
    refreshComponents();

  }
  
  // `side` ('left' | 'right') is supplied by each card's `previewSide` prop.
  // A right preview always renders inline on the right page (desktop) / bottom
  // of the stack (mobile). A left/default preview keeps its behaviour: the (i)
  // lens opens a Bootstrap modal on mobile, or the left reading page on desktop.
  function handleSelectionPreviewFull(card, type, lockReason, statistics , showModal=true , additionalProps={}, side='left') {
    //console.log("handleSelectionPreviewFull",  statistics);
    const previewData = card ? { card, type, lockedReason: lockReason, statItemsToPageContent: statistics, additionalProps } : null
    if (!card){
      setPreviewLeft(null)
      setPreviewRight(null)
      setPreviewModal(null)
      return; //ingore null preview, just close the modal if open
    }
    if (side === 'right') {
      // Right previews are inline on both desktop and mobile (the mobile scroll
      // effect brings them into view); they never use the (i) modal.
      setPreviewModal(null)
      setPreviewRight({ kind: 'preview', ...previewData })
    } else if (showModal && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches) {
      setPreviewModal(previewData)
      const el = document.getElementById('cardPreviewModal')
      const Modal = window.bootstrap?.Modal
      if (el && Modal) Modal.getOrCreateInstance(el).show()
    } else {
      setPreviewModal(null);
      setPreviewLeft(previewData)
      // The left reading page scrolls its own content back to the top.
      document.querySelector('.book-page-left .page-inner')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    }
  }
  // Step 29 — an executed event answers with one entry per applied effect, each carrying its
  // OWN card: that card is the narrative. A chain (idEventNext) applies several in order, and
  // the story reads as the last one — so that is the one shown, on the reading page.
  // handleBackOrClose() inside the reload would close it again, hence the preview comes after.
  function handleEventExecuted(result) {
    handleReloadClockWeatherAndMatchData()
    setLoading(true);
    // Step 31 — a choice-event answers CHOICES_PENDING: cost paid, effects withheld. The
    // event card fills the LEFT page and its options fill the RIGHT page (as small cards).
    // Nothing was applied, so there is no effect narrative; arm the effect flag so a
    // stray weather reload attaches a forward arrow rather than covering the view.
    if (result?.status === 'CHOICES_PENDING') {
      eventEffectActiveRef.current = true
      setPreviewRight(null)
      setPendingChoices({ card: result.card ?? null, choices: result.pendingChoices ?? [] })
      setLoading(false)
      return
    }
    const narrative = lastEffectCard(result)
    // Arm the weather effect: if this event also changes the weather, the async
    // reload will attach a forward arrow to this card instead of covering it.
    eventEffectActiveRef.current = !!narrative
    if (narrative) {
      handleSelectionPreviewFull(narrative, 'effect', null, statChangeItems(result, playerUuid, t), true, {}, 'right')
    }
    // Step 30 — an edge state outranks the effect narrative: falling into a coma or being
    // crushed by sadness is the news, not whatever the effect said on the way there. The
    // party collapse outranks a personal one, since it ends everyone's turn at once.
    const edge = result?.edgeState
    if (edge?.allPlayersInComa) {
      // Arm the weather effect: a coma is the news, so a weather change from the same
      // event must not cover it — it attaches a forward arrow instead (like an effect card).
      eventEffectActiveRef.current = true
      setPreviewLeft({ kind: 'coma', allPlayers: true, card: edge.comaEventCard ?? null })
    } else if (edge?.comaUuids?.includes(playerUuid)) {
      eventEffectActiveRef.current = true
      setPreviewLeft({ kind: 'coma', allPlayers: false, card: null })
    } else if (edge?.sadnessOverflowUuids?.includes(playerUuid)) {
      eventEffectActiveRef.current = true
      setPreviewLeft({ kind: 'sad' })
    }
    setLoading(false);
  }
  function handleEndGamePreviewFull(card, action, lockReason, statistics , showModal=true , additionalProps={}) {
    //setEndGameCard(card);
    //setActiveAction(action);
    handleSelectionPreviewFull(card, 'end game', lockReason, statistics , showModal , additionalProps, 'right');
    //setPreviewRight({ kind: 'endgame' });
  }
  function handleBackOrClose() {
    setPreviewLeft(null);
    setStatisticsCards(false);
    setShowGoToSleepCard(false);
  }
  // Step 0.28.5 — from the map's right-page location card (when it is the
  // character's own location), enter the play view: left = current location,
  // right = the movement/actions board (the base non-statistics view).
  function enterCurrentLocationView() {
    setLoading(true);
    setMapView(false);
    setMapSelected(null);
    setStatisticsCards(false);
    setPreviewLeft(null);
    setPreviewRight(null);
    setShowGoToSleepCard(false);
    setLoading(false);
  }

  const handleEndGame = async (action) => {
    setLoading(true);
    if (ending) return
    setEnding(true)
    setEndError(null)
    try {
      const eventUuid = action?.uuidEvent ?? action?.uuid
      //console.log('Ending game with action:', action , user, { eventUuid, matchUuid })
      await endMatch(matchUuid, eventUuid, user?.accessToken)
      setGameEnded(true)
    } catch (e) {
      const apiError = e?.response?.data?.error
      setEndError(apiError || e?.message || 'end-game-failed')
    } finally {
      setEnding(false)
    }
    setLoading(false);
  }

  if (gameEnded) {
    return <EndGameBook story={story} endGameCard={endGameCard} onClose={onClose} />
  }
  //console.log("QUI",storyCard, story);
  //console.log("actualLocationCard", actualLocationCard);

  // The base (non-preview) left content: the current location, or the story
  // card as fallback. On mobile this is what the stacked left shows — the (i)
  // preview opens in a modal instead (see handleSelectionPreviewFull).
  //console.log("previewLeft", previewLeft, "actualLocationCard", actualLocationCard, "storyCard", storyCard);
  // The RIGHT reading page. Dedicated event pages (weather / close / endgame)
  // render their own card component in page mode; a plain right preview
  // (kind: 'preview') renders the same page Card the left page uses. Each has a
  // back arrow that clears previewRight.
  const closeRight = () => setPreviewRight(null)
  const closeLeft = () => setPreviewLeft(null)
  // Step 31 — end an open choice-event: drop the event card (left), the options list
  // (right) and any option preview overlaying it. The back arrow on the event card and
  // the "do nothing" card both call this; the cost paid on open stays paid.
  const closeChoices = () => {
    setPendingChoices(null)
    setPreviewRight(null)
    eventEffectActiveRef.current = false
  }
  // Step 32 — picking an option: POST select-choice, then narrate what it did.
  //
  // The board reloads first (the resolution may have moved the character, changed the
  // weather or written a key), which puts the LEFT page back on the current location —
  // the roadmap's "riparte dalla current location", and the whole of what the id_location
  // case needs. The RIGHT page then shows the linked event's card when the option ran
  // one, else the effect narrative, exactly as an executed event does.
  const handleSelectChoice = async (choice) => {
    if (!choice?.uuid || choiceInFlight) return
    setChoiceInFlight(true)
    try {
      const result = await selectChoice(matchUuid, choice.uuid, user?.accessToken, lang)
      handleReloadClockWeatherAndMatchData()
      setLoading(true)
      // A linked choice-event: the story chained one choice onto another, so the options
      // list is re-armed rather than closed.
      if (result?.status === 'CHOICES_PENDING') {
        eventEffectActiveRef.current = true
        setPreviewRight(null)
        setPendingChoices({ card: result.card ?? null, choices: result.pendingChoices ?? [] })
        return
      }
      closeChoices()
      // The event an effect ran inline wins over the last effect card: the roadmap asks
      // for "la card del evento" on the right page.
      const narrative = result?.choiceEventCard ?? lastEffectCard(result)
      // Arm the weather effect: if the option also changed the weather, the async reload
      // attaches a forward arrow to this card instead of covering it — "prima id_event,
      // poi id_weather".
      eventEffectActiveRef.current = !!narrative
      if (narrative) {
        handleSelectionPreviewFull(narrative, 'event', null,
          statChangeItems(result, playerUuid, t), true, {}, 'right')
      }
      // Step 30 — an edge state outranks the narrative: falling into a coma or being
      // crushed by sadness is the news, not whatever the option said on the way there.
      const edge = result?.edgeState
      if (edge?.allPlayersInComa) {
        eventEffectActiveRef.current = true
        setPreviewLeft({ kind: 'coma', allPlayers: true, card: edge.comaEventCard ?? null })
      } else if (edge?.comaUuids?.includes(playerUuid)) {
        eventEffectActiveRef.current = true
        setPreviewLeft({ kind: 'coma', allPlayers: false, card: null })
      } else if (edge?.sadnessOverflowUuids?.includes(playerUuid)) {
        eventEffectActiveRef.current = true
        setPreviewLeft({ kind: 'sad' })
      }
    } catch (e) {
      // The option stays on screen: the cycle is still open, so retrying is legal.
      onError?.(e?.response?.data?.error || e?.message || 'select-choice-failed')
    } finally {
      setChoiceInFlight(false)
      setLoading(false)
    }
  }
  const previewRightContent =
    previewRight?.kind === 'weather'
      ? <WeatherCard weather={weather} story={story} onBack={closeRight} />
      : previewRight?.kind === 'close'
        ? <CloseGameCard story={story} onExit={onClose} onBack={closeRight} />
      : previewRight?.kind === 'endgame'
        ? <EndGameCard story={story} action={activeAction} 
            handleEndGamePreviewFull={handleEndGamePreviewFull}
            handleEndGame={handleEndGame} onBack={closeRight} variant="page" />
      : previewRight?.kind === 'matchlog'
        ? <MatchLogCard matchUuid={matchUuid} accessToken={user?.accessToken}
            story={story} onBack={closeRight} />
      : previewRight?.kind === 'coma'
        ? <ComaCard story={story} allPlayers={previewRight.allPlayers}
            comaEventCard={previewRight.card} onBack={closeRight}
            onForward={previewRight.onForward} />
      : previewRight?.kind === 'sad'
        ? <SadnessCard story={story} lifeLost={playerStats?.constitution ?? null}
            onBack={closeRight} onForward={previewRight.onForward} />
//      : previewRight?.kind === 'sleep'
//        ? <GoToSleepCard story={story} playerStats={playerStats} t={t} 
//            onPreview={handleSelectionPreviewFull} onSlept={handleReloadClockWeatherAndMatchData} />
      : previewRight?.kind === 'preview'
        ? <Card variant="page"
            card={previewRight.card}
            entity={previewRight.entity}
            entityType={previewRight.type}
            loading={false}
            story={story}
            onClose={closeRight}
            lockedReason={previewRight.lockedReason}
            statItemsToPageContent={previewRight.statItemsToPageContent}
            {...previewRight.additionalProps}
          />
        : null
  // The LEFT reading page: a left preview, else the current location, else the
  // story card. On mobile this is what the stacked left shows — the (i) preview
  // opens in a modal instead (see handleSelectionPreviewFull).
  const leftContent =
    // Step 31 — an open choice-event: the event card sits here (left), without an execute
    // button; its back arrow ends the event (and clears the options on the right).
    pendingChoices
        ? <Card variant="page"
            card={{ ...(pendingChoices.card ?? {}),
                    title: pendingChoices.card?.title || t('game.choices.title') }}
            entityType="event"
            loading={false}
            story={story}
            onClose={closeChoices}
            hidePreview />
    : previewLeft?.kind === 'coma'
        ? <ComaCard story={story} allPlayers={previewLeft.allPlayers}
            comaEventCard={previewLeft.card} onBack={closeLeft}
            onForward={previewLeft.onForward} />
    : previewLeft?.kind === 'sad'
        ? <SadnessCard story={story} lifeLost={playerStats?.constitution ?? null}
            onBack={closeLeft} onForward={previewLeft.onForward} />
    : mapView ? (
      // Step 0.28.5 — the world map takes over the left page; its back arrow
      // returns to the previous view (previewLeft/statistics stay untouched).
      <MapPage gameData={gameData} matchLocations={matchLocations}
        selectedId={mapSelected?.id ?? null}
        onSelectNode={(val) => {setMapSelected(val); scrollMobileIntoView('.book-mobile-right'); } }
        onClose={() => { setMapView(false); setMapSelected(null) }} />
    ) : previewLeft ? (
      <Card variant="page"
        card={previewLeft.card}
        entity={previewLeft.entity}
        entityType={previewLeft.type}
        loading={false}
        story={story}
        onClose={handleBackOrClose}
        lockedReason={previewLeft.lockedReason}
        statItemsToPageContent={previewLeft.statItemsToPageContent}
        {...previewLeft.additionalProps}
      />
    ) : actualLocationCard ? <LocationCard locationsActive={gameData.info.locationsActive}
        location={actualLocationCard} card={actualLocationCard} story={story} loading={loading}/>
    : storyCard && <Card variant="page" card={storyCard} loading={storyCard===undefined} story={story} />

  const cardCharacteristics = buildCardCharacteristics(story, playerStats, clock , weather)
  const cardCharacteristicsRight = buildCardCharacteristicsRight(story, playerStats, clock, weather, {
    matchUuid,
    accessToken: user?.accessToken,
    onSlept: handleReloadClockWeatherAndMatchData,
  })
  // The loaded detail (with content lists) when available, otherwise the summary prop.
  const storyFull = storyDetail ?? story
  //const statistics = buildConfigStatistics(gameData?.playerStats ?? {}, t);

  //console.log("gameData",gameData)
  //console.log("story",story);
  //console.log("storyFull",storyFull);
  //console.log("locations",locations , "actions", actions);
  //console.log("playerStats",playerStats);
  //console.log("a",resolveSelectionEntity(storyFull, playerStats, gameData, 'difficulty'));
  //console.log("mapSelected",mapSelected, "hereLocationId", hereLocationId, "locationCosts", locationCosts);

  function setSleepCardFromInfoCard() {//buildCardToSleep(story, playerStats, t)
  //  setPreviewRight({ kind: 'sleep' });
    setShowGoToSleepCard(true);
    //qui voglio simulare il click sul bottone con aria-label=Sleep
    setTimeout(() => { document.querySelector('button[aria-label="Sleep"]')?.click(); }, 100);
  }

  // The node selected on the map, resolved for the right page: an explored node
  // carries its own location card, while an unexplored ("?") one is fog-gated
  // (card: null) — it falls back to the matching move-target neighbor from
  // gameData.locations, the same object (link card, cost, backend verdict) the
  // board's MovementCard renders.
  const mapSelectedNeighbor = mapSelected && !mapSelected.visited
    ? (locations ?? []).find(l => l.idLocation === mapSelected.id) ?? null
    : null
  const mapSelectedLocation = mapSelectedNeighbor ?? mapSelected

  const rightContent =
    previewRight ? previewRightContent
    // Step 31 — an open choice-event owns the right page: the options as small cards,
    // plus the "do nothing" exit. An (i) preview of an option overlays via previewRight
    // (checked first), so closing that overlay returns here to the list.
    : pendingChoices ? <PendingChoicesList story={story} choices={pendingChoices.choices}
        onPreview={handleSelectionPreviewFull} onSelect={handleSelectChoice}
        busy={choiceInFlight} onDoNothing={closeChoices} />
    // Step 0.28.5 — while the map fills the left page, the right page shows
    // the location selected on the map, else the current location.
    : mapView ? (mapSelected
        ? <MovementCard variant="page" location={mapSelectedLocation} viewFromMap={true}
            isNeighbor={mapSelectedNeighbor != null || (mapSelected.isNeighbor ?? false)}
            totalEnergyCost={mapSelectedLocation.uuid != null ? locationCosts[mapSelectedLocation.uuid] : undefined}
            playerStats={playerStats} story={story}
            matchUuid={matchUuid} accessToken={user?.accessToken}
            onMoved={handleReloadClockWeatherAndMatchData} onError={onError} 
            />
        : <LocationCard locationsActive={gameData?.info?.locationsActive}
            location={actualLocationCard} card={actualLocationCard} story={story}
            onEnterLocation={enterCurrentLocationView} />)
    : statisticsCards ? <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <WeatherCard weather={weather} story={storyFull} onPreview={handleSelectionPreviewFull} previewSide="right" />
          <GoToSleepCard story={story} storyFull={storyFull} gameData={gameData} playerStats={playerStats} onPreview={handleSelectionPreviewFull}
            previewSide="right" matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleReloadClockWeatherAndMatchData}/>
          <MapCard onOpen={() => {setMapView(true);scrollMobileIntoView('.book-mobile-left')}} />
          <PlayerCards storyFull={storyFull} story={story} playerStats={playerStats}
            gameData={gameData} onPreview={handleSelectionPreviewFull} previewSide="right"
            onPreviewMatchLog={() => setPreviewRight({ kind: 'matchlog' })} />
        </div>
      </div>
    : <>
      <div className="config-view-wrap config-view--config">
        <div className="config-cards-area selection-list">
          <Card card={cardCharacteristics} entityType="information"  story={story} flagInformationCard={true} previewSide="right"
            infoLabel={''/*t('card.gameStatus')*/} infoIconClassName="fas fa-info-circle font-size-medium m-1" 
            infoLabelClassName="font-size-medium display-none"
    
            actionLabel={''}    actionIcon= 'fa-map m-1'   onAction={() => {setMapView(true);scrollMobileIntoView('.book-mobile-left')}} 
            actionsList={[{ label: '', icon: 'fa-bed m-1', onAction: () => { setSleepCardFromInfoCard();}},              
              /* NEVER REMOVE THIS COMMENT
              { label: '', icon: 'fa-clipboard-list m-1', onAction: () => { alert('Items, missions and registry coming soon!') } },
              { label: '', icon: 'fa-list m-1', onAction: () => { alert('Items, missions and registry coming soon!') } },
              { label: '', icon: 'fa-flask m-1', onAction: () => { alert('Items, missions and registry coming soon!') } },
              { label: '', icon: 'fa-people-arrows m-1', onAction: () => { alert('Items, missions and registry coming soon!') } },
               */
            ]}

            onPreview={() => { handleSelectionPreviewFull(cardCharacteristicsRight, 'information', null, [], false); setStatisticsCards(true) } }
            childrenIntoImage={<PlayerStats stats={playerStats} plainFlag={false} showLabel={false} showGrid2={true}
                                  className="m-1 display-inline-grid flex-direction-column display-grid2" />}
          />
          {playerStats?.isComa && <ComaCard story={story} onPreview={handleSelectionPreviewFull} previewSide="right"/>}

          {/* Show the sleep card only when the player is energy-stuck: every
              available movement and action costs more energy than they have. */}
          {(checkShowToSleepCard({ playerStats, locations, actions, locationCosts }) || (showGoToSleepCard)) &&
            <GoToSleepCard story={story} storyFull={storyFull} gameData={gameData} playerStats={playerStats} onPreview={handleSelectionPreviewFull}
              previewSide="right" matchUuid={matchUuid} accessToken={user?.accessToken} onSlept={handleReloadClockWeatherAndMatchData}/>
          }
          {/* Step 27 — current weather card (in both render points). }
          <WeatherCard weather={weather} story={story} onPreview={handleSelectionPreviewFull} /> {  
          removed (for now) because weathere card is on cardCharacteristics */}
          { /* Step 28 — for every neighbor-location render a move-target card */ }
          { (locations ?? []).map(loc => (
            <MovementCard key={loc.uuid ?? loc.idLocation} location={loc}
              totalEnergyCost={loc.uuid != null ? locationCosts[loc.uuid] : undefined}
              playerStats={playerStats} story={story} onPreview={handleSelectionPreviewFull}
              previewSide="right" matchUuid={matchUuid} accessToken={user?.accessToken}
              onMoved={handleReloadClockWeatherAndMatchData} onError={onError} />
          )) }

          { /* for every action in location — end-game events expose an "end game" button */  }
          { (actions ?? []).map( action => {
            if (action.endGame) {
              return <EndGameCard key={action.uuid} story={story} action={action} 
                handleEndGamePreviewFull={handleEndGamePreviewFull} handleEndGame={handleEndGame} />
            } else {
              return <ActionCard key={action.uuid} action={action} story={story}
                onPreview={handleSelectionPreviewFull} previewSide="right"
                playerStats={playerStats} matchUuid={matchUuid} accessToken={user?.accessToken}
                onDone={handleEventExecuted} onError={onError} />
            }
          }) }
          <div className="sleep-action-row">
          </div>
        </div>
      </div>
      {endError && (
        <p className="game-error end-game-error">
          <i className="fas fa-exclamation-triangle me-2" />{endError}
        </p>
      )}
    </>
  

  return (
    <>
      <Book
        onClose={() => setPreviewRight({ kind: 'close' })}
        closeLabel={`${t('game.closeBook')}${story?.title ?? story?.card?.title ? ' ' + (story?.title ?? story?.card?.title) : ''}`}
        left={leftContent}
        right={loading ? <LoadingCard story={story} /> : rightContent}
        mobile={
          <GameBookMobile
            left={leftContent}
            right={loading ? <LoadingCard story={story} /> :rightContent}
            endError={endError} />
        }
      />
      {/* Mobile (i) preview: the big card shown in a Bootstrap modal. */}
      <CardPreviewModal preview={ previewModal} story={story}
      />
    </>
  )
}
