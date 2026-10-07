/**
 * Story helpers: check/import the tutorial via the admin API and
 * read the loadout (difficulty, template, class) needed to open a match.
 */
import http from 'k6/http';
import { check } from 'k6';
import { config, bearer, JSON_HEADERS } from './config.js';
import { adminToken, safeJson } from './auth.js';

// GET /api/stories -> true when the tutorial uuid is listed
export function tutorialPresent() {
  const res = http.get(`${config.baseUrl}/api/stories?lang=${config.lang}`, {
    headers: JSON_HEADERS,
    tags: { step: 'story_list' },
  });
  check(res, { 'stories 200': (r) => r.status === 200 });
  const list = safeJson(res);
  return Array.isArray(list) && list.some((s) => s.uuid === config.tutorialUuid);
}

// POST /api/admin/stories/import with the raw JSON (caller loads it with open() in init context)
export function importTutorial(storyJson) {
  const res = http.post(`${config.adminBaseUrl}/api/admin/stories/import`, storyJson, {
    headers: bearer(adminToken()),
    tags: { step: 'story_import' },
    timeout: '120s',
  });
  const ok = check(res, {
    'import 201': (r) => r.status === 201,
    'import status IMPORTED': (r) => safeJson(r).status === 'IMPORTED',
  });
  if (!ok) {
    console.error(`Tutorial import failed: HTTP ${res.status} ${res.body}`);
  }
  return ok;
}

// GET /api/stories/{uuid} -> uuids of the first difficulty / template / class
export function storyLoadout() {
  const res = http.get(`${config.baseUrl}/api/stories/${config.tutorialUuid}?lang=${config.lang}`, {
    headers: JSON_HEADERS,
    tags: { step: 'story_detail' },
  });
  check(res, { 'story detail 200': (r) => r.status === 200 });
  const s = safeJson(res);
  const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0].uuid : null);
  const loadout = {
    storyUuid: config.tutorialUuid,
    difficultyUuid: first(s.difficulties),
    templateUuid: first(s.characterTemplates),
    classUuid: first(s.classes),
  };
  if (!loadout.difficultyUuid || !loadout.templateUuid) {
    throw new Error(`Tutorial ${config.tutorialUuid} has no difficulty/template: ${JSON.stringify(loadout)}`);
  }
  return loadout;
}
