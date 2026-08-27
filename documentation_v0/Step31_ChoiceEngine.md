# Step 31 — Choice engine (event-bound choices, availability & presentation)

Until this step, `list_choices` was authored data with nowhere to surface: an event that owned
choice rows still ran its `list_events_effects` exactly like any other event, and nothing ever
read `list_choices_conditions`. Step 31 closes that gap on the **open** side only — presenting
the options — while resolution stays out of scope.

**No new endpoint.** An event that owns at least one `list_choices` row is a **choice-event**.
Executing it (`POST /api/gameplay/{uuidMatch}/action/execute-event`) still pays energy/coins and
writes the `EVENT_EXECUTED` marker exactly as [Step 29](./Step29_NormalEvents.md) does — but
instead of applying `list_events_effects` it presents the choices. A 0-choice event keeps the
Step 29 flow unchanged, byte for byte.

Selecting an option, applying `list_choices_effects`, running `id_event_torun` and writing the
`CHOICE_SELECTED` marker are all [**Step 32**](./Step32_ChoiceResolution.md) (choice
resolution) — not this step.

---

## 1. The two flows on `execute-event`

`execute-event` gained a `status` field:

| `status` | When | Effects run? |
|---|---|---|
| `APPLIED` | The event owns zero `list_choices` rows | Yes — the whole v0.29.0/v0.30.0 flow, unchanged |
| `CHOICES_PENDING` | The event owns ≥1 `list_choices` row | No — withheld, see §2 |

Both branches run the **same** availability check as before (`EventAvailabilityChecker`) and pay
the **same** cost on success; only what happens after the cost is paid differs.

## 2. What a `CHOICES_PENDING` execution does — and does not do

1. Runs the Step 29 availability check — a sleeping, comatose, broke or misplaced character is
   rejected exactly as before, with the same reason codes.
2. **Pays the cost on open**: energy and coins are deducted, and the `EVENT_EXECUTED` marker is
   written. A `ONCE` choice-event is consumed by *opening* it, not by resolving it — opening it
   and walking away is not free. This is the anti-peek deterrent: sbirciare le opzioni e
   ritirarsi ha comunque un costo.
3. **Withholds everything else**: `list_events_effects`, the `id_event_next` chain,
   `flag_end_time`, the Step 30 edge-state rules and `gameOver` do not run. On the response,
   `effects`, `statChanges` and `edgeState` come back **empty**; `executedEventUuids` holds just
   the event itself; `energySpent`/`coinSpent` reflect what **this call** charged — real on the
   first open, `0` on a re-fetch (§3).

### Response shape — `pendingChoices[]`

One entry per `list_choices` row owned by the event, **priority-sorted (ties by id)**, disabled
options **included** — the board renders the impossible ones greyed out, it never drops them.

| Field | Meaning |
|---|---|
| `uuid` | The choice's opaque id — what [Step 32](./Step32_ChoiceResolution.md)'s `select-choice` takes. |
| `priority` | Authored presentation order, lowest first. |
| `name` | Resolved short text of `id_text_name` (requested `lang`, `en` fallback). |
| `description` | Resolved short text of `id_text_description`. |
| `card` | The choice's own card (`id_card`). |
| `available` | The `ChoiceAvailabilityChecker` verdict for the acting character, evaluated now. |
| `reason` | `null` when `available`; otherwise one of the codes in §4. |

**Deliberately excluded**: the choice's narrative text (`id_text_narrative`) and its outcome
event (`id_event_torun`) — returning either here would leak the consequence of a choice not yet
made. Both belong to [Step 32](./Step32_ChoiceResolution.md)'s resolution response.

## 3. Idempotent re-fetch (page refresh)

A choice-event **cycle is open** while its `EVENT_EXECUTED` markers outnumber its
`CHOICE_SELECTED` markers — a count comparison, not a boolean flag (`MSG_CHOICE_SELECTED =
"CHOICE_SELECTED"` is defined and read starting this step; only
[Step 32](./Step32_ChoiceResolution.md) ever *writes* it, and its log row carries the **owning
event's** id, not the choice's).

Re-executing an open choice-event serves the options again as a **pure read**:

- no energy or coins are deducted (`energySpent`/`coinSpent` come back `0`);
- no new `EVENT_EXECUTED` marker is written;
- the event-level availability verdict is **bypassed** — the open already paid, so re-running the
  Step 29 check could wrongly reject the very event the player already paid for
  (`ONCE_ALREADY_CONSUMED`, or `NOT_ENOUGH_ENERGY` once the deduction left them short);
