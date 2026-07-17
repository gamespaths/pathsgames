import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n/context'
import { getStories } from '../api/stories'
import { listMatches } from '../api/matches'
import { useGuestUser } from '@/features/guest-user/GuestUserContext'
import StoryCatalog from '../features/catalog/StoryCatalog'
import StartBookModal from '../features/start-book/StartBookModal'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { TURNSTILE_APPEARANCE } from '../utils/turnstile'
import useAntibot from '../hooks/useAntibot'
import { storyHasActiveMatch } from '../utils/matchStatus'
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
  const [loading, setLoading] = useState(true)
  const [selectedStory, setSelectedStory] = useState(null)
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
  // guest modal instead of being re-fetched there).
  useEffect(() => {
    if (gate.phase !== 'ready') return undefined
    let cancelled = false
    listMatches(user?.accessToken)
      .then(list => { if (!cancelled) setMatches(Array.isArray(list) ? list : []) })
      .catch(() => { if (!cancelled) setMatches([]) })
    return () => { cancelled = true }
  }, [gate.phase, user?.accessToken])

  async function handleStoryClick(story) {
    let list = matches
    if (!Array.isArray(list)) {
      try { list = await listMatches(user?.accessToken) } catch { list = null }
    }
    if (storyHasActiveMatch(list, story.uuid)) {
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
        <StoryCatalog stories={stories} matches={matches} onStoryClick={handleStoryClick} />
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
