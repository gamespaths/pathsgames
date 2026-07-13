/**
 * ClockStatusCard — the read-only clock cycle panel (Step 26): current clock,
 * whether anyone is sleeping, and the per-character energy/state. Renders nothing
 * when the clock view is unavailable (older backends).
 */
export default function ClockStatusCard({ clock, clockLabel, clockCharName }) {
  if (!clock) return null
  return (
    <div className="pg-card mb-4">
      <p className="pg-card-title mb-2"><i className="fas fa-hourglass-half me-1" />Clock status</p>
      <table className="pg-table" style={{ fontSize: '0.82rem' }}>
        <tbody>
          <tr>
            <th scope="row">Current clock</th>
            <td>{clock.currentClock}{clockLabel(clock) ? ` (${clockLabel(clock)})` : ''}</td>
          </tr>
          <tr>
            <th scope="row">Anyone sleeping</th>
            <td>{clock.anyCharacterSleeping ? 'Yes' : 'No'}</td>
          </tr>
        </tbody>
      </table>
      {clock.characters?.length > 0 && (
        <table className="pg-table" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          <thead>
            <tr><th>Character</th><th>Energy</th><th>State</th></tr>
          </thead>
          <tbody>
            {clock.characters.map(c => (
              <tr key={c.characterUuid}>
                <td>{clockCharName(c.characterUuid)}</td>
                <td>{c.energy}</td>
                <td>{c.isSleeping ? 'Sleeping' : 'Awake'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
