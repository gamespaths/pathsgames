import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n/context'
import { getStories } from '../api/stories'
import StoryCatalog from '../features/home/StoryCatalog'
import StartBookModal from '../features/startBook/StartBookModal'
import CopyrightModal from '../components/modals/CopyrightModal'
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

export default function HomePage() {
  const { t } = useTranslation()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStory, setSelectedStory] = useState(null)

  useEffect(() => {
    getStories().then(data => {
      setStories(data)
      setLoading(false)
    })
  }, [])

  return (
    <>
      {/* Hero Netflix-style */}
      <section className="hero-section" style={{ backgroundImage: `url(${HERO_IMG.url})` }}>
        <div className="hero-overlay">
          <h1 className="hero-title">{t('home.heroTitle')}</h1>
          <p className="hero-sub">{t('home.heroSub')}</p>
        </div>
        <button
          className="card-info-btn hero-info-btn"
          data-bs-toggle="modal"
          data-bs-target="#heroCopyrightModal"
          title="Photo credit"
        >
          <i className="fas fa-info-circle" />
        </button>
      </section>

      {/* Catalog */}
      {loading ? (
        <div className="stories-section" style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
          <i className="fas fa-spinner fa-spin me-2" />{t('home.loading')}
        </div>
      ) : (
        <StoryCatalog stories={stories} onStoryClick={setSelectedStory} />
      )}

      {/* Book modal */}
      {selectedStory && (
        <StartBookModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}

      <CopyrightModal cardInfo={HERO_IMG} modalId="heroCopyrightModal" />
    </>
  )
}
