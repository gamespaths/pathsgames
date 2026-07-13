import { useState } from 'react'
import { shortUuid } from '../MatchDetailModal'

/** Match statuses that are terminal (deletable, not pausable/resumable). */
export const TERMINAL = new Set(['ENDED', 'GAMEOVER'])

/** Per-status colours for the configuration card's status banner. */
export const STATUS_COLOR = {
  CREATED:  { bg: '#1e3a5f', border: '#3b82f6', label: 'var(--color-parchment)' },
  RUNNING:  { bg: '#1a3a2a', border: '#22c55e', label: 'var(--color-parchment)' },
  PAUSED:   { bg: '#3a2e10', border: '#eab308', label: 'var(--color-parchment)' },
  ENDED:    { bg: '#3a1a1a', border: '#ef4444', label: 'var(--color-parchment)' },
  GAMEOVER: { bg: '#2a0a0a', border: '#7f1d1d', label: 'var(--color-ash)'      },
}

export function findByUuid(list, uuid) {
  return (list || []).find(e => e.uuid === uuid) || null
}

export function resolveEntityName(texts, entity) {
  if (!entity) return null
  const textId = entity.idTextName
  if (!textId) return null
  const text = (texts || []).find(t => Number(t.idText) === Number(textId) && t.lang === 'en')
  return text?.shortText || `#${textId}`
}

/** First 20 characters of a name (display truncation), or "—" when empty. */
export function name20(name) {
  if (!name) return '—'
  return String(name).slice(0, 20)
}

/** Inline UUID chip — title shows full UUID, click copies it. */
export function UuidCopy({ uuid, children }) {
  const [copied, setCopied] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    if (!uuid) return
    navigator.clipboard?.writeText(uuid).then?.(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick(e)
    }
  }

  if (!uuid) return <span style={{ color: 'var(--color-ash)' }}>—</span>

  return (
    <span
      role="button"
      tabIndex={0}
      title={uuid}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer', fontFamily: children ? 'inherit' : 'monospace' }}
    >
      {children ?? shortUuid(uuid)}
      {copied && (
        <span style={{ color: 'var(--color-gold)', fontSize: '0.72em', marginLeft: '4px' }}>✓</span>
      )}
    </span>
  )
}

/** Character runtime-state badge (sleeping / coma / active). */
export function StateBadges({ player }) {
  if (player.isSleeping) return <span className="pg-badge pg-badge-info">sleeping</span>
  if (player.isComa) return <span className="pg-badge pg-badge-danger">coma</span>
  return <span className="pg-badge pg-badge-success">active</span>
}
