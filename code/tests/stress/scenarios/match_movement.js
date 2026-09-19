/**
 * Main stress scenario: each VU plays guest -> create match -> join -> start -> MOVES
 * movements from the tutorial's first location, running up to EVENTS available events on the
 * way and (SLEEP=1) one sleep halfway or when the energy runs out. Run setup_tutorial.js first.
 */
import { sleep, fail } from 'k6';
import exec from 'k6/execution';
import { config } from '../lib/config.js';
import { guestToken } from '../lib/auth.js';
import { tutorialPresent, storyLoadout } from '../lib/story.js';
import {
  createMatch, joinMatch, startMatch, readLocation, move, executeEvent, sleep as sleepAction,
  devCleanup, flowsCompleted, flowsFailed, movesSkippedEnergy,
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
  console.log(`Loadout: ${JSON.stringify(loadout)} | VUs=${config.vus} iterations=${config.iterations} moves=${config.moves} events=${config.events} sleep=${config.sleep}`);
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

  // One sleep per flow: planned after the first half of the moves, or earlier when a move
  // answers INSUFFICIENT_ENERGY. Once slept, a second energy refusal ends the walk quietly.
  let slept = !config.sleep;
  let eventsLeft = config.events;
  const sleepAfter = Math.max(1, Math.floor(config.moves / 2));
  for (let i = 0; i < config.moves; i++) {
    const loc = readLocation(token, matchUuid);
    if (!loc) return abortFlow(`info #${i}`);
    if (eventsLeft > 0 && loc.event) {
      if (!executeEvent(token, matchUuid, loc.event)) return abortFlow(`event #${i}`);
      eventsLeft--;
      think();
    }
    const outcome = move(token, matchUuid, loc.neighbor);
    if (outcome === 'failed') return abortFlow(`move #${i}`);
    if (outcome === 'no_energy') {
      if (slept) { movesSkippedEnergy.add(config.moves - i); break; }
      if (!sleepAction(token, matchUuid)) return abortFlow(`sleep #${i}`);
      slept = true;
      i--; // retry this move on the fresh energy
      think();
      continue;
    }
    think();
    if (!slept && i + 1 === sleepAfter) {
      if (!sleepAction(token, matchUuid)) return abortFlow(`sleep #${i}`);
      slept = true;
      think();
    }
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
