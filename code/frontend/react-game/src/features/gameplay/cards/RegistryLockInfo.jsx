import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { CREDIT_ICONS } from '@/utils/cardCredits'

/**
 * V1 step 1 - the registry lock of a locked card: one plain sentence, and the (i) button of its
 * preview, which on click is replaced by what the registry holds or misses for this card.
 */

/** The sentence for any registry lock; null when the backend sent none (older backend). */
export function registryLockSentence(t, lock) {
  if (!lock) return null
  return t('game.registryLock.blocked')
}

/** Whether the (i) has something to reveal: a named key, or a key kept secret. */
export function registryLockHasInfo(lock) {
  return !!lock && (lock.hidden === true || !!lock.key)
}

/** The detail behind the (i); `target` is the card type (action, movement, choice). */
export function registryLockText(t, lock, target) {
  const forbidden = lock.mode === 'FORBIDDEN'
  const what = t(`game.registryLock.target.${target}`)
  if (lock.hidden) {
    return t(`game.registryLock.${forbidden ? 'hiddenForbidden' : 'hiddenMissing'}`).replace('{target}', what)
  }
  const sentence = forbidden ? 'forbidden'
    : lock.operator === '>' ? 'missingGreater'
    : lock.operator === '<' ? 'missingLess'
    : 'missing'
  return t(`game.registryLock.${sentence}`)
    .replace('{value}', lock.value ?? '')
    .replace('{key}', lock.keyTitle || lock.key)
    .replace('{target}', what)
}

export default function RegistryLockInfo({ lock, target }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!registryLockHasInfo(lock)) return null
  return (
    <span className="registry-lock-info">
      {open ? (
        <>{': '}<span className="registry-lock-info-text" data-testid="registry-lock-text">
          {registryLockText(t, lock, target)}
        </span></>
      ) : (
        <>{' '}<button type="button" className="btn btn-link p-0 registry-lock-info-btn"
          data-testid="registry-lock-btn"
          aria-label={t('game.registryLock.info')} title={t('game.registryLock.info')}
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}>
          <i className={`fas ${CREDIT_ICONS.tip}`} />
        </button></>
      )}
    </span>
  )
}
