/**
 * Match lifecycle helpers: create -> join -> start -> info -> move / event / sleep.
 * Each call records a check and a per-step Trend (step_<name>_ms).
 */
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { config, bearer } from './config.js';
import { safeJson, csrfTokens } from './auth.js';

export const trends = {
  auth: new Trend('step_auth_ms', true),
  match_create: new Trend('step_match_create_ms', true),
  join: new Trend('step_join_ms', true),
  start: new Trend('step_start_ms', true),
  info: new Trend('step_info_ms', true),
  move: new Trend('step_move_ms', true),
  event: new Trend('step_event_ms', true),
  sleep: new Trend('step_sleep_ms', true),
};
export const movesDone = new Counter('moves_done');
export const eventsDone = new Counter('events_done');
export const sleepsDone = new Counter('sleeps_done');
// moves not attempted because the character had no energy left (and no sleep to spend)
export const movesSkippedEnergy = new Counter('moves_skipped_energy');
export const flowsCompleted = new Counter('flows_completed');
export const flowsFailed = new Counter('flows_failed');

function timed(step, res) {
  trends[step].add(res.timings.duration);
  return res;
}

export function createMatch(token, loadout, name) {
  const payload = { storyUuid: loadout.storyUuid, difficultyUuid: loadout.difficultyUuid, name };
  if (config.turnstileToken) payload.turnstileToken = config.turnstileToken;
  const body = JSON.stringify(payload);
  const csrf = csrfTokens[token];
  const res = timed('match_create', http.post(`${config.baseUrl}/api/matches`, body, {
    headers: bearer(token, csrf ? { 'X-CSRF-TOKEN': csrf } : undefined),
    tags: { step: 'match_create' },
  }));
  const ok = check(res, {
    'match 201': (r) => r.status === 201,
    'match has uuid': (r) => !!safeJson(r).uuid,
  });
  if (!ok) console.warn(`create match failed: ${res.status} ${res.body}`);
  return ok ? safeJson(res).uuid : null;
}

export function joinMatch(token, matchUuid, loadout) {
  const body = JSON.stringify({
    characterTemplateUuid: loadout.templateUuid,
    classUuid: loadout.classUuid,
    traitUuids: [],
  });
  const res = timed('join', http.post(`${config.baseUrl}/api/matches/${matchUuid}/join`, body, {
    headers: bearer(token),
    tags: { step: 'join' },
  }));
  const ok = check(res, { 'join 201': (r) => r.status === 201 });
  if (!ok) console.warn(`join failed: ${res.status} ${res.body}`);
  return ok;
}

export function startMatch(token, matchUuid) {
  const res = timed('start', http.post(`${config.baseUrl}/api/matches/${matchUuid}/start`, null, {
    headers: bearer(token),
    tags: { step: 'start' },
  }));
  const ok = check(res, {
    'start 200': (r) => r.status === 200,
    'start RUNNING': (r) => safeJson(r).status === 'RUNNING',
  });
  if (!ok) console.warn(`start failed: ${res.status} ${res.body}`);
  return ok;
}

// GET /api/match/{uuid}/info -> { neighbor, event }: the first exit of the current location
// and the first event the board marks `available` there (null when none). Null on failure.
export function readLocation(token, matchUuid) {
  const res = timed('info', http.get(`${config.baseUrl}/api/match/${matchUuid}/info?lang=${config.lang}`, {
    headers: bearer(token),
    tags: { step: 'info' },
  }));
  const ok = check(res, { 'info 200': (r) => r.status === 200 });
  if (!ok) {
    console.warn(`info failed: ${res.status} ${res.body}`);
    return null;
  }
  const info = safeJson(res);
  const active = info.locationsActive || [];
  const current = active.find((l) => l.uuid === info.currentLocationUuid) || active[0];
  const neighbors = (current && current.neighbors) || [];
  if (neighbors.length === 0) {
    console.warn(`no neighbors for match ${matchUuid} at ${info.currentLocationUuid}`);
    return null;
  }
  const event = ((current && current.events) || []).find((e) => e.available === true) || null;
  return { neighbor: neighbors[0].uuid, event: event ? event.uuid : null };
}

// Backward-compatible shortcut: uuid of the first exit only.
export function firstNeighbor(token, matchUuid) {
  const loc = readLocation(token, matchUuid);
  return loc ? loc.neighbor : null;
}

// POST /api/gameplay/{uuid}/movements/start -> 'ok' | 'no_energy' | 'failed'.
// 409 INSUFFICIENT_ENERGY is a game answer, not a backend fault: the flow sleeps or stops,
// and the 409 stays out of http_req_failed (any other 409 still fails the check below).
const MOVE_STATUSES = http.expectedStatuses({ min: 200, max: 299 }, 409);
export function move(token, matchUuid, targetLocationUuid) {
  const body = JSON.stringify({ targetLocationUuid });
  const res = timed('move', http.post(`${config.baseUrl}/api/gameplay/${matchUuid}/movements/start`, body, {
    headers: bearer(token),
    tags: { step: 'move' },
    responseCallback: MOVE_STATUSES,
  }));
  const noEnergy = res.status === 409 && safeJson(res).error === 'INSUFFICIENT_ENERGY';
  const ok = check(res, { 'move 200 (or 409 no energy)': (r) => r.status === 200 || noEnergy });
  if (res.status === 200) { movesDone.add(1); return 'ok'; }
  if (noEnergy) return 'no_energy';
  console.warn(`move failed: ${res.status} ${res.body}`);
  return 'failed';
}

// POST /api/gameplay/{uuid}/action/execute-event -> the event ran (200)
export function executeEvent(token, matchUuid, eventUuid) {
  const body = JSON.stringify({ eventUuid });
  const res = timed('event', http.post(`${config.baseUrl}/api/gameplay/${matchUuid}/action/execute-event?lang=${config.lang}`, body, {
    headers: bearer(token),
    tags: { step: 'event' },
  }));
  const ok = check(res, { 'event 200': (r) => r.status === 200 });
  if (ok) eventsDone.add(1);
  else console.warn(`event ${eventUuid} failed: ${res.status} ${res.body}`);
  return ok;
}

// POST /api/gameplay/{uuid}/action/sleep -> 200; single player: the clock advances at once
// (timeEndTriggered) and the character wakes at the next time-start with its energy back.
export function sleep(token, matchUuid) {
  const res = timed('sleep', http.post(`${config.baseUrl}/api/gameplay/${matchUuid}/action/sleep`, null, {
    headers: bearer(token),
    tags: { step: 'sleep' },
  }));
  const ok = check(res, {
    'sleep 200': (r) => r.status === 200,
    'sleep advanced the clock': (r) => safeJson(r).timeEndTriggered === true,
  });
  if (ok) sleepsDone.add(1);
  else console.warn(`sleep failed: ${res.status} ${res.body}`);
  return res.status === 200;
}

// POST /api/dev/cleanup (admin port, dev only) -> removes robottest* guests and matches
export function devCleanup() {
  const res = http.post(`${config.adminBaseUrl}/api/dev/cleanup`, null, {
    tags: { step: 'cleanup' },
    timeout: '300s',
  });
  if (res.status === 200) {
    console.log(`cleanup: ${res.body}`);
  } else {
    console.warn(`cleanup skipped: HTTP ${res.status} ${res.body}`);
  }
}
