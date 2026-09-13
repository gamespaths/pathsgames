/**
 * Ensures the tutorial story is present on the target backend:
 * lists stories and imports data/tutorial_story.json when missing.
 */
import exec from 'k6/execution';
import { config } from '../lib/config.js';
import { tutorialPresent, importTutorial, storyLoadout } from '../lib/story.js';

// open() must run in init context; this script is run with a single VU
const TUTORIAL_JSON = open(config.tutorialFile);

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  if (tutorialPresent()) {
    console.log(`Tutorial ${config.tutorialUuid} already present on ${config.baseUrl}`);
  } else {
    console.log(`Tutorial ${config.tutorialUuid} missing, importing via ${config.adminBaseUrl}`);
    if (!importTutorial(TUTORIAL_JSON) || !tutorialPresent()) {
      exec.test.abort('tutorial import failed');
    }
  }
  const loadout = storyLoadout();
  console.log(`Loadout: ${JSON.stringify(loadout)}`);
}
