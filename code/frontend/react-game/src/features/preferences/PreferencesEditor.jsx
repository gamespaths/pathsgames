import Card from '@/components/layout/Card'
import { useTranslation } from '@/i18n/context'
import { usePreferences } from '@/preferences/PreferencesContext'
import UserLanguageSelector from '@/features/guest-user/UserLanguageSelector'
import {
  ANIM_FLAGS, COLUMN_OPTIONS, DECKS, SIZES, SPEEDS, THEMES, TURN_MODES, clampColumns, columnAllowed,
} from '@/preferences/settings'
import { canVibrate } from '@/utils/haptics'
import { speedLabel } from './PreferencesCard'

/* PreferencesEditor — step 16: the right-page card that edits the device preferences; every choice applies at once.
   Rows of .lang-btn pills as radio groups (ready for step 17); the back arrow turns back to the grid. */

/** One row: its name and a radio group of pills. */
export function OptionRow({ id, name, options, value, onChange, disabled = false }) {
  return (
    <div className="pref-row" data-testid={`pref-${id}`}>
      <span className="pref-row__name" id={`pref-${id}-name`}>{name}</span>
      <div className="pref-row__options" role="radiogroup" aria-labelledby={`pref-${id}-name`}>
        {options.map(option => {
          const checked = option.value === value
          return (
            <button key={String(option.value)} type="button" role="radio" aria-checked={checked}
              className={`lang-btn ${checked ? 'active' : ''}`} disabled={disabled || option.disabled}
              onClick={() => { if (!checked) onChange(option.value) }}>
              {checked && <i className="fas fa-check me-1" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function onOff(t) {
  return [{ value: true, label: t('preferences.on') }, { value: false, label: t('preferences.off') }]
}

export default function PreferencesEditor({ onBack }) {
  const { t } = useTranslation()
  const { prefs, effective, animDefaults, layout, setPreference, reset } = usePreferences()
  const reduced = effective.reducedMotion
  // The configured value (choice, else env); reduced motion only disables the rows.
  const animValue = key => prefs.anim?.[key] ?? animDefaults[key]
  const shownColumns = effective.columns === 'auto' ? 'auto' : clampColumns(effective.columns, layout)

  const rows = (
    <div className="pref-rows">
      <div className="pref-row" data-testid="pref-language">
        <span className="pref-row__name">{t('preferences.rows.language')}</span>
        <UserLanguageSelector />
      </div>
      <OptionRow id="theme" name={t('preferences.rows.theme')} value={effective.theme}
        options={THEMES.map(v => ({ value: v, label: t(`preferences.theme.${v}`) }))}
        onChange={v => setPreference('theme', v)} />
      <OptionRow id="size" name={t('preferences.rows.size')} value={effective.size}
        options={SIZES.map(v => ({ value: v, label: t(`preferences.size.${v}`) }))}
        onChange={v => setPreference('size', v)} />
      <OptionRow id="columns" name={t('preferences.rows.columns')} value={shownColumns}
        options={COLUMN_OPTIONS.map(v => ({ value: v, label: v === 'auto' ? t('preferences.columnsAuto') : String(v),
          disabled: !columnAllowed(v, layout) }))}
        onChange={v => setPreference('columns', v)} />

      <h3 className="pref-section">{t('preferences.sections.animations')}</h3>
      {reduced && <p className="pref-note" data-testid="pref-reduced-note">{t('preferences.reducedNote')}</p>}
      {ANIM_FLAGS.map(flag => (
        <OptionRow key={flag} id={flag} name={t(`preferences.rows.${flag}`)} value={animValue(flag)}
          options={onOff(t)} disabled={reduced} onChange={v => setPreference(`anim.${flag}`, v)} />
      ))}
      <OptionRow id="turnMode" name={t('preferences.rows.turnMode')} value={animValue('turnMode')} disabled={reduced}
        options={TURN_MODES.map(v => ({ value: v, label: t(`preferences.turnMode.${v}`) }))}
        onChange={v => setPreference('anim.turnMode', v)} />
      <OptionRow id="speed" name={t('preferences.rows.speed')} value={animValue('speed')} disabled={reduced}
        options={SPEEDS.map(v => ({ value: v, label: speedLabel(v, t) }))}
        onChange={v => setPreference('anim.speed', v)} />
      <OptionRow id="deck" name={t('preferences.rows.deck')} value={animValue('deck')} disabled={reduced}
        options={DECKS.map(v => ({ value: v, label: t(`preferences.deck.${v}`) }))}
        onChange={v => setPreference('anim.deck', v)} />
      {canVibrate() && (
        <OptionRow id="vibration" name={t('preferences.rows.vibration')} value={prefs.vibration !== false}
          options={onOff(t)} onChange={v => setPreference('vibration', v)} />
      )}

      <button type="button" className="lang-btn pref-reset" data-testid="pref-reset" onClick={reset}>
        <i className="fas fa-undo me-1" />{t('preferences.reset')}
      </button>
    </div>
  )

  return (
    <Card variant="page" card={{ title: t('preferences.title'), description: t('preferences.intro'), urlImage: null }}
      loading={false} onClose={onBack} extraContent={rows} extraContentClassName="preferences-editor" hidePreview />
  )
}
