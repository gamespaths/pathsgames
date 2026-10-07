import { useEffect, useRef } from 'react'
import SafeHtml from './SafeHtml'

/**
 * TipNote — Step 40: the gold-glow hint appended to a page card's description.
 * A new `focusKey` (> 0) scrolls it into view and moves the focus onto it.
 * Step 42 — also shows a card credit: own `icon`, `link` ({ href, onOpen, label }) as a trailing link icon,
 * `singleLine` cuts the text with an ellipsis while the icons stay visible.
 */
export default function TipNote({ text, hideLabel, onHide, focusKey = 0, icon = 'fa-lightbulb', link = null, singleLine = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!focusKey || !ref.current) return
    ref.current.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    ref.current.focus?.({ preventScroll: true })
  }, [focusKey])

  const openLink = e => {
    e.stopPropagation()
    if (link?.onOpen) {
      e.preventDefault()
      link.onOpen()
    }
  }

  return (
    <div className={`pg-tip${singleLine ? ' pg-tip--single' : ''}`} ref={ref} tabIndex={-1} role="note" data-testid="tip-note">
      <i className={`fas ${icon} pg-tip__icon me-1`} aria-hidden="true" />
      <span className="pg-tip__text"><SafeHtml value={text} /></span>
      {link?.href && (
        <a href={link.href} className="pg-tip__link ms-1" aria-label={link.label} title={link.label} onClick={openLink}
          {...(link.onOpen ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
          <i className="fas fa-external-link-alt" aria-hidden="true" />
        </a>
      )}
      <button type="button" className="pg-tip__hide" onClick={onHide} aria-label={hideLabel} title={hideLabel}>
        <i className="fas fa-eye-slash" aria-hidden="true" />
      </button>
    </div>
  )
}
