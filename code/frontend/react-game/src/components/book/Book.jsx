import BookPageLeft from './BookPageLeft'
import BookPageRight from './BookPageRight'
import BookBookmarks from './BookBookmarks'
import { SHOW_BOOK_BOOKMARKS } from '@/constants/features'

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
 *   bookmarksLeft   Array      tabs over the left page (see BookBookmarks); [] for none
 *   bookmarksRight  Array      tabs over the right page
 *   showBookmarks   boolean    per-book override of the SHOW_BOOK_BOOKMARKS flag
 */
export default function Book({
  left,
  right,
  onClose,
  closeLabel    = null,
  overlayClass  = 'book-overlay',
  wrapperClass  = 'book-wrapper',
  mobile        = null,
  bookmarksLeft  = null,
  bookmarksRight = null,
  showBookmarks  = SHOW_BOOK_BOOKMARKS,
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
        {/* Inside the wrapper on purpose: mobile hides it, and the tabs go with it. */}
        {showBookmarks && <BookBookmarks items={bookmarksLeft} side="left" />}
        {showBookmarks && <BookBookmarks items={bookmarksRight} side="right" />}
        <div className="book-spine" />
        <BookPageLeft>{left}</BookPageLeft>
        <BookPageRight>{right}</BookPageRight>
      </div>
      {mobile}
    </div>
  )
}
