import { USER_STATES } from '../../constants/userAdmin'
import { fmtDate } from '../match/MatchDetailModal'

/** UserStateBadge — v1.7.0 the state of a user, with the end of a suspension. */
export default function UserStateBadge({ state, suspendedUntil }) {
  const known = USER_STATES[Number(state)]
  return (
    <span>
      <span className={`pg-badge ${known ? known.badge : 'pg-badge-info'}`}>{known ? known.label : `State ${state ?? '—'}`}</span>
      {Number(state) === 3 && suspendedUntil && (
        <span className="ms-2" style={{ fontSize: '0.75rem', color: 'var(--color-ash)' }}>until {fmtDate(suspendedUntil)}</span>
      )}
    </span>
  )
}