- each **option's own** `available`/`reason` is still re-evaluated fresh — the world may have
  changed since the open (an item picked up, a stat that moved, a key flipped).

## 4. Per-option availability — `ChoiceAvailabilityChecker`

A pure function, no ports, no I/O — a twin of `EventAvailabilityChecker` ([Step 29
§2](./Step29_NormalEvents.md)). Every option gets a verdict, in this order:

1. **`otherwise_flag = 1`** → always available (**INV-29**) — nothing else is read for that
   option.
2. **Inline limits, AND-combined**, checked before the conditions:
   - `limit_dex` / `limit_int` / `limit_cos` are **minimum** requirements (stat ≥ limit);
   - `limit_sad` is a **maximum** (sad ≤ limit);
   - a `null` limit is no constraint.
3. **`list_choices_conditions`**, combined under the choice's own `logic_operator` — **`AND`**
   (default) or **`OR`**, never mixed within one choice (**INV-31**). `type` (case-insensitive) ∈
   `KEYS`, `ITEM`, `CLASS`, `LOCATION`, `ALL_IN_SAME_LOC`, `traits`, `statistics`,
   `statistics_SUM`; `operator` ∈ `=`, `!=`, `>`, `<`.
   - `statistics` reads the **acting character, post-deduction** — the player chooses with the
     energy they actually have left.
   - `statistics_SUM` sums the stat over **every character of the match**.
   - `ALL_IN_SAME_LOC` requires the **whole party** in the actor's location (a solo party is
     trivially true; an unplaced member fails it).
   - An **absent registry key** satisfies only `!=`.
   - An **unknown type, blank key, or unparseable value makes that condition NOT met** — a typo
     locks an option visibly; it never silently unlocks one.

`reason` is a plain string that rides on the **200** response — never a thrown error code: the
first failing check under AND (`LIMIT_SAD_EXCEEDED`, `LIMIT_DEX_NOT_MET`, `LIMIT_INT_NOT_MET`,
`LIMIT_COS_NOT_MET`, `CONDITION_KEYS_NOT_MET`, `CONDITION_ITEM_NOT_MET`,
`CONDITION_CLASS_NOT_MET`, `CONDITION_LOCATION_NOT_MET`,
`CONDITION_ALL_IN_SAME_LOC_NOT_MET`, `CONDITION_TRAITS_NOT_MET`,
`CONDITION_STATISTICS_NOT_MET`, `CONDITION_STATISTICS_SUM_NOT_MET`), or the aggregate
`CONDITIONS_NOT_MET` under OR (individual OR-branch reasons are not distinguished).

## 5. Choices are never nested into `/info`

`GET /api/match/{uuid}/info` keeps its `choices` list **empty**, always. Options exist only on the
`execute-event` response — there is no second source of truth to keep in sync, and nothing about
an event's choices leaks before the event is opened (and paid for).

## 6. Schema — no new migration

`list_choices`, `list_choices_conditions` and `list_choices_effects` already existed (Java
`V0.10.4`). Nothing changed on the Java/AWS side. The **Python** SQLAlchemy `list_choices` model
was out of sync with the schema and is brought into line this step: it gained `id_location`,
`id_text_narrative`, `limit_sad`, `limit_dex`, `limit_int`, `limit_cos`, `logic_operator`. Also
fixed: `list_choices_conditions.condition_operator`'s default changed from `"AND"` to `"="` — it
is the **per-row comparator** (`=`/`!=`/`>`/`<`), not the AND/OR combiner; the combiner lives on
the choice's own `logic_operator`. See [Step09_DesignCoreDataModel.md](./Step09_DesignCoreDataModel.md)
for the updated `Choice` invariant.

## 7. Validation — `R8_CHOICE_EVENT` (Step 22 addition)

New whole-story rule, hard-fail on import and on `validate-story`: every choice must have a
non-null `id_event` and a **null** `id_location` — a choice belongs to an event, never (any
longer) to a location. The entity-local CRUD check is more lenient: it rejects only a non-null
`id_location`, tolerating a still-missing `id_event` so a draft choice can exist before its event
while authoring. See [Step22_StoryValidation.md](./Step22_StoryValidation.md).

The same pass also fixed a pre-existing validator bug: `R4_CONDITION_KEY` (a choice-condition
`key` must match a story `keys[].name`) now runs **only** on `KEYS`-type conditions. On any other
`type`, `key` names a stat or an id, not a registry key, so checking it against the keys registry
false-failed otherwise-legal stories.

## 8. Frontend

