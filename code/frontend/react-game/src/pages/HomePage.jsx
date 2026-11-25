import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/context'
import { getStoriesCatalog } from '../api/stories'
import { listMatches } from '../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import usePlayerPage from '@/features/guest-user/usePlayerPage'
import StoryCatalog from '../features/catalog/StoryCatalog'
import TutorialButton from '../features/catalog/TutorialButton'
import Book from '@/components/book/Book'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { TURNSTILE_APPEARANCE } from '../utils/turnstile'
import useAntibot from '../hooks/useAntibot'
import { storyHasBlockingMatch, findResumableMatch } from '../utils/matchStatus'
import { RESUME_WITHOUT_MODAL, ADD_COMING_SOON_STORIES, HIDE_STORIES } from '../constants/features'
import { withComingSoonStories } from '../utils/comingSoonStories'
import { withoutHiddenStories } from '../utils/hiddenStories'
import LoadingCard from '@/components/layout/LoadingCard'
import Card from '@/components/layout/Card'
import { useHomeStatus } from '@/context/HomeStatusContext'
import { RATE_LIMITED } from '@/utils/rateLimit'
import { buildImageCard } from '@/utils/loadoutCards'

// How long "Success! You are human." stays under the intro text after the check passed.
const ANTIBOT_SUCCESS_MS = 4000

