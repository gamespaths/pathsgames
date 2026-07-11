import { fmtDate } from '../MatchDetailModal'
import { UuidCopy } from './matchDetailShared'

/**
 * MatchConfigCard — the "Match configuration" section: the status banner with
 * the pause/resume/stop/delete action buttons, plus the read-only config table.
 */
export default function MatchConfigCard({
  match, info, status, colors, isTerminalStatus, actionLoading, actionError,
  difficultyName, rngSeed, locationName20, onPause, onResume, onStop, onDelete,
}) {
  return (
    <div className="pg-card mb-4">
      <p className="pg-card-title mb-2"><i className="fas fa-sliders-h me-1" />Match configuration</p>

      {/* Match status + actions — compact first row */}
      <div
        className="flex items-center gap-3 flex-wrap mb-2"
        style={{
          borderLeft: `3px solid ${colors.border}`,
          background: colors.bg,
          borderRadius: 5,
          padding: '0.4rem 0.6rem',
        }}
      >
        <span style={{ fontSize: '0.72rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <i className="fas fa-circle-notch me-1" />Status
        </span>
        <span
          data-testid="match-status-label"
          style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: colors.border }}
        >
          {status || '—'}
        </span>

        {actionError && (
          <span style={{ color: '#ef4444', fontSize: '0.78rem', flex: '1 1 100%' }}>
            <i className="fas fa-exclamation-circle me-1" />{actionError}
          </span>
        )}

        <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0, marginLeft: 'auto' }}>
          {status === 'RUNNING' && (
            <button className="pg-btn pg-btn-gold pg-btn-sm" disabled={actionLoading} onClick={onPause}>
              <i className="fas fa-pause me-1" />Pause
            </button>
          )}
          {status === 'PAUSED' && (
            <button className="pg-btn pg-btn-success pg-btn-sm" disabled={actionLoading} onClick={onResume}>
              <i className="fas fa-play me-1" />Resume
            </button>
          )}
          {!isTerminalStatus && (
            <button className="pg-btn pg-btn-danger pg-btn-sm" disabled={actionLoading} onClick={onStop}>
              <i className="fas fa-stop me-1" />Stop match
            </button>
          )}
          {isTerminalStatus && (
            <button className="pg-btn pg-btn-danger pg-btn-sm" disabled={actionLoading} onClick={onDelete}>
              <i className="fas fa-trash me-1" />Delete match
            </button>
          )}
        </div>
      </div>

      <table className="pg-table" style={{ fontSize: '0.82rem' }}>
        <tbody>
          <tr>
            <th scope="row">Match UUID</th>
            <td><UuidCopy uuid={match?.uuid}>{match?.uuid}</UuidCopy></td>
            <th scope="row">Story UUID</th>
            <td><UuidCopy uuid={match?.storyUuid}>{match?.storyUuid || '—'}</UuidCopy></td>
          </tr>
          <tr>
            <th scope="row">Difficulty</th>
            <td>
              <UuidCopy uuid={match?.difficultyUuid}>
                {difficultyName(match?.difficultyUuid)}
              </UuidCopy>
            </td>
            <th scope="row">Mode</th>
            <td>{match?.singlePlayer === 0 ? 'Multiplayer' : 'Single'}</td>
          </tr>
          <tr>
            <th scope="row">Clock</th>
            <td>{match?.currentClock ?? 0}</td>
            <th scope="row">XP Cost</th>
            <td>{match?.expCost ?? 0}</td>
          </tr>
          <tr>
            <th scope="row">Created</th>
            <td>{fmtDate(match?.tsInsert)}</td>
            <th scope="row">Current location</th>
            <td>{locationName20?.(info.currentLocationId, info.currentLocationUuid) || '—'}</td>
          </tr>
          <tr>
            {/* Step 27 — per-match deterministic RNG seed (weather rolls). */}
            <th scope="row">RNG seed</th>
            <td>{rngSeed ?? '—'}</td>
            <th scope="row" />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
