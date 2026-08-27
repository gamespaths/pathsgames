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
  onAction, actionLabel, actionIcon, actionOnlyIfPreview, actionLabelChildren=null,
  onPreview, onPreviewClick, previewOpened, hidePreview,
  // Secondary footer buttons, rendered after the main action one, in order:
  // [{ label, icon, onAction }]. The main action keeps its own props above.
  actionsList=[],actionListClass=null,
  flagInformationCard,
  // Optional overrides for the (i) preview button. `infoLabel` replaces the
  // default `card.info` text; `infoIconClassName` replaces the default
  // `fas fa-info` icon (e.g. an alternative (i) glyph like `fas fa-info-circle`);
  // `infoLabelClassName` is appended to the label span class (default blank).
  infoLabel, infoIconClassName, infoLabelClassName = "",
}) {
  const [actionStarted, setActionStarted] = useState(false)
  const { t } = useTranslation()
  // An entry without a handler has no button to click: drop it rather than render a dead one.
  const secondaryActions = (Array.isArray(actionsList) ? actionsList : []).filter(a => a?.onAction)
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
  // The secondary buttons, in one place: the branch with a main action shows them under it,
  // and the locked / information faces show them beside the (i) — which is how an item row
  // gets its bin while the bag is over its capacity.
  function secondaryButtons() {
    return secondaryActions.map((a, i) =>
      <button key={i} className="gc-footer__btn" aria-label={a.ariaLabel ?? a.label ?? undefined}
        onClick={async () => {
          setActionStarted(true)
          try { await a.onAction() } catch { /* handled by the action */ } finally { setActionStarted(false) }
        }}>
        <i className={`fas ${a.icon} me-1`} />
        <span className={`gc-footer__btn-label font-size-medium ${infoLabelClassName}`}>{a.label}</span>
      </button>)
  }

  const gcActionClass= "gc-actions " + (actionListClass ?? (actionsList.length===0 ? null:
    (actionsList.length+2) % 3 ==0 ? "display-grid3" : "display-grid2"))

  if (locked) {
    //console.log("locked",locked,lockedReason,lockInfo);
    return (<div className={divStyle}><div className={gcActionClass}>
      {onPreview && !hidePreview && getPreviewButton(false, "mr-1", true)}
      <span
        className="gc-footer__coming-soon"
        title={lockedReason || undefined}
        aria-label={lockedReason || undefined}
      >
        <i className={`${lockedIcon} me-1`} />{lockInfo?.className ?? lockInfo ?? name}
        {actionLabelChildren} 
      </span>
      {!actionStarted && secondaryButtons()}
    </div></div>)
  }
  if (onSelect) {
    //console.log("onSelect",onSelect,selected,selectLabel);
    return (<div className={divStyle}><div className={gcActionClass}>
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
    return (<div className={divStyle}><div className={gcActionClass}>
        <span className="gc-footer__coming-soon ">
            <i className={`fas fa-spinner fa-spin me-1`} />{t('card.actionInProgress')}
        </span>
    </div></div>)
  }
  if (onAction && (!actionOnlyIfPreview || previewOpened)) {
    //console.log("onAction",onAction,actionLabel,actionIcon,actionOnlyIfPreview);
    return (<div className={divStyle}><div className={gcActionClass}>
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
          {actionLabelChildren}
        </button>}
      {!actionStarted && secondaryButtons()}
    </div></div>)
  }
  //console.log("flagInformationCard",flagInformationCard);
  if (flagInformationCard) {
    return (<div className={divStyle}><div className={gcActionClass}>
        {getPreviewButton(true, "my-1", false) }
        {!actionStarted && secondaryButtons()}
    </div></div>)
  }
  //console.log("onPreview",onPreview);
  if (onPreview && !hidePreview) { 
    return (<div className={divStyle}><div className={gcActionClass}>
        {getPreviewButton(true, "my-1", true) }
    </div></div>)
  }
  return null
}
