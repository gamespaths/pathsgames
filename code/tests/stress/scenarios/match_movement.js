/**
 * Main stress scenario: each VU plays guest -> create match -> join -> start
 * -> MOVES movements from the tutorial's first location. Run setup_tutorial.js first.
 */
import { sleep, fail } from 'k6';
import exec from 'k6/execution';
import { config } from '../lib/config.js';
import { guestToken } from '../lib/auth.js';
import { tutorialPresent, storyLoadout } from '../lib/story.js';
import {
  createMatch, joinMatch, startMatch, firstNeighbor, move, devCleanup,
  flowsCompleted, flowsFailed,
} from '../lib/match.js';

export const options = {
  scenarios: {
    match_movement: {
      executor: 'per-vu-iterations',
      vus: config.vus,
      iterations: config.iterations,
      maxDuration: config.maxDuration,
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: [`rate<${config.maxErrorRate}`],
    http_req_duration: [`p(95)<${config.maxP95Ms}`],
    checks: ['rate>0.95'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Runs once: verify tutorial and resolve the loadout shared by every VU
export function setup() {
  if (!tutorialPresent()) {
    exec.test.abort(`tutorial ${config.tutorialUuid} missing on ${config.baseUrl}: run scenarios/setup_tutorial.js first`);
  }
  const loadout = storyLoadout();
  console.log(`Loadout: ${JSON.stringify(loadout)} | VUs=${config.vus} iterations=${config.iterations} moves=${config.moves}`);
  return loadout;
}

function think() {
  if (config.thinkMs > 0) sleep(config.thinkMs / 1000);
}

export default function (loadout) {
  const vu = exec.vu.idInTest;
  const iter = exec.vu.iterationInScenario;
  const name = `${config.testMarker}_stress_${vu}_${iter}`;

  const token = guestToken();
  if (!token) return abortFlow('guest auth');
  think();

  const matchUuid = createMatch(token, loadout, name);
  if (!matchUuid) return abortFlow('create match');
  think();

  if (!joinMatch(token, matchUuid, loadout)) return abortFlow('join');
  think();

  if (!startMatch(token, matchUuid)) return abortFlow('start');
  think();

  for (let i = 0; i < config.moves; i++) {
    const target = firstNeighbor(token, matchUuid);
    if (!target) return abortFlow(`info #${i}`);
    if (!move(token, matchUuid, target)) return abortFlow(`move #${i}`);
    think();
  }
  flowsCompleted.add(1);
}

function abortFlow(step) {
  flowsFailed.add(1);
  fail(`flow aborted at ${step}`);
}

export function teardown() {
  if (config.cleanup) devCleanup();
}
