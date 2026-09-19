/**
 * Runtime configuration read from k6 environment variables (-e KEY=VALUE).
 * Every value has a dev-friendly default so `k6 run` works against local Java.
 */

function env(name, fallback) {
  const v = __ENV[name];
  return v === undefined || v === '' ? fallback : v;
}

function intEnv(name, fallback) {
  const n = parseInt(env(name, ''), 10);
  return Number.isNaN(n) ? fallback : n;
}

export const config = {
  baseUrl: env('BASE_URL', 'http://localhost:8042').replace(/\/+$/, ''),
  adminBaseUrl: env('ADMIN_BASE_URL', 'http://localhost:8044').replace(/\/+$/, ''),
  adminToken: env('ADMIN_TOKEN', ''),
  jwtSecret: env('JWT_SECRET', 'PathsGamesDevSecret2026_MustBeAtLeast32Chars!'),
  tutorialUuid: env('TUTORIAL_UUID', 'story-001'),
  tutorialFile: env('TUTORIAL_FILE', '../data/tutorial_story.json'),
  lang: env('STORY_LANG', 'en'),
  moves: intEnv('MOVES', 5),
  // events executed per flow (the first `available` one at the current location), 0 = none
  events: intEnv('EVENTS', 1),
  // 1 = one sleep per flow: halfway through the moves, or as soon as the energy runs out
  sleep: env('SLEEP', '1') === '1',
  thinkMs: intEnv('THINK_MS', 0),
  cleanup: env('CLEANUP', '0') === '1',
  testMarker: env('TEST_MARKER', 'robottest'),
  // Turnstile bypass token (TURNSTILE_BYPASS_TOKEN on the backend, non-prod only)
  turnstileToken: env('TURNSTILE_TOKEN', ''),
  vus: intEnv('VUS', 1),
  iterations: intEnv('ITERATIONS', 1),
  maxDuration: env('MAX_DURATION', '10m'),
  // Threshold values (Roadmap Step 93: p95 < 2s)
  maxErrorRate: env('MAX_ERROR_RATE', '0.05'),
  maxP95Ms: env('MAX_P95_MS', '2000'),
};

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function bearer(token, extra) {
  return Object.assign({ Authorization: `Bearer ${token}` }, JSON_HEADERS, extra || {});
}
