import { useState } from 'react'
import { useInRouterContext, useNavigate } from 'react-router-dom'
import BookPages from './BookPages'
import BookBookmarks from './BookBookmarks'
import Deck from './Deck'
import { usePolicyChapter } from './PolicyChapter'
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
}) {
  const chapter = usePolicyChapter()
  const anim = useAnimationSettings()
  const [turning, setTurning] = useState(false)
  const busy = Boolean(usePlayState()) || turning
  const withDeck = deck && anim.deal
  const showHome = useInRouterContext() && homeTab
  const tabsLeft = !chapter && showBookmarks ? visibleTabs(bookmarksLeft) : []
  const tabsRight = !chapter && showBookmarks ? visibleTabs(bookmarksRight) : []
  const noTabs = !showHome && tabsLeft.length === 0 && tabsRight.length === 0
  const covered = chapter ? 'book-content book-content--covered' : 'book-content'
  // Step 15 — while a card is played or the pages turn, the book is inert, tabs included (the navbar stays live).
  const stage = ['book-stage', stageClass, noTabs ? 'book-stage--no-tabs' : '', busy ? 'is-busy' : '']
    .filter(Boolean).join(' ')

  return (
    <div className={stage} inert={busy ? '' : undefined} aria-busy={busy ? 'true' : undefined}>
      <div className="book-shell">
        <div className={wrapperClass} data-page-key={chapter ? `policy:${chapter.kind}` : (pageKey ?? undefined)}
          data-direction={direction ?? undefined}>
          <BookOrnaments />
          {/* Inside the wrapper: the tabs belong to the cover. Step 16: one row, the sticky pills on phones (mobile.css). */}
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
        {/* Outside the wrapper on purpose: the pile lies on the table, under (or over) the cover. */}
        {withDeck && <Deck variant="table" />}
      </div>
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
