# Paths Games V2 - Roadmap

**V2 — gamma: a living world.** Draft plan of the third version: 42 steps released as `2.N.0`.
Rules in [Version Template](../VersionTemplate.md), all versions in the
[Global Roadmap](../Roadmap.md), ideas in the [Backlog](../Backlog.md).
If the work exceeds 42 steps, the last feature steps move to V3.

Shared references: [Game Rules](../GameRules.md) (no combat, also with NPCs),
[Data Model](../DataModel.md), [Story Format](../StoryFormat.md),
[Security](../Security.md).

- **Steps 1-2**: Steam SSO. **Steps 3-7**: campaigns with the global registry.
- **Steps 8-12**: timed missions, silent events, warehouse. **Steps 13-16**: advanced analytics and replay.
- **Steps 17-27**: NPCs, entities, open world. **Steps 28-31**: noise and stealth, user progression.
- **Steps 32-34**: advanced inventory, temporary effects, location fatigue (if space).
- **Steps 35-39**: reserved. **Steps 40-42**: recurring hardening, migration from beta, gamma launch.


# Steps

1. **Steam SSO — backend** — login with Steam on all three backends.
    - Steam OpenID 2.0 flow (different from Google OAuth) (backend)
    - New provider in the identity table prepared in V1 (backend)
    - Link Steam to an existing logged user; two accounts that are already separate stay separate (backend)
    - OpenAPI spec (backend)
    - Unit tests with provider mocks (tests)
2. **Steam SSO — frontend and E2E** — sign in with Steam.
    - Steam sign-in button and callback (frontend)
    - "Link Steam" action in the profile (frontend)
    - Privacy check for the new provider (docs)
    - Robot suite with a mocked provider (tests)
    - Unit tests (tests)
3. **Campaigns — analysis** — stories connected in a path.
    - Define a campaign: ordered or branching list of stories (docs)
    - What carries over between stories: characters, items, registry keys (docs)
    - Global registry design: keys shared across stories, per user (docs)
    - Update [Game Rules](../GameRules.md) and [Data Model](../DataModel.md) (docs)
    - List of doubts for the owner (docs)
4. **Global registry** — registry keys that survive a single story.
    - Schema and DynamoDB layout for global keys (backend)
    - Read and write rules from events, choices and missions (backend)
    - Operators reuse the existing registry evaluation (backend)
    - Admin view of global keys (frontend)
    - Unit tests and Robot suite (tests)
5. **Campaigns — engine** — move from one story to the next.
    - Campaign tables and import format (backend)
    - Story transition at story end, with carry-over rules (backend)
    - Campaign progress per user (backend)
    - Validation rules for campaigns (backend)
    - Unit tests (tests)
6. **Campaigns — authoring** — build campaigns in react-admin.
    - Campaign CRUD endpoints (backend)
    - Campaign editor in react-admin (frontend)
    - Campaign import and export (backend)
    - Update [Story Format](../StoryFormat.md) (docs)
    - Unit tests and Robot checks (tests)
7. **Campaigns — react-game** — play a campaign.
    - Campaign catalog and detail pages (frontend)
    - Campaign progress in the user's book (frontend)
    - Transition page between stories (frontend)
    - Unit tests (tests)
    - Robot suite: a two-story campaign played end to end (tests)
