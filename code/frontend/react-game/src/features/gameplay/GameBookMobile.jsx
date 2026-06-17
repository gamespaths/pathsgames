/**
 * GameBookMobile — single-column mobile layout. Reuses the exact same
 * `leftContent` (the current location / preview page) and `rightContent` (the
 * action cards) computed by GameBook, stacked vertically: left on top, right
 * below. This keeps desktop and mobile in sync from one source of truth.
 */
export default function GameBookMobile({ left, right, endError }) {
  return (
    <div className="book-mobile-layout">
      <div className="book-mobile-left">{left}</div>
      <div className="book-mobile-right">{right}</div>
      {endError && (
        <p className="game-error end-game-error">
          <i className="fas fa-exclamation-triangle me-2" />{endError}
        </p>
      )}
    </div>
  )
}