`PendingChoicesCard` (new) renders the options on the reading page when `status ==
CHOICES_PENDING`: available options are selectable-looking, disabled ones are greyed with their
`reason`, and a client-side "do nothing" button closes the card without calling any endpoint —
the cost already paid at open stays paid either way. Selecting an option is
[Step 32](./Step32_ChoiceResolution.md).

---

## 9. Files

| Layer | Path |
|---|---|
| Check procedure (Java) | `core/service/match/ChoiceAvailabilityChecker.java` (new) |
| Engine (Java) | `core/service/match/EventExecutionService.java` — branches to the choice flow for a choice-owning event |
| Ports (Java) | `core/port/match/EventExecutionPort.java`, `EventExecutionStorePort.java` (new `MSG_CHOICE_SELECTED` constant) |
| Persistence (Java) | `core/persistence/match/EventExecutionStoreAdapter.java` |
| DTO (Java) | `adapter-rest/dto/ExecuteEventResponse.java` — new `status`, `pendingChoices[]` (`PendingChoiceDto`) |
| Validator (Java) | `core/service/story/StoryValidatorService.java` — `R8_CHOICE_EVENT` (whole-story + entity-local); `R4_CONDITION_KEY` fix |
| OpenAPI | `adapter-rest/src/main/resources/openapi/v0.31.0-choices-api.yaml` (new: `ExecuteEventStatus`, `PendingChoice`), patch to `v0.29.0-events-api.yaml` |
| Check procedure (Python) | `app/core/services/match/choice_availability.py` (new) |
| Engine (Python) | `app/core/services/match/event_service.py`, `app/core/models/match/event_models.py`, `app/core/ports/match/event_ports.py`, `app/adapters/persistence/match/event_store_adapter.py`, `app/adapters/rest/match/event_controller.py` |
| Validator (Python) | `app/core/services/story/story_validator_service.py` |
| Schema fix (Python) | `app/adapters/persistence/story/models.py`, `story_persistence_adapter.py` (`list_choices` columns brought into line, §6) |
| Engine (AWS) | `lambda/match/choices.py` (new), `lambda/match/handler.py` |
| Validator (AWS) | `lambda/story/story_validator.py` |
| Seed data | `lambda/seed/handler.py`, Java `adapter-sqlite` dev seed (`R__insert_story_seed_data.sql`, `story_demo_3.json`, `story_demo_4.json`) — fixture choice-events for the Robot suite |
| Game board | `react-game/src/features/gameplay/cards/PendingChoicesCard.jsx` (new), `GameBook.jsx` (renders it on `CHOICES_PENDING`), `i18n/en.json`, `i18n/it.json` |
| Robot | `code/tests/robot/tests/31_choices/choices.robot` (new, 8 cases: 0-choice `APPLIED`, `CHOICES_PENDING` with options, idempotent re-fetch, `ONCE` stays open after consuming, choices never nested into `/info`, R8 import rejection ×2, a `statistics` condition validating clean); touches `tests/14_admin/story_import.robot`, `tests/22_story_validation/story_validation.robot`, `tests/29_events/events.robot` |
| Tests | Java: `ChoiceAvailabilityCheckerTest`, `EventExecutionServiceChoicesTest`, `ExecuteEventResponseTest`, `EventControllerTest`, `StoryValidatorServiceTest`/`StoryValidatorServiceDbPathTest`, `EventExecutionStoreAdapterReadWriteTest`. Python: `test_choice_availability.py`, `test_event_service_choices.py`, `test_event_service.py`, `test_event_controller.py`, `test_story_validator_service.py`, `test_story_validator_db_path.py`, `test_event_store_adapter.py`. AWS: `test_choices.py`, `test_match_handler_execute_event_choices.py`, `test_story_validator.py`, `test_story_handler.py`. Frontend: `PendingChoicesCard.test.jsx`. |

Python and AWS mirror the Java engine and validator described above; see
[Roadmap.md](./Roadmap.md) (step 31) for the originating spec.

---

# Version Control

- **Document Version**: 0.31.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.31.0 | Choice engine: choice-owning events branch `execute-event` to `status: CHOICES_PENDING` + `pendingChoices[]` instead of applying effects; cost/marker paid on open, idempotent re-fetch; `ChoiceAvailabilityChecker` (limits + 8 condition types, AND/OR); `R8_CHOICE_EVENT` validation rule; `R4_CONDITION_KEY` fix; choices never nested into `/info`; react-game `PendingChoicesCard` | July 22, 2026 |

- **Last Updated**: July 22, 2026
- **Status**: Complete — resolution (select-choice, `list_choices_effects`, `id_event_torun`, `CHOICE_SELECTED`) is [Step 32](./Step32_ChoiceResolution.md)




# < Paths Games />
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
