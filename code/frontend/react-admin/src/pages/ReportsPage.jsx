import { useEffect, useState } from 'react'
import { getKpiReport } from '../api/reportApi'
import { listMatches, getMatchInfo } from '../api/matchApi'
import { listAllStories, listEntities } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { shortUuid, StatusBadge } from '../components/match/MatchDetailModal'

// v0.41.2 Step 41 F — KPI report per story (day/month/total) and the matches still being played.
const DAY_MS = 86_400_000
export const ACTIVE_STATUSES = ['RUNNING', 'PAUSED']

export function utcDay(offsetDays = 0, now = Date.now()) {
  return new Date(now + offsetDays * DAY_MS).toISOString().slice(0, 10)
}

export function percent(rate) {
  return rate == null ? '—' : `${(rate * 100).toFixed(1)}%`
}

export function orDash(value) {
  return value == null ? '—' : value
}

// uuid -> English name through idTextName, the way the match pages resolve story entities.
export function buildNames(texts, ...lists) {
  const byId = new Map((texts || []).filter(t => t.lang === 'en').map(t => [Number(t.idText), t.shortText]))
  const names = new Map()
  lists.flat().forEach(e => {
    if (e?.uuid && e.idTextName != null && byId.get(Number(e.idTextName))) names.set(e.uuid, byId.get(Number(e.idTextName)))
  })
  return names
}

export async function fetchNames(storyUuid) {
  if (!storyUuid) return new Map()
  const results = await Promise.allSettled(['texts', 'choices', 'locations', 'missions']
    .map(type => listEntities(storyUuid, type)))
  const [texts, ...lists] = results.map(r => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []))
  return buildNames(texts, ...lists)
}

export async function fetchActiveMatches(storyUuid) {
  const pages = await Promise.all(ACTIVE_STATUSES.map(status => {
    const params = { status, limit: 50 }
    if (storyUuid) params.storyUuid = storyUuid
    return listMatches(params)
  }))
  return pages.flatMap(p => (Array.isArray(p?.items) ? p.items : []))
}

function UuidName({ uuid, names }) {
  const name = names.get(uuid)
  return name
    ? <span title={uuid}>{name}</span>
    : <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} title={uuid}>{shortUuid(uuid)}</span>
}

