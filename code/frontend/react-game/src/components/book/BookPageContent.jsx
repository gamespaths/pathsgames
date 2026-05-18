import GameCardInfoButton from '../layout/GameCardInfoButton'
import BonusBadgeList from '../common/BonusBadgeList'
import { useTranslation } from '../../i18n/context'
import { getNonZeroStats, STAT_CATEGORY_ORDER } from '../../utils/bonusStats'
import GameCardCreditsBar from '../layout/GameCardCreditsBar'

/**
 * BookPageContent — content of the book page.
 * Renders as a card (border + shadow): golden title bar, full-width image,
 * description on parchment background, credits (i) button bottom-left.
 *
 * When `entity` + `entityType` are passed, renders a bonus-stats badges row
 * absolute-positioned above the image, top-right. Zero/missing values are hidden.
 */
export default function BookPageContent({ card, story, loading, onClose, entity, entityType }) {
  const { t } = useTranslation()

  const statItems = getNonZeroStats(entity, entityType).map(s => ({
    key: s.key,
    label: STAT_CATEGORY_ORDER.includes(s.key)
      ? t(`book.stats.totals.${s.key}`)
      : t(`book.stats.${s.key}`),
    value: s.value,
  }))

  const title = card?.title ?? entity?.name ?? null
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
        {title}
      </h2>

        {card?.urlImage && (
          <img src={card.urlImage} alt={title} className={"book-page-img " + (card?.styleImageLarge ?? '')} />
        )}
      
      {description && (
        <div className="book-page-desc">
          <BonusBadgeList items={statItems} className="book-page-stats" />
          <span dangerouslySetInnerHTML={{ __html: description }} />
        </div>
      )}
        {card?.linkCopyright && (
          <GameCardCreditsBar card={card} story={story} />
        )}
    </div>
  )
}
