import { useTranslation } from '../../i18n/context'
import GameCard from '../../components/layout/GameCard'
import CardDetailModal from './CardDetailModal'

function sanitizeModalId(value, fallback) {
  const raw = String(value ?? fallback)
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return safe || String(fallback)
}

const PRESETS = {
  location: {
    label:        'game.moveTo',
    labelIcon:    'fas fa-arrows-alt',
    defaultIcon:  'fas fa-map-marker-alt',
    selectLabel:  'game.move',
    modalPrefix:  'neighbor-modal',
    alertAction:  'Move to',
  },
  action: {
    label:        'game.actions',
    labelIcon:    'fas fa-hand-sparkles',
    defaultIcon:  'fas fa-bolt',
    selectLabel:  'game.execute',
    modalPrefix:  'action-modal',
    alertAction:  'Execute',
  },
}

/**
 * SelectionView — generic in-game horizontal selection row used by GameBook
 * for both the "Move to" neighbours list and the "Actions" list. Replaces
 * the former NeighborRow + ActionsRow components.
 *
 * Each option is a GameCard variant="little": clicking the footer button
 * triggers the option (or routes through `onEndGame` when the option has
 * `endGame: true`); the (i) info button opens a CardDetailModal with the
 * full description and the same call-to-action.
 *
 * The header and the row are hidden entirely when `options` is empty —
 * GameBook handles the empty-locations case by swapping the left page to
 * the story big card.
 */
export default function SelectionView({ type, options, onEndGame , handleSelectionPreview }) {
  const { t } = useTranslation()
  const preset = PRESETS[type] ?? PRESETS.action //type=ACTION/????

  if (!Array.isArray(options) || options.length === 0) return null

  const execute = (name) => {
    alert(`Executing action: ${preset.alertAction} - ${name}`)
  }

  const handleAction = (opt) => {
    if (opt?.endGame === true) {
      onEndGame?.(opt)
      return
    }
    execute(opt?.name)
  }

  const openModal = (modalId) => {
    if (typeof window === 'undefined') return
    const el = document.getElementById(modalId)
    if (!el) return
    const Modal = window.bootstrap?.Modal
    if (Modal) Modal.getOrCreateInstance(el).show()
  }

  return (
    <>
      {/*<div className="game-section-label">
        <i className={`${preset.labelIcon} me-2`} />{t(preset.label)}
      </div>*/}

      { /* <div className="game-cards-row"> */}
      <div className="selection-scroll">
        <div className="selection-list">
        {options.map((opt, i) => {
          const modalId    = `${preset.modalPrefix}-${sanitizeModalId(opt.uuid, i)}`
          const isEndGame  = opt.endGame === true
          const labelKey   = isEndGame ? 'game.endGame' : preset.selectLabel
          const selectText = t(labelKey)
          const icon       = opt.awesomeIcon ?? (isEndGame ? 'fas fa-flag-checkered' : preset.defaultIcon)
          return (
            <div key={opt.uuid ?? i} className="game-card-cell">
              <GameCard
                variant="little"
                card={{ ...opt, title: opt.name }}
                icon={icon}
                imageAlt={opt.name}
                onSelect={() => handleAction(opt)}
                selectLabel={selectText}
                onPreview={() => handleSelectionPreview?.(opt, type)}
                locked={opt.locked}
                lockedReason={opt.lockedReason}
                lockInfo={opt.lockInfo}
                hidePreview={opt.locked}
              />
            </div>
          )
        })}
      </div></div>
    </>
  )
}
