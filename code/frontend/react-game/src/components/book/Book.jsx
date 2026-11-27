import { useEffect, useRef, useState } from 'react'
import { useInRouterContext, useNavigate } from 'react-router-dom'
import BookPages from './BookPages'
import BookBookmarks from './BookBookmarks'
import Deck from './Deck'
import PlayedPile from './PlayedPile'
import { usePolicyChapter } from './PolicyChapter'
import { useRouteBook } from './RouteBook'
import { useTranslation } from '@/i18n/context'
import { useHomeButton } from '@/context/HomeButtonContext'
import { SHOW_BOOK_BOOKMARKS } from '@/constants/features'
import { useAnimationSettings } from '@/context/AnimationContext'
import { usePlayState } from '@/features/gameplay/play/PlayContext'

/**
 * Book — v1.13.0: the in-flow book under the sticky navbar (stage > shell > wrapper); phones stack its pages (v1.14.0).
 * A policy chapter covers both pages; step 15: a new `pageKey` turns `direction`, `holdTurn` keeps the old pages.
 */
export default function Book({
  left,
  right,
  stageClass     = '',
  wrapperClass   = 'book-wrapper',
  bookmarksLeft  = null,
  bookmarksRight = null,
  showBookmarks  = SHOW_BOOK_BOOKMARKS, // per-book override of the flag; gates the game's tabs only
  homeTab        = true,                // the "back to the home page" tab (false on the Home)
  pageKey        = null,                // step 15: a new key turns the page (also data-page-key, data-direction)
  direction      = null,                // 'forward' | 'back' | 'fade' | null (no turn)
  holdTurn       = false,               // step 15: the old pages stay on screen until it goes false
  deck           = true,                // step 14: the decks the cards are dealt from (only while the deal is on)
  coverTitle     = null,                // step 15: the title on this book's cover when the book changes
  playedPile     = null,                // v1.15.0: `{ story, played }` of a match, the face-up pile under the deck
}) {
  const chapter = usePolicyChapter()
  const anim = useAnimationSettings()
  const route = useRouteBook()
  const [turning, setTurning] = useState(false)
  // Step 15 — its own play or turn is reported to the routes' book (a navigation waits); a book change makes it busy too.
  const own = Boolean(usePlayState()) || turning
  useReportBusy(route?.report, own)
  const busy = own || Boolean(route?.busy)
  const withDeck = deck && anim.deal
  const showHome = useInRouterContext() && homeTab
  const tabsLeft = !chapter && showBookmarks ? visibleTabs(bookmarksLeft) : []
  const tabsRight = !chapter && showBookmarks ? visibleTabs(bookmarksRight) : []
  const homeTabs = showHome || tabsRight.length > 0
  const noTabs = !homeTabs && tabsLeft.length === 0
  const covered = chapter ? 'book-content book-content--covered' : 'book-content'
  // Step 15 — while a card is played or the pages turn, the book is inert, tabs included (the navbar stays live).
  // Step 15 — the stage says which groups show: phones make room over the book for either (v1.15.0).
  const stage = ['book-stage', stageClass, noTabs ? 'book-stage--no-tabs' : '',
    tabsLeft.length > 0 ? 'book-stage--game-tabs' : '', homeTabs ? 'book-stage--home-tab' : '', busy ? 'is-busy' : '']
    .filter(Boolean).join(' ')

  return (
    <div className={stage} inert={busy ? '' : undefined} aria-busy={busy ? 'true' : undefined}>
      <div className="book-shell">
        <div className={wrapperClass} data-page-key={chapter ? `policy:${chapter.kind}` : (pageKey ?? undefined)}
          data-direction={direction ?? undefined} data-cover-title={coverTitle || undefined}>
          <BookOrnaments />
          {/* Inside the wrapper: the tabs belong to the cover. Step 15: desktop side column, tablet top edge, phone edges (CSS). */}
          {!noTabs && (
            <div className="book-bookmarks-row">
              {tabsLeft.length > 0 && <BookBookmarks items={tabsLeft} side="left" />}
              {showHome
                ? <HomeTabRow items={tabsRight} />
                : tabsRight.length > 0 && <BookBookmarks items={tabsRight} side="right" />}
            </div>
          )}
          <BookPages anim={anim} pageKey={pageKey} direction={direction} holdTurn={holdTurn}
            chapterKind={chapter?.kind ?? null} deck={withDeck} onTurningChange={setTurning}
            left={<>
              {chapter && <div className="book-content book-content--chapter">{chapter.left}</div>}
              <div className={covered} aria-hidden={chapter ? 'true' : undefined}>{left}</div>
            </>}
            right={<>
              {chapter && <div className="book-content book-content--chapter">{chapter.right}</div>}
              <div className={covered} aria-hidden={chapter ? 'true' : undefined}>{right}</div>
            </>} />
        </div>
        {/* Outside the wrapper on purpose: the piles lie on the table, under (or over) the cover. */}
        {withDeck && <Deck variant="table" />}
        {withDeck && playedPile && <PlayedPile story={playedPile.story} played={playedPile.played} />}
      </div>
    </div>
  )
}

/** Step 15 — tells the routes' book whether this book is busy (play, hold, turn), and not busy once unmounted. */
function useReportBusy(report, busy) {
  const token = useRef(null)
  if (token.current === null) token.current = {}
  useEffect(() => { report?.(token.current, busy) }, [report, busy])
  useEffect(() => () => report?.(token.current, false), [report])
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
function HomeTabRow({ items }) {
  const i18n = useTranslation()
  const navigate = useNavigate()
  const homeButton = useHomeButton()
  const home = {
    key: 'home', icon: 'fas fa-home', label: i18n?.t ? i18n.t('nav.backHome') : 'nav.backHome',
    className: 'book-bookmark--home',
    onClick: () => { if (!homeButton.run()) navigate('/') },
  }
  return <BookBookmarks items={[...items, home]} side="right" />
}
