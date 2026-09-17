import { useState } from 'react'
import Card from '@/components/layout/Card'
import BonusBadgeList from '@/components/ui/BonusBadgeList'
import { useTranslation } from '@/i18n/context'
import { useExp } from '@/api/matches'
import { buildExperienceStatCard } from '@/utils/loadoutCards'
import { EXP_STAT_ICON } from '@/utils/experience'

/**
 * ExperienceStatCard — Step 38. One stat of the training page: its current value, the
 * experience held, what the next point costs, and the button that buys it.
 *
 * No (i) and no reading page: everything worth knowing is on the face, and a purchase is a
 * click, not a story — the footer button calls `use-exp` straight away. (Every other card
 * routes its action through the page; this one is deliberately the exception.)
 *
 * The backend owns every refusal; the card only greys out the two it can foresee — a stat
 * at its cap (the price list says null) and a point the experience held cannot pay for —
 * so a click is never answered with a certain 409. The locked state goes through
 * `lockInfo`, never a `label` prop (the no-label-prop-in-card convention).
 *
 * `use-exp` answers `statChanges` in the execute-event shape, so `onDone` is the board's
 * own handler and the +1 / -cost badges render with the alphabet the board already speaks.
 */
export default function ExperienceStatCard({
  row, experience = 0, story, matchUuid, accessToken, onDone, onError,
}) {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)

  const label = t(`game.stats.${row.key}`)
  // The `experience-<stat>` picture of data/images.json, its glyph the stat's own.
  const cardData = { ...buildExperienceStatCard(row.stat, label, t(`game.stats.descriptions.${row.key}`)),
    awesomeIcon: EXP_STAT_ICON[row.stat] }
  const locked = !row.affordable
  const lockInfo = locked ? t(`game.exp.reason.${row.atCap ? 'MAX_STAT_VALUE' : 'NOT_ENOUGH_EXP'}`) : undefined

  // The figures, in reading order: the stat as it is, the experience held, what the next
  // point costs (a word at the cap), and — only where it can actually be bought — the stat
  // once that point is. A point one cannot afford promises nothing.
  const held = Number(experience ?? 0)
  const figures = [
    { key: row.key, value: `${row.value}`, label: t('game.exp.current') },
    { key: 'experience', value: `${held}`, label: t('game.exp.held') },
    { key: 'experience', value: row.atCap ? t('game.exp.atMax') : `${row.cost}`, label: t('game.exp.cost') },
  ]
  if (row.affordable) {
    figures.push({ key: row.key, value: `${row.value + 1}`, label: t('game.exp.after') })
  }
  // On the card FACE the figures keep their words — "Cost: 3" — so a number is never
  // mistaken for the stat it buys.
  const faceBadge = (
    <BonusBadgeList items={figures} showZeros
      className="player-stats-bar bonus-badge-list m-1 display-flex flex-direction-column" />
  )

  async function handleUse() {
    if (running || !matchUuid) return
    setRunning(true)
    try {
      const result = await useExp(matchUuid, row.stat, accessToken)
      await onDone?.(result)
    } catch (e) {
      console.error('use-exp failed', e?.response?.data?.error || e?.message)
      onError?.(e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card
      card={cardData}
      entityType="experience"
      onAction={row.affordable ? handleUse : undefined}
      actionLabel={t('game.exp.use')}
      actionIcon="fa-arrow-up"
      locked={locked}
      lockInfo={lockInfo}
      lockedIcon="fas fa-star"
      hidePreview
      story={story}
      childrenIntoImage={faceBadge}
    />
  )
}
