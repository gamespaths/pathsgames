import GameCardInfoButton from './GameCardInfoButton'

/**
 * GameCard — unified card component.
 *
 * variant="little"  → compact grid card (1:1.4 ratio, flex:1)
 * variant="medium"  → medium card
 * variant="big"     → tall portrait card (2:3 ratio)
 *
 * Primary data prop:
 *   card  → full card object { urlImage, alternativeImage, awesomeIcon,
 *             title, description, copyrightText, linkCopyright,
 *             styleMain, styleDetail,
 *             styleImageLittle, styleImageMedium, styleImageLarge, ... }
 *
 * credits  → array [{ label, urlImage, icon, name, linkCopyright, disabled }]
 *            When provided, an (i) button is rendered that opens a credits modal.
 *
 * Overrides (optional, fall back to card.*):
 *   urlImage, imageAlt, icon, name, description, linkCopyright, styleDetail
 */
export default function GameCard({
  /* variant */
  variant = 'little',

  /* primary data */
  card,
  story = null,   // optional story object for credits (story.card.urlImage, story.author)

  /* overrides / standalone props */
  label,
  urlImage: urlImageProp,
  imageAlt = '',
  icon: iconProp,
  name: nameProp,
  value = '',
  description: descProp,
  linkCopyright: linkProp,
  //styleDetail = '',

  /* credits modal */
  hideCredits = false,

  /* state */
  disabled,
  selected,
  locked,
  showLinkCopyright = false,

  /* actions */
  onSelect,
  selectLabel = 'Select',
  onAction,
  actionLabel = 'Change',
  actionIcon = 'fa-sync-alt',
  onPreview,

  /* preview mode (rendered inside CardPreviewOverlay) */
  previewLayout = false,

  /* extra overlay content */
  children,
}) {
  /* ── resolve card fields ── */
  const urlImage      = urlImageProp ?? card?.urlImage ?? card?.alternativeImage ?? null
  const icon          = iconProp     ?? card?.awesomeIcon ?? 'fas fa-question'
  const name          = nameProp     ?? card?.title     ?? card?.name ?? '—'
  const description   = descProp     ?? card?.description ?? null
  const linkCopyright = linkProp     ?? card?.linkCopyright ?? null

  const isDisabled = disabled || locked
  const isBig      = variant === 'big'
  const isMedium   = variant === 'medium'

  const styleDetail = card?.styleDetail ?? '';
  const sizedImageStyle = isBig
    ? (card?.styleImageLarge ?? '')
    : isMedium
      ? (card?.styleImageMedium ?? '')
      : (card?.styleImageLittle ?? '');
  const imageClassName = [styleDetail, sizedImageStyle].filter(Boolean).join(' ');

  /* ── credits info button ─────────────────────────────────────────
     - previewLayout: info button at bottom-right (inside CardPreviewOverlay)
     - onPreview provided: magnifier replaces info button (top-right)
     - otherwise: standard info button slot                        */
  let infoButton = null
  if (!hideCredits) {
    if (onPreview) {
      infoButton = (
        <button
          type="button"
          className="card-magnify-btn"
          onClick={(e) => { e.stopPropagation(); onPreview() }}
          aria-label="Preview"
        >
          <i className="fas fa-search-plus" />
        </button>
      )
    } else if (previewLayout) {
      infoButton = (
        <GameCardInfoButton
          card={card}
          story={story}
          buttonClassName="card-info-btn card-preview-info"
        />
      )
    } else {
      infoButton = <GameCardInfoButton card={card} story={story} />
    }
  }
  

  /* ── action button ── */
  let actionBtn = null
  if (locked) {
    actionBtn = (
      <span className={isBig ? 'card-big__coming-soon' : 'config-coming-soon-btn'}>
        <i className="fas fa-lock me-1" />{label}
      </span>
    )
  } else if (onSelect) {
    actionBtn = isBig ? (
      <button
        className={`card-big__btn${selected ? ' card-big__btn--selected' : ''}`}
        onClick={onSelect}
      >
        {selected
          ? <><i className="fas fa-check me-1" />{selectLabel}</>
          : <><i className="fas fa-hand-pointer me-1" />{selectLabel}</>}
      </button>
    ) : (
      <button className="config-change-btn" onClick={onSelect}>
        <i className="fas fa-check me-1" />{selectLabel}
      </button>
    )
  } else if (onAction) {
    actionBtn = (
      <button className="config-change-btn" onClick={onAction}>
        <i className={`fas ${actionIcon} me-1`} />{actionLabel}
      </button>
    )
  }

  /* ── copyright view link ── */
  const viewLink = linkCopyright && showLinkCopyright && !isDisabled && (
    <a
      href={linkCopyright}
      target="_blank"
      rel="noopener noreferrer"
      className="credits-view-btn tex t-center"
      onClick={e => e.stopPropagation()}
    >
      <i className={`fas fa-external-link-alt${isBig ? '' : ' me-1'}`} />
      {!isBig && 'View original'}
    </a>
  )

  /* ══════════════ BIG ══════════════ */
  if (isBig) {

    return (
      <div className={['pg-card card-big', isDisabled ? 'config-card-disabled' : '', selected ? 'config-card-selected' : ''].filter(Boolean).join(' ')}>
        {urlImage ? (
          <img src={urlImage} alt={imageAlt || name} className={['card-big__img', imageClassName].filter(Boolean).join(' ')} />
        ) : (
          <div className="card-big__placeholder"><i className={icon} /></div>
        )}
        {label && <div className="pg-card__badge">{label}</div>}
        {infoButton}
        {children}
        <div className="card-big__footer">
          <div className="card-big__name">{name}</div>
          {description && <div className="card-big__desc">{description}</div>}
          <div className="card-big__actions">
            {viewLink}
            {actionBtn}
          </div>
        </div>
      </div>
    )
  }
  /* ══════════════ LITTLE — with image ══════════════ */
  if (urlImage) {
    return (
      <div className={['pg-card pg-card--grid config-card-cover', isDisabled ? 'config-card-disabled' : '', selected ? 'config-card-selected' : ''].filter(Boolean).join(' ')}>
        <img src={urlImage} alt={imageAlt || name} className={['config-cover-img', imageClassName].filter(Boolean).join(' ')} />
        
        {label && <div className="config-cover-badge">{label}</div>}
        
        {infoButton}
        {children}
        <div className="config-cover-footer">
          <div className="config-cover-name">{name}</div>
          {viewLink}
          {actionBtn}
        </div>
      </div>
    )
  }

  /* ══════════════ LITTLE — no image ══════════════ */
  return (
    <div className={['pg-card pg-card--grid config-card', isDisabled ? 'config-card-disabled' : '', selected ? 'config-card-selected' : ''].filter(Boolean).join(' ')}>
      {label && <div className="config-card-label">{label}</div>}
      <div className="config-card-icon"><i className={icon} /></div>
      <div className="config-card-value">{name}</div>
      {infoButton}
      {children}
      {actionBtn}
    </div>
  )
}
