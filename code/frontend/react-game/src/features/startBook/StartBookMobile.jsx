import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'
import ConfigView from './ConfigView'
import StartGameView from './StartGameView'
import SelectionView from './SelectionView'
import BookPageContent from '../../components/book/BookPageContent'

/**
 * StartBookMobile — mobile (≤767px) variant of the start book.
 *
 * Reuses the very same flow components as the desktop right page
 * (ConfigView → StartGameView, with SelectionView for changing a card) so the
 * loadout cards render as GameCards in a responsive 2-column grid. The only
 * mobile-specific chrome is the story header card on top; the close button is
 * provided by the surrounding Book overlay.
 */
export default function StartBookMobile({
  activeStory,
  config,
  loadingDetail,
  selectionType,
  confirming,
  termsAccepted,
  setTermsAccepted,
  onChangeClick,
  onPreview,
  onProceed,
  onBackConfirm,
  onSelect,
  onBackSelection,
  getOptionsForType,
  onStartGame,
}) {
  const { t } = useTranslation()
  // Full-width hero card for the story: title + image + (i) preview + the
  // primary "Start Game" CTA (which advances to the confirmation step). The
  // CTA is hidden once we are already on the confirmation step.
  const storyEntity = { name: activeStory.title, card: activeStory.card, description: activeStory.description }

  return (
    <div className="book-mobile-layout">
      {selectionType ? (
        <SelectionView
          type={selectionType}
          options={getOptionsForType(selectionType)}
          selected={config[selectionType]}
          story={activeStory}
          config={config}
          onSelect={onSelect}
          onBack={onBackSelection}
          onPreview={onPreview}
        />
      ) : (
        <>
          <div className="book-mobile-hero-card">
            <BookPageContent card={activeStory.card} loading={loadingDetail} story={activeStory} />
            {/*}
            <GameCard
              variant="medium"
              card={activeStory.card}
              name={activeStory.title}
              imageAlt={activeStory.title}
              onPreview={() => onPreview(storyEntity, 'story')}
              onSelect={confirming ? undefined : onProceed}
              selectLabel={t('book.startGame')} 
            /> */}
          </div>

          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--color-ash)' }}>
              <i className="fas fa-spinner fa-spin fa-2x" />
            </div>
          ) : confirming ? (
            <StartGameView
              config={config}
              story={activeStory}
              termsAccepted={termsAccepted}
              onTermsChange={setTermsAccepted}
              onPreview={onPreview}
              onStartGame={onStartGame}
              onBack={onBackConfirm}
            />
          ) : (
            <>
            <ConfigView
              config={config}
              story={activeStory}
              onChangeClick={onChangeClick}
              onPreview={onPreview}
              onProceed={onProceed}
            />
            <div className="gc-actions text-center display-flex justify-content-center">
              <button className={`btn-start-game`} onClick={onProceed}>
                <i className={`fas fa-play me-1`} />
                <span className="gc-footer__btn-label">{t('book.startGame')}</span>
              </button>
            </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
