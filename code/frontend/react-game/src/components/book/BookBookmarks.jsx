import BonusBadgeList from '@/components/ui/BonusBadgeList'

/**
 * v0.35.5 — BookBookmarks: the tabs sticking out of the book's top edge, one row per page.
 * Each item is `{ key, icon, label, badges, onClick, active, disabled, title }`; `label` is
 * never printed — a tab is an icon and its badges, and the label names it to a screen
 * reader and to the tooltip.
 *
 * `danger` paints the tab red: the page behind it holds news the player has to act on.
 *
 * An active tab is inert — the page it opened is already there, and the way back is that
 * page's own arrow — and so is a disabled one (a feature that has not landed yet).
 */
export default function BookBookmarks({ items = [], side = 'left' }) {
  const visible = (items ?? []).filter(Boolean)
  if (visible.length === 0) return null

  return (
    <div className={`book-bookmarks book-bookmarks--${side}`}>
      {visible.map(item => {
        const inert = Boolean(item.disabled || item.active)
        return (
          <button
            key={item.key}
            type="button"
            className={['book-bookmark', item.active ? 'is-active' : '', item.disabled ? 'is-disabled' : '',
              item.danger ? 'is-danger' : ''].filter(Boolean).join(' ')}
            onClick={inert ? undefined : item.onClick}
            // aria-disabled, not the attribute: a disabled button shows no tooltip, and the
            // "coming soon" title is the whole point of the missions tab.
            aria-disabled={item.disabled ? 'true' : undefined}
            aria-current={item.active ? 'page' : undefined}
            title={item.title ?? item.label}
            aria-label={item.label}
          >
            {item.icon && <i className={item.icon} />}
            {item.badges?.length > 0 && (
              <BonusBadgeList items={item.badges} showZeros littleVersion className="book-bookmark__badges" />
            )}
          </button>
        )
      })}
    </div>
  )
}
