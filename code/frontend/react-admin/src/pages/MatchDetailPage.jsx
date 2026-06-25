import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMatchInfo, getMatchClock, getMatchWeather, getMatchLocations, stopMatch, pauseMatch, resumeMatch, deleteMatch } from '../api/matchApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmModal from '../components/common/ConfirmModal'
import { shortUuid, StatusBadge, fetchStoryCtx } from '../components/match/MatchDetailModal'
import TurnOrderPanel from '../components/match/TurnOrderPanel'
import MatchDetailTabs from '../components/match/detail/MatchDetailTabs'
import MatchConfigCard from '../components/match/detail/MatchConfigCard'
import ClockStatusCard from '../components/match/detail/ClockStatusCard'
import PlayersCard from '../components/match/detail/PlayersCard'
import WeatherCard from '../components/match/detail/WeatherCard'
import LocationStateCard from '../components/match/detail/LocationStateCard'
import RegistryCard from '../components/match/detail/RegistryCard'
import EditStatsModal from '../components/match/detail/EditStatsModal'
import { TERMINAL, STATUS_COLOR, findByUuid, resolveEntityName, name20 } from '../components/match/detail/matchDetailShared'

/**
 * MatchDetailPage — Step 21 admin match details page (/matches/:uuid).
 *
 * The sections (configuration, players, weather, locations, registry, turn order)
 * are laid out as tabs, defaulting to "Match configuration". Each section is its
 * own component under components/match/detail/. This page is the container: it
 * loads the data, owns the resolvers/handlers, and renders the active tab.
 */

const DETAIL_TABS = [
  { id: 'config',    label: 'Match configuration', icon: 'fa-sliders-h' },
  { id: 'players',   label: 'Players',             icon: 'fa-users' },
  { id: 'weather',   label: 'Weather',             icon: 'fa-cloud-sun-rain' },
  { id: 'locations', label: 'Locations',           icon: 'fa-map' },
  { id: 'registry',  label: 'Registry',            icon: 'fa-list' },
  { id: 'turn',      label: 'Turn order',          icon: 'fa-list-ol' },
]

