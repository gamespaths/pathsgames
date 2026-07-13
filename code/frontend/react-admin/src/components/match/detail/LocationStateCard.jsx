import { UuidCopy } from './matchDetailShared'

/**
 * LocationStateCard — gaming_state_locations with, per location (Step 28): the
 * resolved name (first 20 chars), the characters currently inside (inline), and
 * the neighbors with the cost formula (edge + entry + weather = total). Neighbors
 * are shown only when at least one character is present in the location.
 */
export default function LocationStateCard({ info, players, movementByLoc, locationName20, templateName }) {
  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-map me-1" />Location state — gaming_state_locations ({info.locations?.length ?? 0})
      </p>
      {/* Step 26 — Counter is the residual location time counter (clock_counter).
          Step 28 — the characters currently in the location are listed inline; its
          neighbors (with the weather-resolved total energy cost) are shown beside
          them only when at least one character is present. */}
      <div style={{ overflowX: 'auto' }}>
        <table className="pg-table" style={{ fontSize: '0.78rem' }}>
          <thead><tr><th>UUID</th><th>Id</th><th>Name</th><th>Characters</th><th>Neighbors</th><th>Activated</th><th>Counter</th></tr></thead>
          <tbody>
            {(info.locations ?? []).length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-ash)' }}>No locations.</td></tr>
            )}
            {(info.locations ?? []).map(l => {
              const mv = movementByLoc.get(Number(l.idLocation))
              const chars = (players ?? []).filter(
                p => p.idLocation != null && Number(p.idLocation) === Number(l.idLocation))
              const neighbors = mv?.neighbors ?? []
              const nm = locationName20(l.idLocation, mv?.uuid)
              return (
                <tr key={l.uuid ?? l.idLocation}>
                  <td><UuidCopy uuid={l.uuid} /></td>
                  <td>#{l.idLocation}</td>
                  <td title={nm}>{nm}</td>
                  <td>
                    {chars.length === 0
                      ? <span style={{ color: 'var(--color-ash)' }}>—</span>
                      : chars.map(p => (
                          <span key={p.uuid} className="pg-badge pg-badge-info me-1" title="character in this location">
                            <i className="fas fa-user me-1" />{templateName(p.characterTemplateUuid)}
                          </span>
                        ))}
                  </td>
                  <td>
                    {/* Neighbors only when at least one character is in the location;
                        cost shown as edge + entry + weather = total. */}
                    {chars.length === 0 || neighbors.length === 0
                      ? <span style={{ color: 'var(--color-ash)' }}>—</span>
                      : neighbors.map(n => (
                          <div key={`nb-${l.idLocation}-${n.idLocation}`} style={{ whiteSpace: 'nowrap' }}>
                            <i className="fas fa-arrow-right me-1" />
                            {(n.direction ?? '—')} · {locationName20(n.idLocation, n.uuid)}
                            {' '}
                            <span title="edge + entry + weather = total">
                              ({n.baseEnergyCost ?? 0} + {n.entryEnergyCost ?? 0} + {n.weatherEnergyCost ?? 0} ={' '}
                              <span className="pg-badge pg-badge-gold">{n.totalEnergyCost ?? 0}</span>)
                            </span>
                            {n.conditionMet === false && (
                              <span className="pg-badge pg-badge-danger ms-1" title="movement condition not met"><i className="fas fa-lock" /></span>
                            )}
                          </div>
                        ))}
                  </td>
                  <td>{l.flagAlreadyActived ? 'yes' : 'no'}</td>
                  <td>{l.clockCounter ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
