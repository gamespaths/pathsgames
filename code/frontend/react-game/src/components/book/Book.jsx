import { useInRouterContext, useNavigate } from 'react-router-dom'
import BookPageLeft from './BookPageLeft'
import BookPageRight from './BookPageRight'
import BookBookmarks from './BookBookmarks'
import { usePolicyChapter } from './PolicyChapter'
import { useTranslation } from '@/i18n/context'
import { useHomeButton } from '@/context/HomeButtonContext'
import { SHOW_BOOK_BOOKMARKS } from '@/constants/features'

/**
 * Book — v1.13.0: the in-flow book of a page under the sticky navbar: stage > shell > wrapper, then the mobile slot.
 * An open policy chapter takes both pages; the page's own content stays mounted, only covered.
 */
export default function Book({
  left,
  right,
  mobile         = null,
  stageClass     = '',
  wrapperClass   = 'book-wrapper',
  bookmarksLeft  = null,
  bookmarksRight = null,
  showBookmarks  = SHOW_BOOK_BOOKMARKS, // per-book override of the flag; gates the game's tabs only
  homeTab        = true,                // the "back to the home page" tab (false on the Home)
  pageKey        = null,                // data-page-key, data-direction: hooks for step 15's page turn
  direction      = null,
}) {
  const chapter = usePolicyChapter()
  const showHome = useInRouterContext() && homeTab
  const tabsLeft = !chapter && showBookmarks ? visibleTabs(bookmarksLeft) : []
  const tabsRight = !chapter && showBookmarks ? visibleTabs(bookmarksRight) : []
  const noTabs = !showHome && tabsLeft.length === 0 && tabsRight.length === 0
  const covered = chapter ? 'book-content book-content--covered' : 'book-content'
  const stage = ['book-stage', stageClass, noTabs ? 'book-stage--no-tabs' : ''].filter(Boolean).join(' ')

  return (
    <div className={stage}>
      {showHome && <HomeTabRow items={[]} className="book-mobile-home" />}
      <div className="book-shell">
        <div className={wrapperClass} data-page-key={chapter ? `policy:${chapter.kind}` : (pageKey ?? undefined)}
          data-direction={direction ?? undefined}>
          <BookOrnaments />
          {/* Inside the wrapper on purpose: mobile hides it, and the tabs go with it. */}
          {tabsLeft.length > 0 && <BookBookmarks items={tabsLeft} side="left" />}
          {showHome
            ? <HomeTabRow items={tabsRight} />
            : tabsRight.length > 0 && <BookBookmarks items={tabsRight} side="right" />}
          <div className="book-spine" />
          <BookPageLeft>
            {chapter && <div className="book-content book-content--chapter">{chapter.left}</div>}
            <div className={covered} aria-hidden={chapter ? 'true' : undefined}>{left}</div>
          </BookPageLeft>
          <BookPageRight>
            {chapter && <div className="book-content book-content--chapter">{chapter.right}</div>}
            <div className={covered} aria-hidden={chapter ? 'true' : undefined}>{right}</div>
          </BookPageRight>
        </div>
      </div>
      {chapter && <div className="book-content book-content--chapter">{chapter.mobile}</div>}
      <div className={covered} aria-hidden={chapter ? 'true' : undefined}>{mobile}</div>
    </div>
  )
}

function visibleTabs(items) {
  return (items ?? []).filter(Boolean)
}

/** Leather cover ornaments: metal corners, headbands at the spine ends, the ribbon. */
function BookOrnaments() {
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map(c => (
        <span key={c} className={`book-ornament book-corner book-corner--${c}`} aria-hidden="true" />
      ))}
      <span className="book-ornament book-headband book-headband--top" aria-hidden="true" />
      <span className="book-ornament book-headband book-headband--bottom" aria-hidden="true" />
      <span className="book-ornament book-ribbon" aria-hidden="true" />
    </>
  )
}

/** The right tab row ending with the home tab; rendered only inside a router. */
function HomeTabRow({ items, className }) {
  const i18n = useTranslation()
  const navigate = useNavigate()
  const homeButton = useHomeButton()
  const home = {
    key: 'home', icon: 'fas fa-home', label: i18n?.t ? i18n.t('nav.backHome') : 'nav.backHome',
    className: 'book-bookmark--home',
    onClick: () => { if (!homeButton.run()) navigate('/') },
  }
  const row = <BookBookmarks items={[...items, home]} side="right" />
  return className ? <div className={className}>{row}</div> : row
}
