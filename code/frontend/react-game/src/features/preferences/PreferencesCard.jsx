import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { useAnimationSettings } from '@/context/AnimationContext'
import { usePreferences } from '@/preferences/PreferencesContext'
import { ANIM_FLAGS } from '@/preferences/settings'

/* PreferencesCard — step 16: the little card of the player-page grid, after the statistics card; its badges sum up
   language, theme, size, animations and columns, and "Change" opens the editor on the right page. */

const SPEED_KEYS = Object.freeze({ 0.25: 'quarter', 0.5: 'half', 1: 'one' })

/** The speed as the editor names it (¼×, ½×, 1×), else the number. */
export function speedLabel(speed, t) {
  const key = SPEED_KEYS[speed]
  return key ? t(`preferences.speed.${key}`) : `${speed}×`
}

/** The five badges of the card: { key, icon, label, value }. */
export function preferenceBadges({ lang, effective, anim, t }) {
  const animOn = ANIM_FLAGS.some(flag => anim[flag])
  return [
    { key: 'language', icon: 'fas fa-language', label: t('preferences.badges.language'), value: String(lang ?? '').toUpperCase() },
    { key: 'theme', icon: 'fas fa-palette', label: t('preferences.badges.theme'), value: t(`preferences.theme.${effective.theme}`) },
    { key: 'size', icon: 'fas fa-text-height', label: t('preferences.badges.size'), value: t(`preferences.sizeShort.${effective.size}`) },
    { key: 'animations', icon: 'fas fa-film', label: t('preferences.badges.animations'),
      value: animOn ? `${t('preferences.on')} ${speedLabel(anim.speed, t)}` : t('preferences.off') },
    { key: 'columns', icon: 'fas fa-th', label: t('preferences.badges.columns'),
      value: effective.columns === 'auto' ? t('preferences.columnsAuto') : String(effective.cols) },
  ].map(badge => ({ ...badge, color: 'var(--color-gold-light)', keepZero: true }))
}

export default function PreferencesCard({ onOpen }) {
  const { t, lang } = useTranslation()
  const { effective } = usePreferences()
  const anim = useAnimationSettings()
  return (
    <Card card={{ title: t('preferences.title'), urlImage: null, awesomeIcon: 'fas fa-sliders-h' }}
      statistics={preferenceBadges({ lang, effective, anim, t })} flagShowFullStatistics bonusBadgeShowZeros hidePreview
      onAction={onOpen} actionLabel={t('preferences.change')} actionIcon="fa-pen" testId="preferences-card"
      additionalCardClasses="preferences-card" />
  )
}
