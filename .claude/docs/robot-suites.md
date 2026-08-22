# Robot Framework suites, seeds and reports

Loaded on demand. Read only when working on E2E tests.

## Suite catalog — `code/tests/robot/tests/`

| Suite | Coverage |
|-------|----------|
| `01_smoke` | Basic connectivity |
| `12_auth` | Guest login, session management |
| `13_session_token` | Session token validation |
| `14_admin` | Admin guest management |
| `14_stories` | Story catalog |
| `15_story_content` | Story content APIs |
| `16_content_detail` | Content detail APIs |
| `17_admin_crud` | Admin CRUD for all story entities |
| `19_match` | Match creation and end flow; `duplicate_match_guard.robot` (v0.32.1, see below) |
| `20_admin_match` | Admin match control (stop/pause/resume) |
| `20_website` | Website/Turnstile captcha flow |
| `21_character_selection` | Character join, stat formula, backpack/traits |
| `22_story_validation` | Story import validation rules |
| `23_trait_selection` | Trait selection with class/cost/compatibility checks, and the v0.35.2 hidden traits |
| `24_turn_cycle` | Full turn cycle gameplay |
| `25_time_clock` | Active location seeding and time clock |
| `26_time_recovery` | Time-start stat recovery, counter re-seed, i18n lang on match info, i18n regression on `/api/stories?lang=` |
| `27_weather` | Weather system: random selection, effects, clock-linked roll, log |
| `28_movement` | Movement system (see breakdown below) |
| `29_events` | Step 29 normal events (see breakdown below) |
| `30_edge_states` | Step 30 sadness overflow / coma edge states |
| `31_choices` | Step 31 choice engine (see breakdown below) |
| `32_choice_resolution` | Step 32 choice resolution (see breakdown below) |
| `33_location_events` | Step 33 automatic location events (see breakdown below) |
| `34_inventory` | Steps 34/35 inventory, resources, use/drop, effects preview, quantities (see breakdown below) |

### `19_match` breakdown

`match_creation.robot` + `match_end.robot`, plus `duplicate_match_guard.robot`
(v0.32.1, 6 tests) — `POST /api/matches` answers 409 `ACTIVE_MATCH_ALREADY_EXISTS`
when the caller already owns a **CREATED / RUNNING / PAUSED** match on that story:
a paused match still blocks, an `Admin Stop Match` (→ ENDED) frees the story, another
guest is never blocked, a different story is not blocked (skipped when the seed's
second story has no locations), and an unknown story still answers 404 — the guard
runs last. Every case runs on **its own guest**, and the suite teardown stops and
deletes the matches it created.

Because of that guard, any suite creating two matches for one guest on the same story
now mints a guest per match via `Use A Fresh Guest Token` (`resources/auth.resource`;
rebinds `${TOKEN}`, test-scoped in a test and suite-scoped in a Suite Setup). Already
applied to 19_match, 20_website, 21, 23, 24, 25, 26, 27 and 28.

### `23_trait_selection` breakdown

`trait_selection.robot` — the four Step 23 refusals, plus five cases for `hideOnStartMatch`
(v0.35.2): the API keeps RETURNING a hidden trait on both projections that carry traits and
every trait carries the key, while selecting one is refused with `TRAIT_NOT_SELECTABLE` at
join and in the creator loadout alike (one validator, two doors), and a trait without the
flag stays pickable. The hidden trait is found by behaviour, and the shared `Pick Story
Loadout` keyword now skips flagged traits — every suite that mints a character comes
through it, so the guard lives there rather than in each of them.

### `28_movement` breakdown

Adjacency validation, energy cost formula, visited locations, admin locations. Plus:

