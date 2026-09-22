import { useTranslation } from '../../i18n/context'
import ConfigView from './ConfigView'
import OptionPicker from './OptionPicker'
import Card from '../../components/layout/Card'
import { selectedEntityForType } from './startBookOptions'

/**
 * StartBookMobile — mobile (≤767px) variant of the start book.
 *
 * Reuses the desktop right-page flow components (ConfigView, with OptionPicker
 * for changing a card) so the loadout cards render as a responsive 2-column
 * grid. The story header card sits on top; "Start Game" hands off to the
 * start-match page (the antibot check and terms gate live there now). The close
 * button is provided by the surrounding Book overlay.
 */
export default function StartBookMobile({
  activeStory,
  config,
  loadingDetail,
  selectionType,
  detailType,
  onChangeClick,
  onInfoClick,
  onPreview,
  onProceed,
  onSelect,
  onBackSelection,
  getOptionsForType,
}) {
  const { t } = useTranslation()

  const detailEntity = detailType ? selectedEntityForType(detailType, config) : null

  return (
    <div className="book-mobile-layout">
      {detailType ? (
        // The detail of a single-option card takes the whole column; "back" returns to the config.
        <div className="book-mobile-hero-card">
          <Card variant="page" card={detailEntity?.card} entity={detailEntity} entityType={detailType}
            story={activeStory} onClose={onBackSelection} />
        </div>
      ) : selectionType ? (
        <>
        {/* The picker no longer draws a back arrow (the desktop left page carries it), and
            the mobile column has no left page: it draws its own. */}
        <button className="book-mobile-back" onClick={onBackSelection} aria-label={t('book.back')}>
          <i className="fas fa-arrow-left" />
        </button>
        <OptionPicker
          type={selectionType}
          options={getOptionsForType(selectionType)}
          selected={selectionType === 'trait' ? config.traits : config[selectionType]}
          story={activeStory}
          config={config}
          onSelect={onSelect}
          onBack={onBackSelection}
          onPreview={onPreview}
        />
        </>
      ) : (
        <>
          <div className="book-mobile-hero-card">
            <Card variant="page" card={activeStory.card} loading={loadingDetail} story={activeStory} />
          </div>

          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--color-ash)' }}>
              <i className="fas fa-spinner fa-spin fa-2x" />
            </div>
          ) : (
            <>
              <ConfigView
                config={config}
                story={activeStory}
                onChangeClick={onChangeClick}
                onInfoClick={onInfoClick}
                onPreview={onPreview}
                onProceed={onProceed}
              />
              {/* "Start" now sits on the second bonuses card of ConfigView; kept here, hidden.
              <div className="gc-actions text-center display-flex justify-content-center">
                <button className="btn-start-game" onClick={onProceed}>
                  <i className="fas fa-play me-1" />
                  <span className="gc-footer__btn-label">{t('book.startGame')}</span>
                </button>
              </div>
              */}
            </>
          )}
        </>
      )}
    </div>
  )
}
