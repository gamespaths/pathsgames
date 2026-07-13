import { useState } from 'react'
import { changePlayerStatistics } from '../../../api/matchApi'

const STATS_FIELDS = [
  { key: 'dex',    label: 'DEX',    hint: null },
  { key: 'intel',  label: 'INT',    hint: null },
  { key: 'con',    label: 'CON',    hint: null },
  { key: 'energy', label: 'Energy', hint: 'energyMax' },
  { key: 'life',   label: 'Life',   hint: 'lifeMax' },
  { key: 'sad',    label: 'Sad',    hint: 'sadMax' },
  { key: 'coin',   label: 'Coin',   hint: null },
  { key: 'food',   label: 'Food',   hint: null },
  { key: 'magic',  label: 'Magic',  hint: null },
]

const PLAYER_FIELD_MAP = { dex: 'dexterity', intel: 'intelligence', con: 'constitution' }

/** Admin modal to edit a character's runtime statistics (POST changeStatistics). */
export default function EditStatsModal({ matchUuid, player, onClose, onSaved }) {
  const [vals, setVals] = useState(() => {
    const init = {}
    STATS_FIELDS.forEach(f => {
      const src = PLAYER_FIELD_MAP[f.key] || f.key
      init[f.key] = String(player[src] ?? player[f.key] ?? '')
    })
    return init
  })
  // The state flags ride along with the statistics: the same endpoint carries them, and only
  // the admin can clear a coma (the in-game rescue is Step 38).
  const [sleeping, setSleeping] = useState(() => !!(player.isSleeping ?? player.sleeping))
  const [coma, setComa] = useState(() => !!(player.isComa ?? player.coma))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function handleSave() {
    setSaving(true)
    setErr('')
    const body = {}
    STATS_FIELDS.forEach(f => {
      const raw = vals[f.key]
      const n = raw === '' ? -1 : parseInt(raw, 10)
      body[f.key] = isNaN(n) ? -1 : n
    })
    body.sleeping = sleeping
    // Clearing coma also wakes the character and lifts life to 1 when it is still 0: the
    // backend does that, so the character it hands back is one that can actually act.
    body.coma = coma
    changePlayerStatistics(matchUuid, player.uuid, body)
      .then(() => { onSaved(); onClose() })
      .catch(e => setErr(e.response?.data?.message || e.message || 'Save failed'))
      .finally(() => setSaving(false))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div className="pg-card" style={{ minWidth: 360, maxWidth: 480, width: '90%' }}>
        <p className="pg-card-title" style={{ marginBottom: '0.75rem' }}>
          <i className="fas fa-sliders-h me-2" />Edit statistics
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-ash)', marginBottom: '0.75rem' }}>
          Leave blank or enter -1 to keep the current value.
          Energy, Life and Sad are capped at their max.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 1rem' }}>
          {STATS_FIELDS.map(f => {
            const src = PLAYER_FIELD_MAP[f.key] || f.key
            const cur = player[src] ?? player[f.key]
            const maxVal = f.hint ? player[f.hint] : null
            return (
              <div key={f.key}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-ash)', display: 'block' }}>
                  {f.label}
                  {maxVal != null && (
                    <span style={{ marginLeft: 4, color: 'var(--color-gold)' }}>/{maxVal}</span>
                  )}
                </label>
                <input
                  type="number"
                  className="pg-input"
                  style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                  placeholder={cur != null ? String(cur) : ''}
                  value={vals[f.key]}
                  onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-2" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input
              type="checkbox"
              data-testid="stats-sleeping"
              checked={sleeping}
              onChange={e => setSleeping(e.target.checked)}
            />
            <i className="fas fa-bed" /> Sleeping
          </label>
          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
            marginLeft: '1rem' }}>
            <input
              type="checkbox"
              data-testid="stats-coma"
              checked={coma}
              onChange={e => setComa(e.target.checked)}
            />
            <i className="fas fa-heart-crack" /> Coma
          </label>
        </div>
        {coma === false && (player.isComa ?? player.coma) && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-gold)', marginTop: '0.35rem' }}>
            Clearing the coma also wakes the character and raises Life to at least 1.
          </p>
        )}
        {err && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{err}</p>
        )}
        <div className="flex gap-2" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="pg-btn pg-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="pg-btn pg-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
