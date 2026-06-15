import { useTranslation } from '../../i18n/context'
import BookPageContent from '../../components/book/BookPageContent'
import PlayerStats from './PlayerStats'
import ActionRow from './ActionRow'
import ClockWidget from './ClockWidget'
import SleepButton from './SleepButton'

export default function GameBookMobile({ gameData, story, onEndGame, endError, clock, matchUuid, accessToken, onSlept }) {
  const { t } = useTranslation()

  const { startLocation, playerStats, locations, actions } = gameData ?? {}
  const storyCard = story?.card ?? null

  return (
    <div className="book-mobile-layout">
      {/* Current location card (or story big card when no locations) */}
      {Array.isArray(locations) && locations.length > 0 ? (
        <div className="book-mobile-story-card">
          {startLocation?.urlImage && (
            <img src={startLocation.urlImage} alt={startLocation.name} className="book-mobile-story-img" />
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
      ) : storyCard && (
        <div className="book-mobile-story-card">
          {storyCard.urlImage && (
            <img src={storyCard.urlImage} alt={story?.title ?? ''} className="book-mobile-story-img" />
          )}
          <div className="book-mobile-story-body">
            <h3 className="story-card-full-title" style={{ fontSize: '0.95rem', marginBottom: 4 }}>
              {story?.title ?? storyCard.title}
            </h3>
            <p className="story-card-full-desc" style={{ fontSize: '0.8rem' }}>
              {story?.description ?? storyCard.description}
            </p>
          </div>
        </div>
      )}

      {/* Clock cycle */}
      {clock && (
        <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
          <ClockWidget clock={clock} />
        </div>
      )}

      {/* Player stats */}
      <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
        <div className="game-section-label" style={{ marginTop: 0 }}>
          <i className="fas fa-user me-2" />{t('game.explore')}
        </div>
        <PlayerStats stats={playerStats} />
        {matchUuid && (
          <div className="sleep-action-row">
            <SleepButton
              matchUuid={matchUuid}
              accessToken={accessToken}
              disabled={clock?.anyCharacterSleeping ?? false}
              onSlept={onSlept}
            />
          </div>
        )}
      </div>

      {/* Neighbors */}
      {Array.isArray(locations) && locations.length > 0 && (
        <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
          <ActionRow type="location" options={locations} />
        </div>
      )}

      {/* Actions */}
      <div style={{ background: 'var(--card-body-background)', border: '2px solid var(--color-brown-mid)', borderRadius: 8, padding: 12 }}>
        <ActionRow type="action" options={actions ?? []} onEndGame={onEndGame} />
        {endError && (
          <p className="game-error  end-game-error">
            <i className="fas fa-exclamation-triangle me-2" />{endError}
          </p>
        )}
      </div>
    </div>
  )
}
