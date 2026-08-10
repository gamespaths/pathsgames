import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../i18n/context'
import { getStories } from '../api/stories'
import { listMatches } from '../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import StoryCatalog from '../features/catalog/StoryCatalog'
import StartBookModal from '../features/start-book/StartBookModal'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { TURNSTILE_APPEARANCE } from '../utils/turnstile'
import useAntibot from '../hooks/useAntibot'
import { storyHasBlockingMatch } from '../utils/matchStatus'
import LoadingCard from '@/components/layout/LoadingCard'

const HERO_IMG = {
  url: 'https://images.unsplash.com/photo-1439396874305-9a6ba25de6c6?auto=format&fit=crop&w=1400&q=80',
  copyrightText: 'Lili Popper on Unsplash',
  linkCopyright: 'https://unsplash.com/photos/gray-and-white-pathway-between-green-plants-on-vast-valley-lu15z1m_KfM',
}

export default function HomePage() {
  const { t, lang } = useTranslation()
  const { user, openGuestModal } = useGuestUser()
  const [stories, setStories] = useState([])
  const [matches, setMatches] = useState(null) // guest matches, loaded once when human
  // v0.32.1 — 'loading' | 'ready' | 'error': an unreadable list must NOT look like
  // "no matches", or a network hiccup would let the player start a second match.
  const [matchesStatus, setMatchesStatus] = useState('loading')
  const [pendingStoryUuid, setPendingStoryUuid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedStory, setSelectedStory] = useState(null)
  // The single in-flight `GET /api/matches`. A click during the load awaits THIS
  // promise instead of firing its own request.
  const matchesPromise = useRef(null)
  const [matchesAttempt, setMatchesAttempt] = useState(0)
  // Antibot gate (session-cached): the catalog stays hidden until Turnstile
  // passes. No site key — or a still-valid recent pass cookie — skips the widget
  // entirely so we don't re-verify on every visit. Shared with start-match via
  // the useAntibot hook.
  const gate = useAntibot({ cookie: true })

  // Stories are fetched only once the visitor is cleared as human — a bot never
  // reaches the API.
  useEffect(() => {
    if (gate.phase !== 'ready') return undefined
    let cancelled = false
    getStories(lang).then(data => {
      if (cancelled) return
      setStories(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [gate.phase, lang])

  // Load the guest's matches once cleared, so the catalog can badge stories and
  // a story click can reuse the list (no extra fetch, and it is handed to the
  // guest modal instead of being re-fetched there). The promise is kept in a ref:
  // a click that lands before it resolves waits for it rather than starting a
  // second request — the window in which a duplicate match could be created.
  useEffect(() => {
    if (gate.phase !== 'ready') return undefined
    let cancelled = false
    setMatchesStatus('loading')
    const promise = listMatches(user?.accessToken).then(list => (Array.isArray(list) ? list : []))
    matchesPromise.current = promise
    promise
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
  }, [gate.phase, user?.accessToken, matchesAttempt])

  const retryMatches = useCallback(() => setMatchesAttempt(n => n + 1), [])

  async function handleStoryClick(story) {
    if (pendingStoryUuid) return
    let list = matches
    if (!Array.isArray(list)) {
      setPendingStoryUuid(story.uuid)
      try {
        list = await matchesPromise.current
      } catch {
        // Fail closed: without the list we cannot tell whether a match already
        // exists, and starting one anyway is exactly the duplicate we are
        // preventing. The banner offers a retry.
        setMatchesStatus('error')
        setPendingStoryUuid(null)
        return
      }
      setPendingStoryUuid(null)
    }
    if (storyHasBlockingMatch(list, story.uuid)) {
      openGuestModal(list)
    } else {
      setSelectedStory(story)
    }
  }

  return (
    <>
      {/* Hero Netflix-style */}
      <section className="hero-section" style={{ backgroundImage: `url(${HERO_IMG.url})` }}>
        <div className="hero-overlay">
          <h1 className="hero-title">{t('home.heroTitle')}</h1>
          <p className="hero-sub">{t('home.heroSub')}</p>
        </div>
      </section>

      {/* Catalog — gated by the Turnstile antibot check */}
      {gate.phase === 'error' ? (
        <div className="stories-section-center stories-loading">
          <i className="fas fa-exclamation-triangle me-2" />{t('antibot.error')}
          <br />
          <div className="mt-5">
            <button className="btn-start-game" onClick={gate.retry}>
              <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
            </button>
          </div>
        </div>
      ) : gate.phase === 'checking' ? (
        <div className="stories-section-center stories-loading">
          <div className="turnstile-checking"> <i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}</div>

          <div className="mt-5">
            <TurnstileWidget
              key={gate.attempt}
              appearance={TURNSTILE_APPEARANCE.home}
              onSuccess={gate.onSuccess}
              onError={gate.onError}
              onExpire={gate.onExpire}
            />
          </div>
        </div>
      ) : loading ? (
        <LoadingCard story={null} maxWidth="500px" />
      ) : (
        <>
          {/* v0.32.1 — the match list could not be read: say so and offer a retry
              instead of letting a click start a match that may already exist. */}
          {matchesStatus === 'error' && (
            <div className="stories-section-center stories-loading">
              <i className="fas fa-exclamation-triangle me-2" />{t('home.matchesError')}
              <br />
              <div className="mt-3">
                <button className="btn-start-game" onClick={retryMatches}>
                  <i className="fas fa-sync-alt me-2" />{t('startMatch.retry')}
                </button>
              </div>
            </div>
          )}
          <StoryCatalog
            stories={stories}
            matches={matches}
            pendingStoryUuid={pendingStoryUuid}
            onStoryClick={handleStoryClick}
          />
        </>
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