- `location_cards.robot` (v0.28.5) — full location/neighbor `card` resolution + `?lang=` on `GET /locations`
- `location_fog_of_war.robot` (v0.28.6) — fog-of-war hides neighbor `card`/`idCard` for never-visited destinations on `/locations` and `/info`
- `match_info_visited_locations.robot` (v0.28.6) — `/info` `locations[]` visited-only (admin keeps all); no synthetic `name`/`currentLocationName`/`locationName`; neighbor `cardLocationFrom`/`cardLocationTo` gated per endpoint
- `neighbor_card_back.robot` — neighbor return card `idCardBack`
- `neighbor_edge_orientation.robot` (v0.33.3, 5 tests) — `idLocationFrom`/`idLocationTo` on the `/locations` neighbor entries. A two-way edge is listed from both endpoints with the SAME authored `(from, to, direction)` triple; the return entry must NOT swap A and B into the traversal order, and `/locations`, its admin view and `/info` must all agree. Without the endpoints a map guesses an edge's orientation from the payload's listing order and mirrors half of them
- `event_location.robot` — event-to-location binding `idSpecificLocation`; guards the AWS stale-alias and Python column-name bugs
- `match_logs.robot` — consolidated match log timeline (`GET /api/matches/{uuid}/logs`): WEATHER / MOVEMENT / SLEEP / CLOCK_ADVANCE / RECOVERY / EVENT entries, cursor pagination, card enrichment
- `match_logs_order.robot` (v0.30.3) — `?order=asc|desc` on both logs endpoints: asc default, desc as the exact reverse of asc, case-insensitive, junk values fall back to asc, desc cursor walking towards the older entries

**There is no `29_match_logs` directory.** `match_logs.robot`, `match_logs_order.robot`,
`neighbor_card_back.robot` and `event_location.robot` all live inside `tests/28_movement/`.

### `29_events` breakdown

`events.robot` (18 tests) — the `available`/`reason` flag on `/info` events;
`POST /api/gameplay/{uuid}/action/execute-event` (every error code, every effect type, every
`target` mode); the `id_event_next` chain; `ONCE` per-match consumption; `flag_end_time`; coma; `?lang=`.
Plus (v0.29.3) "A Location Effect Teleports The Character Without Any Movement Check": an
effect's `id_location` moves the actor with none of the Step 28 movement checks; runs on its
**own match** (`New Teleport Match` keyword — the teleport would otherwise strand the suite's
shared character away from the seeded events).

### `31_choices` breakdown

`choices.robot` — the choice engine: a no-choice event answers `status: APPLIED`; a
choice-event (seeded NORMAL `90030` cost 2, ONCE `90031`) answers `CHOICES_PENDING` with the
priority-sorted options, effects withheld, cost paid once; per-option `available`/`reason`
verdicts (one option gated on `INT > 99`, one otherwise fallback); the narrative/`idEventTorun`
are never leaked; the idempotent re-fetch charges nothing; a ONCE choice-event stays open after
consuming its ONCE (and `/info` reports it `ONCE_ALREADY_CONSUMED`); `/info` never nests the
choices; and the `R8_CHOICE_EVENT` import rule (choice needs `idEvent`, forbids `idLocation`)
plus the validator keys-filter fix (a `statistics` condition imports clean). Choice-events are
addressed by **behaviour** (a location-bound NORMAL/ONCE event that owns choices), never by
uuid; each pristine-event test runs on its **own match** (`Fresh Choice Match`), since opening
a choice-event latches the per-match `EVENT_EXECUTED` marker.

### `32_choice_resolution` breakdown

`choice_resolution.robot` (11 tests) — `POST /api/gameplay/{uuid}/action/select-choice`:
an option's effects land and its narrative (withheld by Step 31) is revealed, while energy
and coins stay untouched — the open already paid; the cost-bypass guard from both sides
(`CHOICE_NOT_OPEN` before an open **and** after a resolution); `CHOICE_NOT_AVAILABLE` when
the verdict is re-evaluated at pick time; `CHOICE_NOT_FOUND` / `MISSING_CHOICE`; the rich
option applying the whole v0.32.0 vocabulary at once (registry key, item, forced move to a
location no neighbor edge reaches, weather, and a linked event run inline and never charged
for); `is_progress` recording a milestone and an ordinary option not; and reopening a
*resolved* choice-event charging afresh — unlike the Step 31 re-fetch of a still-open cycle.
The test-bed (seeded NORMAL `90032` cost 3, outcome event `90033` cost 9) is addressed by
**behaviour** (the location-bound choice-event whose options carry a narrative), never by
uuid; every case runs on its **own match** (`Fresh Resolution Match`), since opening latches
the `EVENT_EXECUTED` marker and resolving latches the `CHOICE_SELECTED` one.

### `33_location_events` breakdown

