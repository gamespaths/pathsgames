import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n/context'
import { getStories } from '../api/stories'
import { listMatches } from '../api/matches'
import { useGuestUser } from '../context/GuestUserContext'
import StoryCatalog from '../features/home/StoryCatalog'
import StartBookModal from '../features/startBook/StartBookModal'
import TurnstileWidget from '../components/common/TurnstileWidget'
import AntibotMessage from '../components/common/AntibotMessage'
import { CF_KEY, TURNSTILE_APPEARANCE, isTurnstilePassValid, recordTurnstilePass } from '../utils/turnstile'
//  url: 'https://images.unsplash.com/photo-1505816014357-96b5ff457e9a?auto=format&fit=crop&w=1400&q=80',
/*
  url: 'https://images.unsplash.com/photo-1726576165400-b85a4f99a635?auto=format&fit=crop&w=1400&q=80',
  copyrightText: 'Alexander Lunyov on Unsplash',
  linkCopyright: 'https://unsplash.com/photos/a-dirt-road-in-the-middle-of-a-forest-wUx6AuTMy-I',
*/
const HERO_IMG = {
  url: 'https://images.unsplash.com/photo-1439396874305-9a6ba25de6c6?auto=format&fit=crop&w=1400&q=80',
  copyrightText: 'Lili Popper on Unsplash',
  linkCopyright: 'https://unsplash.com/photos/gray-and-white-pathway-between-green-plants-on-vast-valley-lu15z1m_KfM',
}

const ACTIVE_STATUSES = new Set(['CREATED', 'RUNNING'])

export default function HomePage() {
  const { t } = useTranslation()
  const { user, openGuestModal } = useGuestUser()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStory, setSelectedStory] = useState(null)
  // Antibot gate: 'checking' until Turnstile passes, then 'human'; 'bot' on
  // failure. With no site key — or a still-valid recent pass cookie — the gate
  // is skipped entirely so we don't re-verify on every visit.
  const [gate, setGate] = useState(!CF_KEY || isTurnstilePassValid() ? 'human' : 'checking')

  // Stories are fetched only once the visitor is cleared as human — a bot never
  // reaches the API.
  useEffect(() => {
    if (gate !== 'human') return undefined
    let cancelled = false
    getStories().then(data => {
      if (cancelled) return
      setStories(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [gate])

  async function handleStoryClick(story) {
    try {
      const matches = await listMatches(user?.accessToken)
      const hasActive = Array.isArray(matches) && matches.some(
        m => m.storyUuid === story.uuid && ACTIVE_STATUSES.has(m.status)
      )
      if (hasActive) {
        openGuestModal()
      } else {
        setSelectedStory(story)
      }
    } catch {
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
      {gate === 'bot' ? (
        <div className="stories-section">
          <AntibotMessage />
        </div>
      ) : gate === 'checking' ? (
        <div className="stories-section stories-loading">
          <i className="fas fa-spinner fa-spin me-2" />{t('antibot.verifying')}
          <TurnstileWidget
            appearance={TURNSTILE_APPEARANCE.home}
            onSuccess={() => { recordTurnstilePass(); setGate('human') }}
            onError={() => setGate('bot')}
            onExpire={() => setGate('bot')}
          />
        </div>
      ) : loading ? (
        <div className="stories-section stories-loading">
          <i className="fas fa-spinner fa-spin me-2" />{t('home.loading')}
        </div>
      ) : (
        <StoryCatalog stories={stories} onStoryClick={handleStoryClick} />
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
