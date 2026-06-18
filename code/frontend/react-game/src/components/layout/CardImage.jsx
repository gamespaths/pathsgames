/**
 * CardImage — shared image/placeholder block for Card and its "page" variant.
 * Renders an <img> when a source is given; otherwise an optional icon placeholder.
 *
 * @param {string}  src              - image URL (when falsy, fall back to placeholder)
 * @param {string}  alt              - image alt text
 * @param {string}  imgClassName     - class applied to the <img> (gc-img / book-page-img …)
 * @param {string}  placeholderIcon  - Font-Awesome icon class for the placeholder
 * @param {boolean} renderPlaceholder- when false, render nothing instead of the placeholder
 */
export default function CardImage({
  src,
  alt = '',
  imgClassName = '',
  placeholderIcon = 'fas fa-question',
  renderPlaceholder = true,
}) {
  if (src) {
    return <img src={src} alt={alt} className={imgClassName || undefined} />
  }
  if (!renderPlaceholder) return null
  return (
    <div className="gc-placeholder"><i className={placeholderIcon} /></div>
  )
}
