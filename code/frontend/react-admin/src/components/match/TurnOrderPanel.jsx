import { buildTurnOrder } from '../../utils/turnPriority'
import { shortUuid } from './MatchDetailModal'

/**
 * TurnOrderPanel — Step 24 admin read-only projected turn order.
 *
 * Computes the stat-driven turn priority for each character of the match and
 * lists them highest-first, so an admin can see who would act first. It is a
 * projection (see utils/turnPriority): the live WAITING/ACTIVE/COMPLETED queue
 * is owner-restricted and not exposed to the admin API.
 *
 * `nameOf` (optional) maps a character-template uuid to a display name.
 */
export default function TurnOrderPanel({ players, nameOf }) {
  const order = buildTurnOrder(players)

  return (
    <div className="pg-card" data-testid="turn-order-panel">
      <div className="pg-card-header">
        <i className="fas fa-hourglass-half me-1" />
        Projected turn order ({order.length})
      </div>
      <div className="pg-card-body">
        {order.length === 0 ? (
          <p style={{ color: 'var(--color-ash)' }} data-testid="turn-order-empty">
            No characters to order yet.
          </p>
        ) : (
          <ol className="pg-turn-order" data-testid="turn-order-list">
            {order.map((p, i) => (
              <li key={p.uuid ?? i} data-testid="turn-order-row">
                <span className="pg-turn-rank">#{i + 1}</span>
                <span className="pg-turn-name">
                  {nameOf ? nameOf(p.characterTemplateUuid) : shortUuid(p.uuid)}
                </span>
                <span className="pg-turn-priority" title="Projected priority">
                  {p.priority}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
