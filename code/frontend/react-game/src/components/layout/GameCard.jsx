import GameCardCreditsBar from './GameCardCreditsBar'
import { useTranslation } from '../../i18n/context'
import BonusBadgeList from '../ui/BonusBadgeList'
import { useState } from 'react'

/**
 * GameCard — unified card component.
 * Layout: golden title bar (text + magnifier), full-width image,
 * parchment footer with action button.
 *
 * variant="little"  → compact grid card (pg-card--grid)
 * variant="medium"  → medium card
 * variant="big"     → tall portrait card (2:3 ratio)
 */
export default function GameCard({
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
  singleOption = false,

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
}) {
  //if (lockInfo) { console.log(card.title,"lockInfo",lockInfo);} 
  const { t } = useTranslation()
  const [previewOpened, setPreviewOpened] = useState(false);
  function onPreviewClick(e) {
    //console.log("GameCard onPreviewClick", onPreview, "previewOpened", previewOpened);  
    e.stopPropagation();
    if (onPreview) {
      setPreviewOpened(true);
      onPreview();
    }
  }

  const urlImage      = urlImageProp ?? card?.urlImage ?? card?.alternativeImage ?? null
  const icon          = iconProp     ?? card?.awesomeIcon ?? 'fas fa-question'
  const name          = nameProp     ?? card?.title     ?? card?.name ?? '—'
  const linkCopyright = linkProp     ?? card?.linkCopyright ?? null

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
      flagInformationCard && !previewOpened && getPreviewButton(!previewOpened, " me-1",previewOpened) }
      {(!actionOnlyIfPreview || previewOpened) && 
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
      <i className="fas fa-external-link-alt me-1" />{ card.description ?? t('card.viewOriginal')}
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
        {urlImage ? (
          <img
            src={urlImage}
            alt={imageAlt || name}
            className={['gc-img', imageClassName].filter(Boolean).join(' ')}
          />
        ) : (
          <div className="gc-placeholder"><i className={icon} /></div>
        )}


      {/* ── footer: info (i) + action button ── */}
      <div className="gc-footer">
        {viewLink}
        <div className="gc-actions">
          {actionBtn}
        </div>
      </div>

      {children}
    </div>
  )
}
