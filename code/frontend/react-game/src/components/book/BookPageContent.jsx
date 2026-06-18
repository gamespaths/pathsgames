import Card from '../layout/Card'

/**
 * BookPageContent — content of the book page.
 *
 * Thin compatibility wrapper: the actual rendering now lives in the unified
 * Card (variant="page"), so both the interactive selection cards and the
 * book reading page share one component.
 *
 * Renders a card (border + shadow): golden title bar, full-width image,
 * description on parchment background, credits (i) button bottom-left.
 * When `entity` + `entityType` are passed, renders a bonus-stats badges row.
 */
export default function BookPageContent(props) {
  return <Card variant="page" {...props} />
}
