import { useState } from 'react'
import { useTranslation } from '../../i18n/context'

/**
 * CardButtons — the footer action area of a Card: the (i) preview button plus
 * the contextual select / change / end-game button, or the locked "coming soon"
 * label. Rendered by Card with the relevant props + `onPreviewClick`/`name`.
 */
export default function CardButtons({
  isPage, name,
  locked, lockedReason, lockInfo, lockedIcon,
  onSelect, selected, selectLabel,
  onAction, actionLabel, actionIcon, actionOnlyIfPreview,
  onPreview, onPreviewClick, previewOpened, hidePreview,
  flagInformationCard,
  // Optional overrides for the (i) preview button. `infoLabel` replaces the
  // default `card.info` text; `infoIconClassName` replaces the default
  // `fas fa-info` icon (e.g. an alternative (i) glyph like `fas fa-info-circle`);
  // `infoLabelClassName` is appended to the label span class (default blank).
  infoLabel, infoIconClassName, infoLabelClassName = "",
}) {
  const [actionStarted, setActionStarted] = useState(false)
  const { t } = useTranslation()
    /*<div className="gc-footer"><div className="gc-actions">*/
  const divStyle=isPage ? "book-page-buttons": "gc-footer";//book-page-extra

  const previewLabel = infoLabel ?? t('card.info')
  const previewIconClassName = infoIconClassName ?? 'fas fa-info'

  function getPreviewButton(flagShowLabel = false, iconClassName = "", alone = false, buttonClassName = "mr-0") {
    return <button
        className={`gc-footer__btn ${alone ? 'gc-footer__btn--icon' : ' '} ${buttonClassName} `}
        onClick={onPreviewClick}
        aria-label={previewLabel}
        >
        <i className={`${previewIconClassName} ${iconClassName}`} />
        {flagShowLabel && <span className={`gc-footer__btn-label font-size-medium ${infoLabelClassName}`}>{previewLabel}</span>}
        {!flagShowLabel && !alone && <span className="gc-footer__btn-label">&nbsp;</span>}
    </button>
  }

  if (locked) {
    //console.log("locked",locked,lockedReason,lockInfo);
    return (<div className={divStyle}><div className="gc-actions">
      {onPreview && !hidePreview && getPreviewButton(false, "mr-1", true)}
      <span
        className="gc-footer__coming-soon"
        title={lockedReason || undefined}
        aria-label={lockedReason || undefined}
      >
        <i className={`${lockedIcon} me-1`} />{lockInfo?.className ?? lockInfo ?? name}
      </span>
    </div></div>)
  }
  if (onSelect) {
    //console.log("onSelect",onSelect,selected,selectLabel);
    return (<div className={divStyle}><div className="gc-actions">
      {onPreview && !hidePreview && getPreviewButton(false, "mr-1", true)}
      <button
        className={`gc-footer__btn${selected ? ' gc-footer__btn--selected' : ''}`}
        onClick={onSelect}
      >
        <i className={`fas ${selected ? 'fa-check' : 'fa-hand-pointer'} me-1`} />
        <span className="gc-footer__btn-label">{selectLabel}</span>
      </button>
    </div></div>)
  }
  if (onAction && actionStarted){
    return (<div className={divStyle}><div className="gc-actions">
        <span className="gc-footer__coming-soon ">
            <i className={`fas fa-spinner fa-spin me-1`} />{t('card.actionInProgress')}
        </span>
    </div></div>)
  }
  if (onAction && (!actionOnlyIfPreview || previewOpened)) {
    //console.log("onAction",onAction,actionLabel,actionIcon,actionOnlyIfPreview);
    return (<div className={divStyle}><div className="gc-actions">
      {flagInformationCard && getPreviewButton(!previewOpened, " me-1", previewOpened)}
      {(!actionOnlyIfPreview || previewOpened) && !actionStarted &&
        <button className="gc-footer__btn" onClick={async () => {
          // Show the in-progress spinner, then clear it once the action settles
          // so a card that stays mounted (e.g. GoToSleepCard while energy is
          // still <= 1) returns to its actionable state instead of spinning
          // forever. Cards that unmount on success (movement, end-game) simply
          // never run the reset — which is harmless.
          setActionStarted(true)
          // The action handler (handleSleep/handleMove/…) surfaces its own
          // errors; here we only guarantee the spinner is cleared either way.
          try { await onAction() } catch { /* handled by the action */ } finally { setActionStarted(false) }
        }}>
          <i className={`fas ${actionIcon} me-1`} />
          <span className={`gc-footer__btn-label font-size-medium ${infoLabelClassName}`}>{actionLabel}</span>
        </button>}
    </div></div>)
  }
  //console.log("flagInformationCard",flagInformationCard);
  if (flagInformationCard) {
    return (<div className={divStyle}><div className="gc-actions">
        {getPreviewButton(true, "my-1", false) }
    </div></div>)
  }
  //console.log("onPreview",onPreview);
  if (onPreview){ 
    return (<div className={divStyle}><div className="gc-actions">
        {getPreviewButton(true, "my-1", true) }
    </div></div>)
  }
  return null
}
