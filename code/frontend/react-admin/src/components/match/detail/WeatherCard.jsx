import { shortUuid, fmtDate } from '../MatchDetailModal'
import { resolveEntityName, name20 } from './matchDetailShared'

/**
 * WeatherCard — the Step 27 weather panel: every weather rule of the story (the
 * active one flagged) plus the log_weather history. Renders nothing when the
 * weather view is unavailable (older backends).
 * v0.36.2 — the Registry column says whether a rule's registry condition lets it through.
 */

/** The registry gate of one rule: absent, met, or the reason it never fires. */
function RegistryGate({ rule }) {
  if (!rule.conditionKey) return '—'
  const clause = `${rule.conditionKey} ${rule.conditionOperator || '='} ${rule.conditionValue ?? ''}`.trim()
  return rule.registryMet
    ? <span className="pg-badge pg-badge-success" title="the registry lets this rule through">{clause}</span>
    : <span className="pg-badge pg-badge-danger" title="blocked by the registry">{clause}</span>
}
export default function WeatherCard({ weather, match, texts }) {
  if (!weather) return null
  return (
    <div className="pg-card mb-4" style={{ padding: 0, overflow: 'hidden' }} data-testid="weather-panel">
      <p className="pg-card-title" style={{ padding: '0.75rem 1rem 0' }}>
        <i className="fas fa-cloud-sun-rain me-1" />Weather · seed {(weather.rngSeed ?? match?.rngSeed) ?? '—'}
      </p>
      {/* Step 27 — every weather rule of the story; the active one is flagged. */}
      {weather.rules?.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="pg-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr><th>Weather</th><th>Name</th><th>Probability</th><th>Energy Δ</th>
                <th>Move (safe)</th><th>Move (unsafe)</th><th>Active</th>
                <th>Registry</th><th>Current</th></tr>
            </thead>
            <tbody>
              {weather.rules.map(r => {
                const nm = r.name || resolveEntityName(texts, r)
                return (
                  <tr key={r.id ?? r.uuid}
                      className={r.current ? 'pg-row-active' : undefined}
                      style={r.current ? { fontWeight: 600 } : undefined}>
                    <td>{r.uuid ? shortUuid(r.uuid) : r.id}</td>
                    <td title={nm || ''}>{name20(nm)}</td>
                    <td>{r.probability ?? '—'}</td>
                    <td>{r.deltaEnergy ?? 0}</td>
                    <td>{r.costMoveSafeLocation ?? '—'}</td>
                    <td>{r.costMoveNotSafeLocation ?? '—'}</td>
                    <td>{r.active ? 'yes' : 'no'}</td>
                    <td style={{ wordBreak: 'break-all' }}><RegistryGate rule={r} /></td>
                    <td>{r.current
                      ? <span className="pg-badge pg-badge-success">current</span>
                      : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pg-muted" style={{ padding: '0 1rem 0.75rem', fontSize: '0.82rem' }}>
          No weather rules defined for this story.
        </p>
      )}
      {weather.log?.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="pg-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr><th>#</th><th>Clock</th><th>Weather</th><th>Since</th></tr>
            </thead>
            <tbody>
              {weather.log.map(l => (
                <tr key={l.id ?? `${l.clock}-${l.idWeather}`}>
                  <td>{l.id}</td>
                  <td>{l.clock}</td>
                  <td>{l.weatherUuid ? shortUuid(l.weatherUuid) : (l.idWeather ?? '—')}</td>
                  <td>{l.timestampStart ? fmtDate(l.timestampStart) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