`location_events.robot` (12 tests) — the events nobody asks for. No new endpoint: only new
fields on responses that already existed. First entry vs subsequent entry on the same
location (`flagVisited` latches on arrival, so the ambient event happens **once**); the
start location never firing a first entry when the party walks back (match creation seeds
it visited); `flagVisited` surfacing on `/info` `locations[]`; an `AUTOMATIC` event never
appearing among the actions `/info` offers; the `AUTOMATIC_EVENT` log entry; and the
counter-zero half — the fuse Step 26 only ever *logged* now executing, reported in
`counterZero[]` with a fog-of-war `visibility` (`ANONYMOUS` carries **none of the three
cards**), typed `COUNTER_ZERO` in the timeline **with a clock** (it used to be NULL, so the
row sorted outside it), and never restarting once consumed. Both new list fields are asserted
present even when empty, so the board never has to tell "nothing fired" from "old backend".

`counter_zero_cards.robot` (v0.33.1, 6 tests) — the three cards of a counter-zero notice.
Step 33 sent one card per entry, the **location's**; the event's own card and its applied
effects were computed and then discarded, so the player woke to the name of a place instead
of the news. Now `card` is the **event's**, `cardEffects[]` carries one `AppliedEffect` per
effect row — each with its own card, the narrative the board renders, same shape
`execute-event` returns — and `cardLocation` holds what `card` used to. The suite asserts all
three keys are present, that each card resolves against the content API, that the effect rows
belong to the event the notice names, and that an ordinary sleep still returns an empty list.
Fog of war is not re-tested here — `location_events.robot` owns it. The dev seed points the
event, its effect row and the location at the **same** authored card, so the three cannot be
told apart by identity; presence and resolution are what regressed and what is checked.

Triggers are addressed by **behaviour** (the trigger name the response reports), never by
seeded event uuid, so the suite runs unchanged against backends whose seed ids differ. Each
case mints its own guest and its own match — `flagVisited` and the counter are both
per-match latches.

### `34_inventory` breakdown

`inventory.robot` + `resources.robot` + `use_item.robot` (Steps 34/35), plus
`effects_preview.robot` (v0.35.0, 6 tests) — the PROMISE an item makes before it is used.
Every inventory row carries `effects[]` ({statistic, value} of its `list_items_effects`
rows): the array is always present, speaks the engine vocabulary already normalised
(`sad`, never `SADNESS`), rides identically on `/inventory` and on `/info` players[].items
(one mapper), and every statistic it names shows up among the `statChanges` of the usage —
values are NOT compared, since the promise is the authored delta and `statChanges` reports
what survived the clamp. The last case is the `flag_show_effects = 0` half: a consumable
whose promise is empty still moves a statistic when used and still spends its row — the
flag hides the promise, never the effect. Rows are found by BEHAVIOUR (fill the bag with
whatever the start location grants, then read the payload); all four seeds ship exactly
one consumable with an empty promise — the heavy ingot — which is what the secret case
looks for.

`item_quantities.robot` (v0.35.1, 5 tests) — the QUANTITIES. Every granting event of the
start location is repeatable, so the suite fills the bag TWICE and reads what the second
round answered: a capped item comes back as an `itemChanges` entry with `action:
NOT_ADDED` while the same run still hands over the others (the refusal must not fail the
event), the amount held does not grow, an uncapped item stacks onto the row it already has
rather than opening a second one, `use-item` spends one unit by default and leaves the rest
in the bag, and `drop-item` reports in `amountDropped` exactly what left it. Which item is
capped is discovered by behaviour — all four seeds cap the class-restricted tonic at one
and make a drop of the scroll put down two.

## Seed data and reports per backend

| Backend | Seed file | Run script | Report |
|---|---|---|---|
| Java / SQLite | `code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql` | `code/scripts/dev/run_robots/run_robot_with_local_java.sh` | `code/tests/robot/reports-local-java/report.html` |
| Java / Postgres | `code/backend/java/adapter-postgres/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql` | `code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh` | `code/tests/robot/reports-local-java-postgres/report.html` |
| Python | `code/backend/python/scripts/seed_stories.py` | `code/scripts/dev/run_robots/run_robot_with_local_python.sh` | `code/tests/robot/reports-local-python/report.html` |
| AWS | `code/backend/aws/lambda/seed/handler.py` | `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh` | `code/tests/robot/reports-aws/report.html` |

When a suite is added or a seed changes, keep all four backends in sync — the Robot suites
validate any backend interchangeably via `variables/dev.yaml`.
