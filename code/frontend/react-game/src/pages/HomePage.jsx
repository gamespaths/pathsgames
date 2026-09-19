import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/context'
import { getStoriesCatalog } from '../api/stories'
import { listMatches } from '../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import StoryCatalog from '../features/catalog/StoryCatalog'
import StartBookModal from '../features/start-book/StartBookModal'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { TURNSTILE_APPEARANCE } from '../utils/turnstile'
import useAntibot from '../hooks/useAntibot'
import { storyHasBlockingMatch, findResumableMatch } from '../utils/matchStatus'
import { RESUME_WITHOUT_MODAL, ADD_COMING_SOON_STORIES, HIDE_STORIES } from '../constants/features'
import { withComingSoonStories } from '../utils/comingSoonStories'
import { withoutHiddenStories } from '../utils/hiddenStories'
import LoadingCard from '@/components/layout/LoadingCard'
import { useHomeStatus } from '@/context/HomeStatusContext'

const HERO_IMG = {
  url: 'https://images.unsplash.com/photo-1439396874305-9a6ba25de6c6?auto=format&fit=crop&w=1400&q=80',
  copyrightText: 'Lili Popper on Unsplash',
  linkCopyright: 'https://unsplash.com/photos/gray-and-white-pathway-between-green-plants-on-vast-valley-lu15z1m_KfM',
}

export default function HomePage() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { user, error: guestError, openGuestModal } = useGuestUser()
  const [stories, setStories] = useState([])
  const [matches, setMatches] = useState(null) // guest matches, loaded once when human
  // v0.32.1 — 'loading' | 'ready' | 'error': an unreadable list must NOT look like
  // "no matches", or a network hiccup would let the player start a second match.
  const [matchesStatus, setMatchesStatus] = useState('loading')
  const [pendingStoryUuid, setPendingStoryUuid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedStory, setSelectedStory] = useState(null)
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
  // guest modal instead of being re-fetched there). The promise is kept in a ref:
  // a click that lands before it resolves waits for it rather than starting a
  // second request — the window in which a duplicate match could be created.
  useEffect(() => {
    // v0.37.6 — no bearer token yet: the guest session is still being resumed/created,
    // calling now would only be a 401. A guest that could not be minted at all is an
    // error (no list can ever come); otherwise stay 'loading' until the token lands.
    if (!user?.accessToken) {
      if (guestError) setMatchesStatus('error')
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
  }, [user?.accessToken, guestError])

  // v0.37.6 — one state for every card footer. The antibot verdict wins over the
  // match list: a failed check blocks the buttons whatever the matches said.
  const footerState = gate.phase === 'error'
    ? 'blocked'
    : gate.phase === 'checking' || matchesStatus === 'loading'
      ? 'loading'
      : matchesStatus === 'error' ? 'error' : 'ready'

  // Tell the Navbar (outside this route) which load failed, so it offers a refresh.
  useEffect(() => {
    setHomeError(storiesError ? 'stories' : footerState === 'blocked' ? 'antibot' : footerState === 'error' ? 'matches' : null)
  }, [storiesError, footerState, setHomeError])
  useEffect(() => () => setHomeError(null), [setHomeError])

  async function handleStoryClick(story) {
    // The footer only shows a button when the gate passed and the matches answered
    // (or are on their way): anything else is a click on a locked card.
    if (pendingStoryUuid || footerState === 'blocked' || footerState === 'error') return
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
      openGuestModal(list)
    } else {
      setSelectedStory(story)
    }
  }

  return (
    <>
      {/* Hero Netflix-style. v0.37.6 — the Turnstile strip sits inside the overlay, above
          the title, so the check runs over the picture while the catalog loads below;
          `interaction-only` keeps it invisible unless a challenge is due. */}
      <section className="hero-section" style={{ backgroundImage: `url(${HERO_IMG.url})` }}>
        <div className="hero-overlay">
          {gate.phase === 'checking' && (
            <div className="home-antibot-strip">
              <div className="turnstile-checking"> <i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</div>
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
          )}
          <h1 className="hero-title">{t('home.heroTitle')}</h1>
          <p className="hero-sub">{t('home.heroSub')}</p>
        </div>
      </section>

      {/* Catalog — a failed fetch is the one technical error with nothing to show */}
      {loading ? (
        <LoadingCard story={null} maxWidth="500px" />
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

      {/* Book modal */}
      {selectedStory && (
        <StartBookModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}

    </>
  )
}
