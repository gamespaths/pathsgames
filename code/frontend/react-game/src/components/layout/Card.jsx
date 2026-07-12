import CardCreditsBar from './CardCreditsBar'
import { useTranslation } from '../../i18n/context'
import BonusBadgeList from '../ui/BonusBadgeList'
import CardImage from './CardImage'
import SafeHtml from '../ui/SafeHtml'
import { getNonZeroStats, STAT_CATEGORY_ORDER } from '../../utils/bonusStats'
import { useState } from 'react'
import CardButtons from './CardButtons'

/**
 * Card — unified card component (formerly GameCard + GameCardWrapper).
 * Layout: golden title bar (text + magnifier), full-width image,
 * parchment footer with action button.
 *
 * variant="little"  → compact grid card (pg-card--grid)
 * variant="medium"  → medium card
 * variant="big"     → tall portrait card (2:3 ratio)
 * variant="page"    → book reading page (parchment description, no footer)
 *
 * Card is a "dumb" display component: callers pass card/name/icon/onSelect/
 * onAction/onPreview … directly. 
 */
export default function Card({
  /* variant */
  variant = 'little',

  /* primary data */
  card,
  story = null,

  /* overrides / standalone props */
  label,
  urlImage: urlImageProp,
  imageAlt = '',
  icon: iconProp,
  name: nameProp,
//  value = '',
  linkCopyright: linkProp,

  /* state */
  disabled,
  selected,
  locked, lockedIcon='fas fa-lock ',
  lockedReason,lockInfo,
  showLinkCopyright = false,

  /* actions */
  onSelect,
  selectLabel = 'Select',
  onAction,
  actionLabel = 'Change',
  actionIcon = 'fa-sync-alt',
  actionOnlyIfPreview = false, actionLabelChildren=null,
  onPreview, hidePreview = false,
  infoLabel, infoIconClassName, infoLabelClassName,

  action2Label=null, action2Icon=null, onAction2=null,

  /* extra overlay content */
  childrenIntoImage,
  children,

  statistics, flagShowFullStatistics=false, 
  bonusBadgeListLittleTitle=true, bonusBadgeListLittleIntoImage=false, bonusBadgeListLittleDesc=false,
  flagInformationCard=false,

  /* page variant (variant="page" — the book reading page) */
  loading, onClose, onForward, entity, entityType,
  extraContent=null, extraContentClassName=null, statItemsToPageContent=null, descriptionTag=false,
}) {
  //if (lockInfo) { console.log(card.title,"lockInfo",lockInfo);} 
  const { t } = useTranslation()
  const isPage = variant === 'page'
  const [previewOpened, setPreviewOpened] = useState(false);

  function onPreviewClick(e) {
    e.stopPropagation();
    if (onPreview) {
      setPreviewOpened(true);
      onPreview();
    }
  }

  const urlImage      = urlImageProp ?? card?.urlImage ?? card?.alternativeImage ?? null
  const icon          = iconProp      ?? card?.awesomeIcon ?? 'fas fa-info'
  const name          = nameProp      ?? card?.title     ?? card?.name ?? card?.title ?? entity?.name ?? "-"
  const linkCopyright = linkProp     ?? card?.linkCopyright ?? null
  const pageDesc  = card?.description ?? entity?.description ?? null
  const isDisabled = disabled || locked
  const isBig      = variant === 'big'
  const isSmall    = variant === 'small'
  const styleDetail = card?.styleDetail ?? ''
  const sizedImageStyle = isBig
    ? (card?.styleImageLarge ?? '')
    : variant === 'medium'
      ? (card?.styleImageMedium ?? '')
      : (card?.styleImageLittle ?? '')
  const imageClassName = [styleDetail, sizedImageStyle].filter(Boolean).join(' ')
  const statItemsReal = statItemsToPageContent ?? getNonZeroStats(entity, entityType, t).map(s => ({
    key: s.key,
    label: STAT_CATEGORY_ORDER.includes(s.key)
      ? t(`book.stats.totals.${s.key}`)
      : t(`book.stats.${s.key}`) ,
    value: s.value,
  }))

  /* ── copyright view link (CreditsModal) ── */
  const viewLink = linkCopyright && showLinkCopyright && !isDisabled && (
    <a
      href={linkCopyright}
      target="_blank"
      rel="noopener noreferrer"
      className="credits-view-btn"
      onClick={e => e.stopPropagation()}
    >
      <i className="fas fa-external-link-alt me-1" />{ card?.description ?? t('card.viewOriginal')}
    </a>
  )

  /* ── entityType badge (shown on hover, non-page cards) ── */
  const typeBadgeLabel = entityType
    ? (() => { const k = `book.${entityType}`; const tr = t(k); return tr === k ? entityType : tr })()
    : null

  const cardClasses = isPage? " book-page-content " : [
    'pg-card',
    isBig ? 'card-big' : isSmall ? 'pg-card--small' : 'pg-card--grid',
    //isDisabled ? 'config-card-disabled' : '',
    selected    ? 'config-card-selected' : '',
  ].filter(Boolean).join(' ')
  
  return (
    <div className={cardClasses}>
      {isPage && loading && (
        <div className="book-page-loading">
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      )}
      { /* Title  */}
      {!isPage && <div className="gc-title">
        <div className="gc-title__text">{name}</div>
        {!flagShowFullStatistics && statistics && statistics.length > 0 &&
          <BonusBadgeList className="mt-0 mb-0 config-total-bonus float-right" items={statistics} littleVersion={bonusBadgeListLittleTitle} />
        }
        {typeBadgeLabel && <span className="gc-type-badge">{typeBadgeLabel}</span>}
      </div>}
      { isPage && <h2 className="book-page-title">
          { onClose && <button className="float-left book-page-nav book-page-nav--back" onClick={onClose} aria-label={t('card.back')}>
          <i className="fas fa-arrow-left" />
        </button>}
        <SafeHtml key={card?.uuid ?? card?.title ?? String(name ?? '')} value={name} />
        { onForward && <button className="float-right book-page-nav book-page-nav--forward" onClick={onForward} aria-label={t('card.forward')}>
          <i className="fas fa-arrow-right" />
        </button>}
      </h2>}

      {/* ── children Into Image ── */}
      { (childrenIntoImage || (statistics!=null && statistics.length > 0) )&& (
        <div  className="gc-img-content">
          {childrenIntoImage && <div className="gc-img__overlay">
            {childrenIntoImage}
          </div>}
          {flagShowFullStatistics && statistics && statistics.length > 0 &&
            <BonusBadgeList className={"gc-img__overlay config-total-bonus" + (bonusBadgeListLittleIntoImage ? " config-total-bonus-little" : "")}
              items={statistics} littleVersion={bonusBadgeListLittleIntoImage} />
          }
        </div>
      )}

      {/* ── image or icon placeholder ── */}
      <CardImage
        src={urlImage} placeholderIcon={icon} renderPlaceholder={!isPage}
        alt={imageAlt || name}
        imgClassName={
          !isPage ? ['gc-img', imageClassName].filter(Boolean).join(' ')
            : 'book-page-img ' + (card?.styleImageLarge ?? '')
        }
      />

      {children}
      
      {/* pageDesc */ }
      {isPage && (pageDesc || (statItemsReal!=null && statItemsReal.length > 0)) && (
        <div className="book-page-desc">
          <BonusBadgeList items={statItemsReal} className="book-page-stats" lockedReason={lockedReason} littleVersion={bonusBadgeListLittleDesc} />
          <SafeHtml key={card?.uuid ?? card?.title ?? String(pageDesc ?? '')} value={pageDesc} />
        </div>
      )}
      
      {/* ── footer: info (i) + action button ── */}
      { extraContent && 
        <div className={`book-page-extra ${extraContentClassName ?? ''}`}>{extraContent}</div>
      }

      <CardButtons isPage={isPage} name={name ?? label} onPreviewClick={onPreviewClick}
            locked={locked} lockedReason={lockedReason} lockInfo={lockInfo} lockedIcon={lockedIcon}
            onSelect={onSelect} selected={selected} selectLabel={selectLabel}
            onAction={onAction} actionLabel={actionLabel} actionIcon={actionIcon} actionOnlyIfPreview={actionOnlyIfPreview} actionLabelChildren={actionLabelChildren}
            onPreview={onPreview} previewOpened={previewOpened} hidePreview={hidePreview}
            flagInformationCard={flagInformationCard}
            infoLabel={infoLabel} infoIconClassName={infoIconClassName} infoLabelClassName={infoLabelClassName} 
            action2Label={action2Label} action2Icon={action2Icon} onAction2={onAction2}
          />

      {viewLink}

      {isPage && card?.linkCopyright && (
        <CardCreditsBar card={card} story={story} typeBadgeLabel={typeBadgeLabel} />
      )}
    </div>
  )
}
