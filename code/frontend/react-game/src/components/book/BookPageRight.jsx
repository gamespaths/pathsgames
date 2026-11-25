import Deck from './Deck'

/** The right page; with `deck` (step 14) the page deck closes it, shown only by the mobile layout (step 16). */
export default function BookPageRight({ children, deck = false }) {
  return (
    <div className="book-page book-page-right  ">
      <div className="page-corner page-corner-tr" />
      <div className="page-corner page-corner-bl" />
      <div className="page-inner">
        {children}
      </div>
      {deck && <Deck variant="page" />}
    </div>
  )
}
