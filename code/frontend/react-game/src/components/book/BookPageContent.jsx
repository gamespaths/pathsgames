import BonusBadgeList from '../ui/BonusBadgeList'
import { useTranslation } from '../../i18n/context'
import { getNonZeroStats, STAT_CATEGORY_ORDER } from '../../utils/bonusStats'
import { sanitizeHtml } from '../../utils/sanitizeHtml'
import GameCardCreditsBar from '../layout/GameCardCreditsBar'
import { isValidElement } from 'react'

/**
 * BookPageContent — content of the book page.
 * Renders as a card (border + shadow): golden title bar, full-width image,
 * description on parchment background, credits (i) button bottom-left.
 *
 * When `entity` + `entityType` are passed, renders a bonus-stats badges row
 * absolute-positioned above the image, top-right. Zero/missing values are hidden.
 */
export default function BookPageContent({ 
    card, story, loading, onClose, entity, entityType , extraContent=null, extraContentClassName=null,
    lockedReason , statItemsToPageContent=null, descriptionTag=false}  ) {
  const { t } = useTranslation()

  const statItemsReal = statItemsToPageContent ?? getNonZeroStats(entity, entityType).map(s => ({
    key: s.key,
    label: STAT_CATEGORY_ORDER.includes(s.key)
      ? t(`book.stats.totals.${s.key}`)
      : t(`book.stats.${s.key}`),
    value: s.value,
  }))
  //console.log("BookPageContent",card, statItemsReal , statItemsToPageContent);

  const title = card?.title ?? entity?.name ?? card?.name ?? null
  const description = card?.description ?? entity?.description ?? null

  return (
    <div className="book-page-content">
      {loading && (
        <div className="book-page-loading">
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      )}

      <h2 className="book-page-title">
        {onClose && <button className="float-left" onClick={onClose} aria-label="Close preview">
          <i className="fas fa-arrow-left me-1" />{ /*t('book.back')*/ }
        </button>}
        {isValidElement(title)
          ? title
          : <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(title)) }} />}
      </h2>

        {card?.urlImage && (
          <img src={card.urlImage} alt={title} className={"book-page-img " + (card?.styleImageLarge ?? '')} />
        )}
      
      {(description || statItemsReal) && (
        <div className="book-page-desc">
          <BonusBadgeList items={statItemsReal} className="book-page-stats" lockedReason={lockedReason} />
          {isValidElement(description)
            ? description                                    // arriva come JSX/tag → renderizzo diretto
            : <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(description)) }} />}
        </div>
      )}
      { /*console.log("extraContent",extraContent) */}
      {extraContent && <div className={`book-page-extra ${extraContentClassName ?? ''}`}>{extraContent}</div>}

      {card?.linkCopyright && (
        <GameCardCreditsBar card={card} story={story} />
      )}
    </div>
  )
}