export default function MatchDetailPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [info, setInfo]               = useState(null)
  const [storyCtx, setStoryCtx]       = useState(null)
  const [clock, setClock]             = useState(null)
  const [weather, setWeather]         = useState(null)
  const [movement, setMovement]       = useState(null) // Step 28 — visited locations + move costs

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState('')
  const [confirm, setConfirm]             = useState(null) // { title, message, onConfirm }
  const [statsModal, setStatsModal]       = useState(null) // player object being edited
  const [tab, setTab]                     = useState('config')

  const loadInfo = useCallback(() => {
    setLoading(true)
    setError('')
    getMatchInfo(uuid)
      .then(async (data) => {
        setInfo(data)
        const ctx = await fetchStoryCtx(data?.match?.storyUuid)
        setStoryCtx(ctx)
      })
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load match'))
      .finally(() => setLoading(false))
    // Clock / weather / movement views live behind newer admin endpoints; tolerate
    // their absence (older backends) by hiding the panel rather than erroring.
    getMatchClock(uuid).then(setClock).catch(() => setClock(null))
    getMatchWeather(uuid).then(setWeather).catch(() => setWeather(null))
    getMatchLocations(uuid).then(setMovement).catch(() => setMovement(null))
  }, [uuid])

  useEffect(() => { loadInfo() }, [loadInfo])

  const match   = info?.match
  const status  = match?.status ?? ''
  const isTerminalStatus = TERMINAL.has(status)
  const texts   = storyCtx?.texts || []
  const players = info?.players || []
  const colors  = STATUS_COLOR[status] || STATUS_COLOR.CREATED
  const rngSeed = (weather?.rngSeed ?? match?.rngSeed) ?? null

  const resolveName = (list, entityUuid) => resolveEntityName(texts, findByUuid(list, entityUuid))
  const templateName   = u => resolveName(storyCtx?.characters,   u) || (u ? shortUuid(u) : '—')
  const className       = u => resolveName(storyCtx?.classes,      u) || (u ? shortUuid(u) : '—')
  const difficultyName = u => resolveName(storyCtx?.difficulties, u) || (u ? shortUuid(u) : '—')
  const traitName      = u => resolveName(storyCtx?.traits,       u) || (u ? shortUuid(u) : u)

  // Step 28 — movement data keyed by story location id, and a location-name
  // resolver (first 20 chars) by numeric id and/or story-location uuid.
  const movementByLoc = new Map((movement?.locations ?? []).map(m => [Number(m.idLocation), m]))
  const locationName20 = (idLocation, locUuid) => {
    const locs = storyCtx?.storyLocations || []
    const loc = (locUuid && findByUuid(locs, locUuid))
      || (idLocation != null && locs.find(x => Number(x.id) === Number(idLocation)))
      || null
    return name20(resolveEntityName(texts, loc))
  }

  // Resolve a clock character (instance uuid) to its template name via the players list.
  const clockCharName = (characterUuid) => {
    const player = players.find(p => p.uuid === characterUuid)
    return player ? templateName(player.characterTemplateUuid) : shortUuid(characterUuid)
  }
  // Story clock label: singular at clock 1, plural otherwise (no label → blank).
  const clockLabel = (c) => (c.currentClock === 1 ? c.clockLabelSingular : c.clockLabelPlural) || ''

  async function runAction(fn, navigateAfter) {
    setActionLoading(true)
    setActionError('')
    try {
      await fn()
      if (navigateAfter) navigate('/matches')
      else loadInfo()
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Action failed')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  function handlePause()  { runAction(() => pauseMatch(uuid),  false) }
  function handleResume() { runAction(() => resumeMatch(uuid), false) }

  function handleStop() {
    setConfirm({
      title: 'Stop match',
      message: `Set match "${match?.name || shortUuid(uuid)}" status to ENDED? Players will no longer be able to continue.`,
      onConfirm: () => runAction(() => stopMatch(uuid), false),
    })
  }

  function handleDelete() {
    setConfirm({
      title: 'Delete match',
      message: `Permanently delete match "${match?.name || shortUuid(uuid)}" and all its data? This cannot be undone.`,
      onConfirm: () => runAction(() => deleteMatch(uuid), true),
    })
  }

  return (
    <div>
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}
      {statsModal && (
        <EditStatsModal
          matchUuid={uuid}
          player={statsModal}
          onClose={() => setStatsModal(null)}
          onSaved={() => loadInfo()}
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <button className="pg-btn pg-btn-ghost" onClick={() => navigate('/matches')}>
          <i className="fas fa-arrow-left" /> Matches
        </button>
        <h2 className="pg-page-title" style={{ margin: 0 }}>
          <i className="fas fa-gamepad" />
          {match?.name || `Match ${shortUuid(uuid)}`}
        </h2>
        {match && <StatusBadge status={match.status} />}
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingSpinner text="Loading match…" />
      ) : info && (
        <>
          <MatchDetailTabs tabs={DETAIL_TABS} activeTab={tab} onSelect={setTab} />

          {tab === 'config' && (
            <>
              <MatchConfigCard
                match={match}
                info={info}
                status={status}
                colors={colors}
                isTerminalStatus={isTerminalStatus}
                actionLoading={actionLoading}
                actionError={actionError}
                difficultyName={difficultyName}
                rngSeed={rngSeed}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onDelete={handleDelete}
              />
              <ClockStatusCard clock={clock} clockLabel={clockLabel} clockCharName={clockCharName} />
            </>
          )}

          {tab === 'players' && (
            <PlayersCard
              players={players}
              templateName={templateName}
              className={className}
              traitName={traitName}
              onEditStats={setStatsModal}
            />
          )}

          {tab === 'weather' && (
            <WeatherCard weather={weather} match={match} texts={texts} />
          )}

          {tab === 'locations' && (
            <LocationStateCard
              info={info}
              players={players}
              movementByLoc={movementByLoc}
              locationName20={locationName20}
              templateName={templateName}
            />
          )}

          {tab === 'registry' && (
            <RegistryCard registry={info.registry} />
          )}

          {tab === 'turn' && (
            <div className="mb-4">
              <TurnOrderPanel players={players} nameOf={templateName} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
