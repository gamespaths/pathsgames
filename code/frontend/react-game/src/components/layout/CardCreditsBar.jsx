/**
 * CardCreditsBar — slim footer row, same style as gc-title.
 * Shows "Credits: story by <author>, image by <copyright>" with links.
 * Returns null when neither story author nor card copyright is available.
 */
export default function CardCreditsBar({ card, story }) {
  const author   = story?.author ?? null
  const storyUrl = story?.card?.linkCopyright ?? null
  const imgName  = card?.copyrightText ?? null
  const imgUrl   = card?.linkCopyright ?? null

  if (!author && !imgName) return null

  const parts = []
  if (author) {
    parts.push(
      <span key="story">
        story by{' '}
        {storyUrl
          ? <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="gc-credits__link" onClick={e => e.stopPropagation()}>{author}</a>
          : <span>{author}</span>}
      </span>
    )
  }
  if (imgName) {
    parts.push(
      <span key="image">
        image by{' '}
        {imgUrl
          ? <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="gc-credits__link" onClick={e => e.stopPropagation()}>{imgName}</a>
          : <span>{imgName}</span>}
      </span>
    )
  }

  return (
    <div className="gc-credits">
      <span className="gc-credits__label">Credits:</span>
      {parts.map((p, i) => (
        <span key={i}>{i > 0 ? ', ' : ' '}{p}</span>
      ))}
    </div>
  )
}
