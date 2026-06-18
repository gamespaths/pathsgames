import CardCreditsBar from './CardCreditsBar'
import { useTranslation } from '../../i18n/context'
import BonusBadgeList from '../ui/BonusBadgeList'
import CardImage from './CardImage'
import SafeHtml from '../ui/SafeHtml'
import { getNonZeroStats, STAT_CATEGORY_ORDER } from '../../utils/bonusStats'
import { useState } from 'react'

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
  actionOnlyIfPreview = false, actionWithInfo=false,
  onPreview, hidePreview = false,

  /* extra overlay content */
  childrenIntoImage,
  children,

  statistics, flagShowFullStatistics=false,
  flagInformationCard,

  /* page variant (variant="page" — the book reading page) */
  loading, onClose, entity, entityType,
  extraContent=null, extraContentClassName=null, statItemsToPageContent=null, descriptionTag=false,
}) {
  //if (lockInfo) { console.log(card.title,"lockInfo",lockInfo);} 
  const { t } = useTranslation()
  const [previewOpened, setPreviewOpened] = useState(false);

  function onPreviewClick(e) {
    e.stopPropagation();
    if (onPreview) {
      setPreviewOpened(true);
      onPreview();
    }
  }

  /* ── variant="page" — the book reading page (parchment description, no footer) ── */
  if (variant === 'page') {
    const statItemsReal = statItemsToPageContent ?? getNonZeroStats(entity, entityType).map(s => ({
      key: s.key,
      label: STAT_CATEGORY_ORDER.includes(s.key)
        ? t(`book.stats.totals.${s.key}`)
        : t(`book.stats.${s.key}`),
      value: s.value,
    }))
    const pageTitle = card?.title ?? entity?.name ?? card?.name ?? null
    const pageDesc  = card?.description ?? entity?.description ?? null

    return (
      <div className="book-page-content">
        {loading && (
          <div className="book-page-loading">
            <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
          </div>
        )}

        <h2 className="book-page-title">
          {onClose && <button className="float-left" onClick={onClose} aria-label="Close preview">
            <i className="fas fa-arrow-left me-1" />
          </button>}
          <SafeHtml value={pageTitle} />
        </h2>

        {card?.urlImage && (
          <CardImage
            src={card.urlImage}
            alt={typeof pageTitle === 'string' ? pageTitle : ''}
            imgClassName={'book-page-img ' + (card?.styleImageLarge ?? '')}
            renderPlaceholder={false}
          />
        )}

        {(pageDesc || statItemsReal) && (
          <div className="book-page-desc">
            <BonusBadgeList items={statItemsReal} className="book-page-stats" lockedReason={lockedReason} />
            <SafeHtml value={pageDesc} />
          </div>
        )}

        {extraContent && <div className={`book-page-extra ${extraContentClassName ?? ''}`}>{extraContent}</div>}

        {card?.linkCopyright && (
          <CardCreditsBar card={card} story={story} />
        )}
      </div>
    )
  }

  const urlImage      = urlImageProp ?? card?.urlImage ?? card?.alternativeImage ?? null
  const icon          = iconProp      ?? card?.awesomeIcon ?? 'fas fa-question'
  const name          = nameProp      ?? card?.title     ?? card?.name ?? '—'
  const linkCopyright = linkProp     ?? card?.linkCopyright ?? null
  const realLabel      = label         ?? card?.label     ?? card?.title  ?? null

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

  /* ── magnifier button in title bar (onPreview only) ── */
  /* NOT REMOVE const titleMagnifier = !hideCredits && onPreview ? (
    <button
      type="button"
      className="gc-title__btn"
      onClick={(e) => { e.stopPropagation(); onPreview() }}
      aria-label="Preview"
    >
      <i className="fas fa-search-plus" />
    </button>
  ) : null */

  /* ── action button ── */
  function getPreviewButton( flagShowLabel = false , iconClassName = "" , alone=false, buttonClassName = "mr-0" ,  ) {
    return <button
          className={`gc-footer__btn ${alone ? 'gc-footer__btn--icon' : ' '} ${buttonClassName} `}
          onClick={onPreviewClick}
          aria-label={t('card.info')}
        >
          <i className={`fas fa-info ${iconClassName}`} />
          {flagShowLabel && <span className="gc-footer__btn-label">{t('card.info')}</span>}
          {!flagShowLabel && !alone && <span className="gc-footer__btn-label">&nbsp;</span>}
        </button>
  }

  let actionBtn = null

  if (locked) {
    actionBtn = ( <>
      {onPreview && !hidePreview && getPreviewButton(false,"mr-1",true)}
      <span
        className="gc-footer__coming-soon"
        title={lockedReason || undefined}
        aria-label={lockedReason || undefined}
      >
        <i className={`${lockedIcon} me-1`} />{lockInfo?.className ?? lockInfo ?? label ?? name}
      </span>
    </>)
  } else if (onSelect) {
    actionBtn = (<>
      {onPreview && !hidePreview && getPreviewButton(false,"mr-1",true)}
      <button
        className={`gc-footer__btn${selected ? ' gc-footer__btn--selected' : ''}`}
        onClick={onSelect}
      >
        <i className={`fas ${selected ? 'fa-check' : 'fa-hand-pointer'} me-1`} />
        <span className="gc-footer__btn-label">{selectLabel}</span>
      </button>
    </>)
  } else if (onAction && (!actionOnlyIfPreview || previewOpened)) {
    actionBtn = <> {
      flagInformationCard && getPreviewButton(!previewOpened, " me-1",previewOpened) }
      {(!actionOnlyIfPreview || previewOpened ) &&
      <button className="gc-footer__btn" onClick={onAction}>
        <i className={`fas ${actionIcon} me-1`} />
        <span className="gc-footer__btn-label">{actionLabel}</span>
      </button>}
      </>
  } else if (flagInformationCard){
    actionBtn=getPreviewButton(true, "my-1" , false)
  } else if (onPreview) {
    actionBtn=getPreviewButton(true, "my-1" , true)
  }

  /* ── copyright view link ── */
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


  const cardClasses = [
    'pg-card',
    isBig ? 'card-big' : isSmall ? 'pg-card--small' : 'pg-card--grid',
    //isDisabled ? 'config-card-disabled' : '',
    selected    ? 'config-card-selected' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClasses}>

      {/* ── title bar ── */}
      <div className="gc-title">
        <div className="gc-title__text">{name}</div>
        { /* titleMagnifier */}
        {!flagShowFullStatistics && statistics && statistics.length > 0 &&
          <BonusBadgeList className="mt-0 mb-0 config-total-bonus float-right" items={statistics} littleVersion={true} />
        }
      </div>

        {/* ── image or icon placeholder ── */}
        { (childrenIntoImage || (statistics!=null && statistics.length > 0) )&& (
          <div  className="gc-img-content">
            {childrenIntoImage && <div className="gc-img__overlay">
              {childrenIntoImage}
            </div>}
            {flagShowFullStatistics && statistics && statistics.length > 0 &&
              <BonusBadgeList className="gc-img__overlay config-total-bonus" items={statistics} littleVersion={false} />
            }
          </div>
        )}
        <CardImage
          src={urlImage}
          alt={imageAlt || name}
          imgClassName={['gc-img', imageClassName].filter(Boolean).join(' ')}
          placeholderIcon={icon}
        />

      {children}
      {/* ── footer: info (i) + action button ── */}
      <div className="gc-footer">
        {viewLink}
        <div className="gc-actions">
          {actionBtn}
        </div>
      </div>

      
    </div>
  )
}
