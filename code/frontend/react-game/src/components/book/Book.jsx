import BookPageLeft from './BookPageLeft'
import BookPageRight from './BookPageRight'

/**
 * Book — full book UI: overlay + wrapper + spine + left/right pages.
 *
 * Props:
 *   left            ReactNode  content for the left page
 *   right           ReactNode  content for the right page
 *   onClose         fn|null    if provided, renders a fixed close button
 *   closeLabel      string     optional text shown next to the close button
 *   overlayClass    string     class on the outer overlay div
 *   wrapperClass    string     class on the book-wrapper div
 *   mobile          ReactNode  optional extra element rendered below the book (mobile UI)
 */
export default function Book({
  left,
  right,
  onClose,
  closeLabel    = null,
  overlayClass  = 'book-overlay',
  wrapperClass  = 'book-wrapper',
  mobile        = null,
}) {
  return (
    <div className={overlayClass}>
      {onClose && (
        <div className="book-close-bar">
          {closeLabel && <span className="book-close-label">{closeLabel}</span>}
          <button
            className="book-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      )}
      <div className={wrapperClass}>
        <div className="book-spine" />
        <BookPageLeft>{left}</BookPageLeft>
        <BookPageRight>{right}</BookPageRight>
      </div>
      {mobile}
    </div>
  )
}
