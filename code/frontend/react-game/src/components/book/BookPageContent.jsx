import GameCardInfoButton from '../layout/GameCardInfoButton'

/**
 * BookPageContent — content of the book page.
 * Renders as a book page (NOT a card): chapter title, image,
 * description text, footer with copyright + credits link.
 */
export default function BookPageContent({ card, story,  loading , onClose }) {
  return (
    <div className="book-page-content">
      {loading && (
        <div className="book-page-loading">
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--color-gold)' }} />
        </div>
      )}

      <h2 className="book-page-title">
        {onClose && <button className="float-left" onClick={onClose} aria-label="Close preview">
          <i className="fas fa-arrow-left me-1" />{ /*t('book.back')*/ }
        </button>}
        {card?.title}
        {card?.linkCopyright && (
          <GameCardInfoButton
            story={story}
            card={card}
            buttonClassName="float-right card-info-btn "
          />
        )}
      </h2>
     

      {card?.imageUrl && (
        <img src={card.imageUrl} alt={card?.title} className="book-page-img" />
      )}

      {card?.description && (
        <p className="book-page-desc">{card.description}</p>
      )}

    </div>
  )
}
