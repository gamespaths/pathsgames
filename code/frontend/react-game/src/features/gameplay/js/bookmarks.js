import { isStatsCritical, isBagOverloaded } from '@/utils/gamebook'
import { buildStatBadges } from '@/utils/statBadges'

/**
 * v0.35.5 — the tabs over the two pages. Life/energy/sadness ride the (i) tab and the
 * carried weight rides the bag one, so the board's news is readable without opening
 * anything. Step 37 lit the missions tab up: it now opens the panel it had been promising.
 *
 * The way back to the board is a tab of its own, so leaving any open page never needs a back
 * arrow to be found first. Inert while the board is already showing — the pin alone, since
 * the page it returns to names the location in full.
 */
export function buildBookmarksLeft({ t, view, previewLeft, playerStats,
  onBack, onOpenInfo, onOpenItems, onOpenMap, onOpenMissions, missionsChanged = false }) {
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
    // v0.37.1 — no count: what a player wants between two turns is whether anything MOVED,
    // and `alert` is that one bit. The click that opens the panel puts it out.
    { key: 'missions', icon: 'fas fa-clipboard-list', label: t('game.bookmarks.missions'),
      alert: missionsChanged,
      // One mission's steps are still the missions section, so the tab stays lit.
      active: view === 'missions' || view === 'missionSteps', onClick: onOpenMissions },
  ]
}

/** No tabs over the right page yet — multiplayer is the first one waiting for a backend. */
export const BOOKMARKS_RIGHT = []