8. **Timed missions — engine** — missions that expire.
    - Expiry by game clock on missions (backend)
    - `FAILED` on expiry with its effects (backend)
    - Story format and validation (backend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests (tests)
9. **Timed missions — frontend** — see the remaining time.
    - Remaining time on mission cards (frontend)
    - Warning when a mission is about to expire (frontend)
    - react-admin editor fields (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
10. **Silent events** — events with effects and no narrative text.
    - Event flag for silent execution (backend)
    - Engine applies effects without showing a page (backend)
    - Frontend shows only the resulting changes (frontend)
    - Story format and validation (backend)
    - Unit tests and Robot suite (tests)
11. **Warehouse — engine** — store items outside the backpack.
    - Warehouse model: where it is, capacity, owner (party or character) (backend)
    - Deposit and withdraw actions with their costs (backend)
    - Weight rules (backend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
12. **Warehouse — frontend** — manage stored items.
    - Warehouse page in the book (frontend)
    - Deposit and withdraw dialogs (frontend)
    - react-admin configuration of warehouses (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
13. **Advanced analytics — analysis** — beyond the basic KPI report.
    - Choose client-side vs server-side analytics (docs)
    - Privacy impact and consent (docs)
    - Metrics list: undiscovered events, choices and locations; abandonment timing; death analysis (docs)
    - Storage and cost on DynamoDB and SQL (docs)
    - List of doubts for the owner (docs)
14. **Advanced analytics — backend** — collect the new metrics.
    - New counters and aggregates (backend)
    - Report endpoints with date ranges (backend)
    - Scheduled jobs only if really needed (backend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
15. **Advanced analytics — report pages** — show them in react-admin.
    - Story heat map of discovered and undiscovered content (frontend)
    - Abandonment and death charts (frontend)
    - Export to CSV (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
16. **Admin replay viewer** — step through a match history.
    - Replay endpoint returning ordered logs with state changes (backend)
    - Filtered logs by character, item, event (backend)
    - Replay viewer page in react-admin (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
17. **NPC — analysis** — non-player characters without combat.
    - Static NPCs (merchant, guide) and wandering NPCs (docs)
    - Interaction model through events, choices and registry (docs)
    - Data model and story format proposal (docs)
    - Update [Game Rules](../GameRules.md) (docs)
    - List of doubts for the owner (docs)
18. **NPC — static NPCs** — characters that live in a location.
    - NPC tables and import (backend)
    - NPC presence in location info (backend)
    - Interactions as events and choices (backend)
    - Unit tests (tests)
    - Robot suite (tests)
19. **NPC — merchants** — buy and sell.
    - Merchant inventory and prices (backend)
    - Buy and sell actions with coins (backend)
    - Merchant dialog in react-game (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
20. **NPC — wandering NPCs** — characters that move.
    - Movement rules at time-start, seeded by the match `rng_seed` (backend)
    - Encounters when sharing a location (backend)
    - Logs of NPC movements (backend)
    - Unit tests (tests)
    - Robot suite (tests)
21. **NPC — authoring and display** — build and show NPCs.
    - NPC editor in react-admin (frontend)
    - NPC cards in react-game (frontend)
    - Validation rules (backend)
    - Update [Story Format](../StoryFormat.md) (docs)
    - Unit tests (tests)
22. **Entities — analysis** — world elements with their own state.
    - Define entities (doors, machines, animals, …) and how they differ from items and NPCs (docs)
    - State, triggers and effects (docs)
    - Data model proposal (docs)
    - List of doubts for the owner (docs)
    - Update [Game Rules](../GameRules.md) (docs)
23. **Entities — engine and authoring** — use entities in stories.
    - Entity tables and import (backend)
    - Entity state changes from events and choices (backend)
    - react-admin editor and react-game display (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
24. **Open world — analysis** — exploration beyond a linear map.
    - Scope: large maps, regions, free exploration (docs)
    - Performance and payload limits of big maps (docs)
    - Data model and loading strategy (docs)
    - List of doubts for the owner (docs)
    - Decide what overflows to V3 (docs)
25. **Open world — map model** — regions and large maps.
    - Regions and region links (backend)
    - Partial loading of the map around the party (backend)
    - Import format for large maps (backend)
    - Unit tests (tests)
    - Robot suite on a large test map (tests)
26. **Open world — engine** — movement and events at scale.
    - Movement between regions (backend)
    - Region-level events and weather (backend)
    - Performance checks on DynamoDB and SQL (backend)
    - Unit tests (tests)
    - Robot suite (tests)
27. **Open world — react-game map** — show the world.
    - Region map with zoom and fog-of-war (frontend)
    - Navigation between regions (frontend)
    - Mobile layout (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
28. **Noise — engine** — actions make noise.
    - Noise counter per location (backend)
    - Noise from actions and its decay over time (backend)
    - Noise-triggered negative events (backend)
    - Story format and validation (backend)
    - Unit tests (tests)
29. **Stealth — engine and UI** — move without being noticed.
    - Stealth actions and their costs (backend)
    - Interaction between stealth, noise and NPCs (backend)
    - Noise and stealth indicators in react-game (frontend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests and Robot suite (tests)
30. **User progression — backend** — rewards across matches.
    - Rewards earned at match completion (backend)
    - Cross-match progression per user (backend)
    - Initial experience bonuses for new matches (backend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
31. **User progression — frontend** — show what the user earned.
    - Progression page in the profile (frontend)
    - Cosmetics selection for future matches (frontend)
    - Reward page at match end (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
32. **Advanced inventory (if space)** — hands and equipment.
    - Hand/equipped items and backpack (backend)
    - Two-item hand limit and equipping requirements (backend)
    - Swap action between hand and backpack (backend)
    - Inventory UI with hands (frontend)
    - Unit tests and Robot suite (tests)
33. **Temporary effects (if space)** — modifiers that last some actions or times.
    - Effects like "+1 DEX for the next 2 actions" or "paralysed until time 5" (backend)
    - Expiry by action count or clock (backend)
    - Active effects shown on the character card (frontend)
    - Story format and validation (backend)
    - Unit tests and Robot suite (tests)
34. **Location fatigue and anti-spam (if space)** — over-used places and actions lose value.
    - Location fatigue: fewer useful events in over-visited locations (backend)
    - Anti-spam counter that grows with excessive actions (backend)
    - Effects on probabilities or energy costs (backend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests and Robot suite (tests)
35. **Reserved**
36. **Reserved**
37. **Reserved**
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Security review of Steam SSO, campaigns, analytics and new mechanics (all)
    - Dependency scan and secrets review (all)
    - KPI report updated with the new mechanics (backend, frontend)
    - Performance check of open world endpoints (backend)
    - Unit tests and Robot suites (tests)
41. **Migration from beta and privacy check** — recurring.
    - Migration of users, stories and progression from beta to gamma (infra)
    - Privacy check: policy, consent, analytics data (all)
    - Dry run and rollback plan (docs)
    - Verify migrated data with Robot suites (tests)
    - Update [Environments](../Environments.md) (docs)
42. **Gamma launch** — recurring.
    - New stage `gamma`: own AWS stack, bucket and site; `gamma.paths.games`, `gamma-api.paths.games` (infra)
    - Content license check (docs)
    - i18n check (EN, IT) (frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the gamma version plan | September 25, 2026 |

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
