import { useEffect, useRef } from 'react'
import SafeHtml from './SafeHtml'

/**
 * TipNote — Step 40: the gold-glow hint appended to a page card's description.
 * A new `focusKey` (> 0) scrolls it into view and moves the focus onto it.
 */
export default function TipNote({ text, hideLabel, onHide, focusKey = 0 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!focusKey || !ref.current) return
    ref.current.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    ref.current.focus?.({ preventScroll: true })
  }, [focusKey])

  return (
    <div className="pg-tip" ref={ref} tabIndex={-1} role="note" data-testid="tip-note">
      <i className="fas fa-lightbulb pg-tip__icon me-1" aria-hidden="true" />
      <SafeHtml value={text} />
      <button type="button" className="pg-tip__hide" onClick={onHide} aria-label={hideLabel} title={hideLabel}>
        <i className="fas fa-eye-slash" aria-hidden="true" />
      </button>
    </div>
  )
}
