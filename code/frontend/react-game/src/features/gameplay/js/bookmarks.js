import { isStatsCritical, isBagOverloaded } from '@/utils/gamebook'
import { buildStatBadges } from '@/utils/statBadges'

/**
 * v0.35.5 — the tabs over the two pages. Life/energy/sadness ride the (i) tab and the
 * carried weight rides the bag one, so the board's news is readable without opening
 * anything. Missions has no backend yet: the tab is there, greyed, saying so.
 *
 * The way back to the board is a tab of its own, so leaving any open page never needs a back
 * arrow to be found first. Inert while the board is already showing — the pin alone, since
 * the page it returns to names the location in full.
 */
export function buildBookmarksLeft({ t, view, previewLeft, playerStats,
  onBack, onOpenInfo, onOpenItems, onOpenMap }) {
  const boardShowing = view === 'board' && !previewLeft
  return [
    { key: 'position', icon: 'fas fa-map-marker-alt', label: t('game.bookmarks.position'),
      active: boardShowing, onClick: onBack },
    { key: 'information', icon: 'fas fa-info-circle', label: t('game.bookmarks.information'),
      badges: buildStatBadges(playerStats, t, {
        specificKeys: [['life', 'lifeMax'], ['energy', 'energyMax'], ['sadness', 'sadnessMax']],
      }),
      active: view === 'info' || previewLeft?.type === 'information',
      danger: isStatsCritical(playerStats),
      onClick: onOpenInfo },
    { key: 'items', icon: 'fas fa-suitcase', label: t('game.bookmarks.backpack'),
      badges: [{ key: 'weight', label: t('game.stats.weight'),
                 value: `${playerStats?.weight ?? 0}/${playerStats?.weightMax ?? 0}` }],
      active: view === 'items', danger: isBagOverloaded(playerStats), onClick: onOpenItems },
    { key: 'map', icon: 'fas fa-map', label: t('game.bookmarks.map'),
      active: view === 'map', onClick: onOpenMap },
    { key: 'missions', icon: 'fas fa-clipboard-list', label: t('game.bookmarks.missions'),
      disabled: true, title: t('game.bookmarks.comingSoon') },
  ]
}

/** No tabs over the right page yet — multiplayer is the first one waiting for a backend. */
export const BOOKMARKS_RIGHT = []
