/**
 * Match lifecycle helpers: create -> join -> start -> info -> move.
 * Each call records a check and a per-step Trend (step_<name>_ms).
 */
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { config, bearer } from './config.js';
import { safeJson } from './auth.js';

export const trends = {
  auth: new Trend('step_auth_ms', true),
  match_create: new Trend('step_match_create_ms', true),
  join: new Trend('step_join_ms', true),
  start: new Trend('step_start_ms', true),
  info: new Trend('step_info_ms', true),
  move: new Trend('step_move_ms', true),
};
export const movesDone = new Counter('moves_done');
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
  const res = timed('match_create', http.post(`${config.baseUrl}/api/matches`, body, {
    headers: bearer(token),
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

// GET /api/match/{uuid}/info -> uuid of the first exit of the current location
export function firstNeighbor(token, matchUuid) {
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
  return neighbors[0].uuid;
}

export function move(token, matchUuid, targetLocationUuid) {
  const body = JSON.stringify({ targetLocationUuid });
  const res = timed('move', http.post(`${config.baseUrl}/api/gameplay/${matchUuid}/movements/start`, body, {
    headers: bearer(token),
    tags: { step: 'move' },
  }));
  const ok = check(res, { 'move 200': (r) => r.status === 200 });
  if (ok) movesDone.add(1);
  else console.warn(`move failed: ${res.status} ${res.body}`);
  return ok;
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
