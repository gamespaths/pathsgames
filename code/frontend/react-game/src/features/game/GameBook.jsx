import { useTranslation } from '../../i18n/context'
import BookPageLeft from '../../components/book/BookPageLeft'
import BookPageRight from '../../components/book/BookPageRight'
import LocationCard from './LocationCard'
import PlayerStats from './PlayerStats'
import NeighborRow from './NeighborRow'
import ActionsRow from './ActionsRow'
import CopyrightModal from '../../components/modals/CopyrightModal'

export default function GameBook({ gameData }) {
  const { t } = useTranslation()

  const { startLocation, playerStats, locations, actions } = gameData ?? {}

  return (
    <>
      {/* ── DESKTOP/TABLET: side-by-side book ── */}
      <div className="game-book-wrapper">
        <div className="book-spine" />

        {/* Left: current location */}
        <BookPageLeft>
          <h3 className="game-page-title">
            <i className="fas fa-map-marker-alt me-2" />{t('game.currentLocation')}
          </h3>
          <LocationCard location={startLocation} />
        </BookPageLeft>

        {/* Right: player + navigate + actions */}
        <BookPageRight>
          <h3 className="game-page-title">
            <i className="fas fa-compass me-2" />{t('game.explore')}
          </h3>
          <PlayerStats stats={playerStats} />
          <NeighborRow locations={locations ?? []} />
          <ActionsRow actions={actions ?? []} />
        </BookPageRight>
      </div>

      {/* ── MOBILE: vertical stack ── */}
      <div className="book-mobile-layout">
        {/* Current location card */}
        <div className="book-mobile-story-card">
          {startLocation?.imageUrl && (
            <img src={startLocation.imageUrl} alt={startLocation.name} className="book-mobile-story-img" />
          )}
          <div className="book-mobile-story-body">
            <h3 className="story-card-full-title" style={{ fontSize: '0.95rem', marginBottom: 4 }}>
              {startLocation?.name}
            </h3>
            <p className="story-card-full-desc" style={{ fontSize: '0.8rem' }}>
              {startLocation?.description}
            </p>
          </div>
        </div>

        {/* Player stats */}
        <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
          <div className="game-section-label" style={{ marginTop: 0 }}>
            <i className="fas fa-user me-2" />{t('game.explore')}
          </div>
          <PlayerStats stats={playerStats} />
        </div>

        {/* Neighbors */}
        <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
          <NeighborRow locations={locations ?? []} />
        </div>

        {/* Actions */}
        <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
          <ActionsRow actions={actions ?? []} />
        </div>
      </div>

      {startLocation?.copyrightText && (
        <CopyrightModal
          cardInfo={startLocation}
          modalId={`loc-copyright-${startLocation.uuid}`}
        />
      )}
    </>
  )
}