export default function HomePage() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { user, error: guestError, sessionIdle, ensureGuest } = useGuestUser()
  const { openPlayerPage } = usePlayerPage()
  const [stories, setStories] = useState([])
  const [matches, setMatches] = useState(null) // guest matches, loaded once when human
  // v0.32.1 — 'loading' | 'ready' | 'error': an unreadable list must NOT look like
  // "no matches", or a network hiccup would let the player start a second match.
  const [matchesStatus, setMatchesStatus] = useState('loading')
  const [pendingStoryUuid, setPendingStoryUuid] = useState(null)
  const [loading, setLoading] = useState(true)
  // The single in-flight `GET /api/matches` and the token it was made with. A click
  // during the load awaits THIS promise instead of firing its own request.
  const matchesPromise = useRef(null)
  // A rejected catalog fetch used to leave `loading` true for ever, so a CORS block
  // or a backend hiccup looked exactly like a slow load.
  const [storiesError, setStoriesError] = useState(false)
  // Antibot gate (session-cached). v0.37.6 — it no longer gates the fetches: the
  // widget, the catalog and the match list all start at mount, in parallel. What
  // it gates is the card footer (Play/Resume buttons) and the click handler.
  const gate = useAntibot({ cookie: true })
  const { setError: setHomeError } = useHomeStatus()
  // Step 14 — the success line follows a check passed on this visit, then goes away.
  const [successShown, setSuccessShown] = useState(false)
  const lastPhase = useRef(gate.phase)
  useEffect(() => {
    const was = lastPhase.current
    lastPhase.current = gate.phase
    if (gate.phase !== 'ready' || was !== 'checking') return undefined
    setSuccessShown(true)
    const timer = setTimeout(() => setSuccessShown(false), ANTIBOT_SUCCESS_MS)
    return () => clearTimeout(timer)
  }, [gate.phase])

  // The in-flight catalog request and its language: StrictMode (dev) runs the effect
  // twice on mount, the second run joins the first request instead of repeating it.
  const storiesRequest = useRef(null)

  // v0.37.6 — static file first (no API call), API as fallback; see getStoriesCatalog.
  useEffect(() => {
    let cancelled = false
    setStoriesError(false)
    setLoading(true)
    if (storiesRequest.current?.lang !== lang) {
      storiesRequest.current = { lang, promise: getStoriesCatalog(lang) }
    }
    storiesRequest.current.promise
      .then(data => {
        if (cancelled) return
        // v0.38.1 — blacklist first, so a hidden story never reaches the catalog.
        setStories(withComingSoonStories(withoutHiddenStories(data, HIDE_STORIES), lang, ADD_COMING_SOON_STORIES))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setStoriesError(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [lang])

  // Load the guest's matches at mount, so the catalog can badge stories and
  // a story click can reuse the list (no extra fetch, and it is handed to the
  // player page instead of being re-fetched there). The promise is kept in a ref:
  // a click that lands before it resolves waits for it rather than starting a
  // second request — the window in which a duplicate match could be created.
  useEffect(() => {
    // v0.37.6 — no bearer token yet: the guest session is still being resumed/created,
    // calling now would only be a 401. A guest that could not be minted at all is an
    // error (no list can ever come); otherwise stay 'loading' until the token lands.
    if (!user?.accessToken) {
      if (guestError) setMatchesStatus('error')
      // v1.2.0 — logged out with no guest to resume: nothing to list until the first Play
      else if (sessionIdle) {
        setMatches([])
        setMatchesStatus('ready')
      }
      return undefined
    }
    let cancelled = false
    setMatchesStatus('loading')
    // Same token as the request already in flight (StrictMode re-run): join it.
    if (matchesPromise.current?.token !== user.accessToken) {
      const promise = listMatches(user.accessToken).then(list => (Array.isArray(list) ? list : []))
      matchesPromise.current = { token: user.accessToken, promise }
    }
    matchesPromise.current.promise
      .then(list => {
        if (cancelled) return
        setMatches(list)
        setMatchesStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setMatches(null)
        setMatchesStatus('error')
      })
    return () => { cancelled = true }
  }, [user?.accessToken, guestError, sessionIdle])

  // v0.37.6 — one state for every card footer. The antibot verdict wins over the
  // match list: a failed check blocks the buttons whatever the matches said.
  const footerState = gate.phase === 'error'
    ? 'blocked'
    : gate.phase === 'checking' || matchesStatus === 'loading'
      ? 'loading'
      : matchesStatus === 'error' ? 'error' : 'ready'

  // Tell the Navbar (outside this route) which load failed, so it offers a refresh.
  // v0.41.0 — a guest refused with 429 is 'rateLimited', not a matches failure.
  useEffect(() => {
    const listError = guestError === RATE_LIMITED ? 'rateLimited' : 'matches'
    setHomeError(storiesError ? 'stories' : footerState === 'blocked' ? 'antibot' : footerState === 'error' ? listError : null)
  }, [storiesError, footerState, guestError, setHomeError])
  useEffect(() => () => setHomeError(null), [setHomeError])

  async function handleStoryClick(story) {
    // The footer only shows a button when the gate passed and the matches answered
    // (or are on their way): anything else is a click on a locked card.
    if (pendingStoryUuid || footerState === 'blocked' || footerState === 'error') return
    // v1.2.0 — after a logout without a guest to resume, the first Play creates the guest
    if (!user && sessionIdle) {
      setPendingStoryUuid(story.uuid)
      try {
        await ensureGuest()
      } catch {
        setMatchesStatus('error')
        setPendingStoryUuid(null)
        return
      }
      setPendingStoryUuid(null)
    }
    let list = matches
    if (!Array.isArray(list)) {
      // Nothing in flight yet (guest session still being created): ignore the click.
      if (!matchesPromise.current) return
      setPendingStoryUuid(story.uuid)
      try {
        list = await matchesPromise.current.promise
      } catch {
        // Fail closed: without the list we cannot tell whether a match already
        // exists, and starting one anyway is exactly the duplicate we are
        // preventing. The card says "error" and the navbar offers a refresh.
        setMatchesStatus('error')
        setPendingStoryUuid(null)
        return
      }
      setPendingStoryUuid(null)
    }
    // RESUME_WITHOUT_MODAL — the card already said "Resume", so the modal would only
    // ask again which match to open: jump straight into it.
    const resumable = RESUME_WITHOUT_MODAL ? findResumableMatch(list, story.uuid) : null
    if (resumable) {
      navigate(`/play/${story.uuid}`, { state: { matchUuid: resumable.uuid } })
    } else if (storyHasBlockingMatch(list, story.uuid)) {
      openPlayerPage(list)
    } else {
      navigate(`/story/${story.uuid}`, { state: { story } })
    }
  }

  // Step 14 — anti-bot result under the intro text: the check, then one short-lived line; blocked and error stay in the navbar.
  const antibotResult = gate.phase === 'checking' ? (
    <div className="home-antibot-strip">
      <div className="turnstile-checking"><i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</div>
      <div className="mt-2">
        <TurnstileWidget
          key={gate.attempt}
          appearance={TURNSTILE_APPEARANCE.home}
          onSuccess={gate.onSuccess}
          onError={gate.onError}
          onExpire={gate.onExpire}
        />
      </div>
    </div>
  ) : gate.phase === 'ready' && successShown ? (
    <p className="home-antibot-success" data-testid="antibot-success">
      <i className="fas fa-check-circle me-2" aria-hidden="true" />{t('antibot.success')}
    </p>
  ) : null

  // Left page: the fixed intro card, the photo credited by the page's credits bar.
  const intro = (
    <Card variant="page" titleTag="h1" loading={false}
      card={buildImageCard('home', t('home.heroTitle'), t('home.heroSub'))}
      afterDescription={antibotResult && <div className="home-intro-antibot">{antibotResult}</div>}
      extraContentClassName="home-intro-extra"
      extraContent={!loading && !storiesError && (
        <TutorialButton stories={stories} matches={matches} footerState={footerState}
          pendingStoryUuid={pendingStoryUuid} onStoryClick={handleStoryClick} />
      )} />
  )

  // Right page: every story in one dealt grid; the heading stays in the markup (multiplayer messages).
  const storiesPage = (
    <>
      <h2 className="book-cards-heading">{t('home.stories')}</h2>
      {loading ? (
        <LoadingCard />
      ) : storiesError ? (
        <div className="stories-section-center stories-loading" role="alert" aria-label={t('home.storiesError')}>
          {/* The message and the retry live in the navbar (HomeStatusContext): here only the sign. */}
          <i className="fas fa-exclamation-triangle home-stories-error-icon" title={t('home.storiesError')} />
        </div>
      ) : (
        <StoryCatalog
          stories={stories}
          matches={matches}
          footerState={footerState}
          pendingStoryUuid={pendingStoryUuid}
          onStoryClick={handleStoryClick}
        />
      )}
    </>
  )

  // No home tab here; an open policy chapter covers both pages, kept mounted (Turnstile keeps running).
  return (
    <Book left={intro} right={storiesPage} homeTab={false}
      stageClass="home-book-stage" wrapperClass="book-wrapper home-book" />
  )
}