function CountTable({ title, icon, rows, names, empty }) {
  return (
    <div className="pg-card">
      <p className="pg-card-title"><i className={`fas ${icon} me-1`} />{title}</p>
      <table className="pg-table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Name</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={2} style={{ color: 'var(--color-ash)' }}>{empty}</td></tr>}
          {rows.map(r => (
            <tr key={r.uuid}><td><UuidName uuid={r.uuid} names={names} /></td><td style={{ textAlign: 'right' }}>{r.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActiveMatchInfo({ state, names }) {
  if (!state || state.loading) return <LoadingSpinner text="Loading match info…" />
  if (state.error) return <ErrorAlert message={state.error} />
  const info = state.info || {}
  const players = info.players || []
  return (
    <div style={{ fontSize: '0.8rem' }} data-testid="active-match-info">
      <div>Location: {info.currentLocationUuid ? <UuidName uuid={info.currentLocationUuid} names={names} /> : '—'}</div>
      <div>Players: {players.length}</div>
      {players.map(p => (
        <div key={p.uuid}>
          <span style={{ fontFamily: 'monospace' }}>{shortUuid(p.userUuid)}</span>{' '}
          life {p.lifeMax != null ? `${p.life}/${p.lifeMax}` : orDash(p.life)}
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [stories, setStories] = useState([])
  const [storyUuid, setStoryUuid] = useState('')
  const [from, setFrom] = useState(utcDay(-29))
  const [to, setTo] = useState(utcDay(0))
  const [groupBy, setGroupBy] = useState('day')
  const [report, setReport] = useState(null)
  const [names, setNames] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState({ loading: true, list: [], error: '' })
  const [opened, setOpened] = useState({}) // matchUuid -> { loading, info, error }

  const load = () => {
    setLoading(true)
    setError('')
    const params = { from, to, groupBy }
    if (storyUuid) params.storyUuid = storyUuid
    Promise.all([getKpiReport(params), fetchNames(storyUuid)])
      .then(([r, n]) => { setReport(r); setNames(n) })
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load the report'))
      .finally(() => setLoading(false))
    setActive({ loading: true, list: [], error: '' })
    setOpened({})
    fetchActiveMatches(storyUuid)
      .then(list => setActive({ loading: false, list, error: '' }))
      .catch(e => setActive({ loading: false, list: [], error: e.message || 'Failed to load the active matches' }))
  }

  useEffect(() => {
    listAllStories('en').then(list => setStories(Array.isArray(list) ? list : [])).catch(() => setStories([]))
    load()
  }, [])

  // /info is read only when the row is opened, and only once.
  const toggle = (uuid) => {
    if (opened[uuid]) {
      setOpened(prev => { const next = { ...prev }; delete next[uuid]; return next })
      return
    }
    setOpened(prev => ({ ...prev, [uuid]: { loading: true } }))
    getMatchInfo(uuid)
      .then(info => setOpened(prev => ({ ...prev, [uuid]: { loading: false, info } })))
      .catch(e => setOpened(prev => ({ ...prev, [uuid]: { loading: false, error: e.message || 'Failed to load the match' } })))
  }

  return (
    <div>
      <h2 className="pg-page-title"><i className="fas fa-chart-line" />Reports</h2>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label htmlFor="kpiStory" style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>Story</label>
        <select id="kpiStory" className="pg-input" style={{ width: 'auto' }} value={storyUuid}
          onChange={e => setStoryUuid(e.target.value)}>
          <option value="">All stories</option>
          {stories.map(s => <option key={s.uuid} value={s.uuid}>{s.title || s.uuid}</option>)}
        </select>
        <label htmlFor="kpiFrom" style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>From</label>
        <input id="kpiFrom" className="pg-input" style={{ width: 'auto' }} type="date" value={from}
          onChange={e => setFrom(e.target.value)} />
        <label htmlFor="kpiTo" style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>To</label>
        <input id="kpiTo" className="pg-input" style={{ width: 'auto' }} type="date" value={to}
          onChange={e => setTo(e.target.value)} />
        <label htmlFor="kpiGroup" style={{ color: 'var(--color-ash)', fontSize: '0.85rem' }}>Group by</label>
        <select id="kpiGroup" className="pg-input" style={{ width: 'auto' }} value={groupBy}
          onChange={e => setGroupBy(e.target.value)}>
          <option value="day">Day</option>
          <option value="month">Month</option>
          <option value="total">Total</option>
        </select>
        <button className="pg-btn pg-btn-primary" onClick={load} disabled={loading}>
          <i className="fas fa-sync-alt" /> Load
        </button>
      </div>

      <p style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} data-testid="kpi-help">
        Counters are written when the event happens, per UTC day, and are never rolled back:
        a match restored from a snapshot that reaches the end again is counted again
        (completion, durations, choices, visits and missions alike). An admin stop is not a completion.
      </p>
      {!storyUuid && (
        <p style={{ color: 'var(--color-ash)', fontSize: '0.8rem' }} data-testid="kpi-all-stories-note">
          <i className="fas fa-info-circle me-1" />
          With "All stories" the totals may differ by backend: the counters of deleted stories
          are included on Java and Python, excluded on AWS.
        </p>
      )}

      <ErrorAlert message={error} onClose={() => setError('')} />
      {loading && <LoadingSpinner text="Loading the report…" />}

      {!loading && report && (
        <>
          <div className="pg-card mb-4">
            <p className="pg-card-title"><i className="fas fa-table me-1" />KPI ({report.from} → {report.to})</p>
            <table className="pg-table" style={{ fontSize: '0.82rem' }} data-testid="kpi-table">
              <thead>
                <tr>
                  <th>Period</th><th>Started</th><th>Completed</th><th>Completion</th>
                  <th>Avg minutes</th><th>Avg clocks</th><th>Comas</th>
                </tr>
              </thead>
              <tbody>
                {(report.rows || []).map(r => (
                  <tr key={r.period}>
                    <td>{r.period}</td><td>{r.matchesStarted}</td><td>{r.matchesCompleted}</td>
                    <td>{percent(r.completionRate)}</td><td>{orDash(r.avgDurationMinutes)}</td>
                    <td>{orDash(r.avgDurationClocks)}</td><td>{r.comaCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <CountTable title="Choices" icon="fa-code-branch" rows={report.choices || []} names={names} empty="No choice made." />
            <CountTable title="Locations (first visits)" icon="fa-map-marker-alt" rows={report.locations || []} names={names} empty="No location visited." />
            <div className="pg-card">
              <p className="pg-card-title"><i className="fas fa-tasks me-1" />Missions</p>
              <table className="pg-table" style={{ fontSize: '0.82rem' }}>
                <thead><tr><th>Name</th><th>Active</th><th>Completed</th><th>Failed</th></tr></thead>
                <tbody>
                  {(report.missions || []).length === 0 && <tr><td colSpan={4} style={{ color: 'var(--color-ash)' }}>No mission moved.</td></tr>}
                  {(report.missions || []).map(m => (
                    <tr key={m.uuid}>
                      <td><UuidName uuid={m.uuid} names={names} /></td>
                      <td>{m.activated}</td><td>{m.completed}</td><td>{m.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="pg-card">
        <p className="pg-card-title"><i className="fas fa-gamepad me-1" />Active matches (running and paused)</p>
        {active.loading && <LoadingSpinner text="Loading the active matches…" />}
        <ErrorAlert message={active.error} />
        {!active.loading && !active.error && (
          <table className="pg-table" style={{ fontSize: '0.82rem' }} data-testid="active-matches">
            <thead><tr><th>Match</th><th>Status</th><th>Clock</th><th>Story</th><th /></tr></thead>
            <tbody>
              {active.list.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--color-ash)' }}>No match is being played.</td></tr>}
              {active.list.map(m => (
                <tr key={m.uuid}>
                  <td>{m.name || shortUuid(m.uuid)}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{m.currentClock ?? 0}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{shortUuid(m.storyUuid)}</td>
                  <td>
                    <button className="pg-btn pg-btn-ghost" onClick={() => toggle(m.uuid)} aria-label={`Details of ${m.uuid}`}>
                      <i className={`fas ${opened[m.uuid] ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                    </button>
                    {opened[m.uuid] && <ActiveMatchInfo state={opened[m.uuid]} names={names} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
