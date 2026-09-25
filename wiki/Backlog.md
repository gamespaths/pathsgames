# Backlog

Feature ideas and where they are planned. Items with a version are already placed in that
version's roadmap; items marked "Not planned" wait for a decision. The original list comes from
[Step03 — Define scope](documentation_v0/Step03_DefineScope.md) §2 (excluded features).

## 1. Feature map

| Feature | Short description | Version | Notes |
|---------|-------------------|---------|-------|
| Tutorial and first-time hints | Tips on card pages, first-time guidance | V0 (step 40) | |
| Multi-value registry | Several values per registry key | Done (v0.36.1) | |
| Reproducible randomness | Per-match seed for all random draws, replay | V4 (step 2) | `rng_seed` already drives weather and random events since v0.27 |
| Permanent death and game over | Individual character death | V1 | Death KPI added with it |
| Silent events | Events with effects only, no narrative text | V2 | |
| Warehouse | Place to store items outside the backpack | V2 | |
| Timed missions | Missions that expire after some time | V2 | |
| Campaigns | Several stories connected in a path | V2 | Built together with the global registry |
| Global registry | Registry keys shared across stories | V2 | |
| Analytics (advanced) | Undiscovered content, abandonment timing, death analysis | V2 | Basic KPI report in V0 step 41 |
| NPC system | Static and wandering characters, interactions | V2 | No combat |
| Entities | Non-player world elements with their own state | V2 | |
| Open world | Exploration beyond a single linear story map | V2 | May overflow to V3 |
| Noise and stealth | Noise counter per location, stealth mechanics | V2 | |
| User progression | Rewards and bonuses across matches | V2 | |
| Advanced inventory | Hand/equipped items, two-hand limit | V2 (if space) | |
| Temporary effects (advanced) | "+1 DEX for 2 actions", "paralysed until time 5" | V2 (if space) | |
| Location fatigue / anti-spam | Over-visited places become sterile; action spam penalties | V2 (if space) | |
| Free actions | Limited free actions per time | V3 | Low priority |
| Event/choice blocked when the user HAS an item or key | Negative conditions | V1 (to evaluate) | Choices already support `!=` in Java |
| Audio | Background music (optional) in V1; sound effects and text reader later | V1 / V2 | Capacity driven |
| Anti-stall rules | Stall detection, inactivity penalties | V4 | Same feature as stalemate detection |
| Player signal system | Quick pings: "follow me", "danger", "help" | V5 | |
| Voting system | Group vote on critical choices | V5 | |
| Group rituals | Actions needing several characters together | V5 | |
| Spectator mode | Watch matches, rate matches and stories | V5 | |
| Combat system | Fights between characters or creatures | Not planned | Never before multiplayer |
| Crowdfunding in-game rewards | Backer rewards inside the game | Not planned | See [Don't think about](./DontThinkAbout.md) |

## 2. Open analyses

| Topic | Version | Notes |
|-------|---------|-------|
| Test ACM certificate and environment variables | V0 step 41 (analysis), V1 (env refactor) | Result goes in [Environments](./Environments.md) |
| DynamoDB single-table split (users, stories, matches, logs) | V1 | Logs table first, the rest only analysed |
| Distributed lock for scheduled jobs on several instances | V6 | e.g. ShedLock for Java |

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First backlog with every feature and its version | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
