/**
 * CardCreditsBar — slim footer row, same style as gc-title.
 * Shows "Credits: story by <author>, image by <copyright>" with links.
 * Returns null when neither story author, card copyright nor a tip is available.
 * Step 40 — `tip` ({ label, onOpen }) adds a "tip" link right after the type label; the credits
 * stay on ONE line, cut with an ellipsis on the right (full text in the tooltip).
 */
export default function CardCreditsBar({ card, story, typeBadgeLabel = null, tip = null }) {
  const author   = story?.author ?? null
  const storyUrl = story?.card?.linkCopyright ?? null
  const imgName  = card?.copyrightText ?? null
  const imgUrl   = card?.linkCopyright ?? null

  if (!author && !imgName && !tip) return null

  const parts = []
  if (author) {
    parts.push(
      <span key="story" className="credit-author">
        story by{' '}
        {storyUrl
          ? <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="gc-credits__link" onClick={e => e.stopPropagation()}>{author}</a>
          : <span>{author}</span>}
      </span>
    )
  }
  if (imgName) {
    parts.push(
      <span key="image" className="credit-image">
        image by{' '}
        {imgUrl
          ? <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="gc-credits__link" onClick={e => e.stopPropagation()}>{imgName}</a>
          : <span>{imgName}</span>}
      </span>
    )
  }

  const fullText = [author && `story by ${author}`, imgName && `image by ${imgName}`]
    .filter(Boolean).join(' - ')

  return (
    <div className="gc-credits">
      {typeBadgeLabel && <span className="gc-type-badge-credits">{typeBadgeLabel}</span>} 
      {tip && (
        <button type="button" className="gc-credits__tip" onClick={e => { e.stopPropagation(); tip.onOpen() }}>
          <i className="fas fa-lightbulb me-1" aria-hidden="true" />{tip.label}
        </button>
      )}
      {parts.length > 0 && (
        <span className="gc-credits__text" title={fullText}>
          {typeBadgeLabel && <span className="gc-credits__label credit-credit"> - </span>}
          {parts.map((p, i) => (
            <span key={i}>{i > 0 ? ' - ' : ' '}{p}</span>
          ))}
        </span>
      )}
    </div>
  )
}
