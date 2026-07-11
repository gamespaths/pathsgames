import { shortUuid } from '../MatchDetailModal'
import { UuidCopy, StateBadges } from './matchDetailShared'

/**
 * PlayersCard — the "Players & characters" table: per-character stats, class,
 * traits, items, position, runtime state and an Edit-statistics action.
 */
export default function PlayersCard({ players, templateName, className, traitName, locationName20, onEditStats }) {
  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-users me-1" />Players &amp; characters ({players.length})
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th>Character</th><th>User</th>
              <th>Class</th><th>Traits</th>
              <th>DEX</th><th>INT</th><th>CON</th>
              <th>Energy</th><th>Life</th><th>Sad</th><th>Weight</th>
              <th>Items</th>
              <th>Position</th><th>State</th><th></th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && (
              <tr><td colSpan={15} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>
                No characters have joined this match yet.
              </td></tr>
            )}
            {players.map(p => (
              <tr key={p.uuid}>
                <td>
                  <UuidCopy uuid={p.characterTemplateUuid}>
                    {templateName(p.characterTemplateUuid)}
                  </UuidCopy>
                </td>
                <td>
                  <UuidCopy uuid={p.userUuid}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{shortUuid(p.userUuid)}</span>
                  </UuidCopy>
                </td>
                <td>
                  {p.classUuid
                    ? <UuidCopy uuid={p.classUuid}>{className(p.classUuid)}</UuidCopy>
                    : '—'}
                </td>
                <td>
                  {(p.traitUuids?.length > 0)
                    ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {p.traitUuids.map(t => (
                          <li key={t} style={{ whiteSpace: 'nowrap' }}>
                            <UuidCopy uuid={t}>{traitName(t)}</UuidCopy>
                          </li>
                        ))}
                      </ul>
                    )
                    : '—'}
                </td>
                <td>{p.dexterity}</td>
                <td>{p.intelligence}</td>
                <td>{p.constitution}</td>
                <td>{p.energyMax != null ? `${p.energy}/${p.energyMax}` : p.energy}</td>
                <td>{p.lifeMax != null ? `${p.life}/${p.lifeMax}` : p.life}</td>
                <td>{p.sadMax != null ? `${p.sad}/${p.sadMax}` : p.sad}</td>
                <td>{p.weightMax != null ? `${p.weight ?? 0}/${p.weightMax}` : (p.weight ?? '—')}</td>
                <td>
                  {(p.items?.length > 0)
                    ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {p.items.map(it => (
                          <li key={it.uuid} style={{ whiteSpace: 'nowrap' }}>
                            {(it.name || shortUuid(it.itemUuid))} ×{it.amount ?? 1}
                          </li>
                        ))}
                      </ul>
                    )
                    : '—'}
                </td>
                <td>{locationName20?.(p.idLocation) || (p.idLocation != null ? `#${p.idLocation}` : '—')}</td>
                <td><StateBadges player={p} /></td>
                <td>
                  <button
                    className="pg-btn pg-btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                    onClick={() => onEditStats(p)}
                    title="Edit statistics"
                  >
                    <i className="fas fa-sliders-h" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
