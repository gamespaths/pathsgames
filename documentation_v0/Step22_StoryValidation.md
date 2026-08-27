# Paths Games V0 - Step 22: Story Validation and Integrity Checking

This document describes the implementation of **Step 22** as requested in the Roadmap.

Step 22 adds a **StoryValidator** domain service that checks referential integrity and
domain rules across all ~29 story entities. The validator is wired into two write paths
and one read path, identically across the four backends (Java reference, Python, AWS):

- **Story import** — `POST /api/admin/stories/import` now validates the whole import map
  *before any row is persisted*. On failure it returns **HTTP 400 `INVALID_STORY`** with a
  structured `errors[]` array and writes nothing (hard-fail).
- **Admin CRUD** — `POST/PUT /api/admin/stories/{uuid}/{entityType}` run **entity-local
  (lenient)** validation: only the edited entity's own field ranges and self-consistency
  are checked, so forward references do not block incremental authoring.
- **Read-only report** — new `GET /api/admin/stories/{uuid}/validate` runs the full
  validator against a persisted story and returns a report without modifying anything.

`react-game` is **not touched** (it only reads published stories). `backend/node` is out of
scope.

---

## 1. Scope

| Item | Status |
|------|--------|
| Core `StoryValidator` service (referential integrity + domain rules) across all entities | ✅ |
| Location-neighbor validation (existence, self-loop, direction presence, duplicate direction) | ✅ |
| Event validation (location/item refs) + **event-chain cycle detection** (`idEventNext`) | ✅ |
| Choice validation (≥1 option or otherwise; refs; conditions reference valid keys) | ✅ |
| Character-template stat ranges + class permitted≠prohibited; class refs | ✅ |
| Integrate into import (hard-fail) and admin CRUD (lenient) | ✅ |
| `GET /api/admin/stories/{uuid}/validate` read-only report | ✅ |
| Backend unit tests (valid stories, broken refs, edge cases) — Java/Python/AWS | ✅ |
| Robot suite `22_story_validation` | ✅ |
| react-admin "Validate story" button + report panel | ✅ |

---

## 2. Validation rule catalog

A rule produces zero or more `StoryValidationError { rule, entityType, entityId, field, message }`.
**Only positive references are validated**: a null, absent or non-positive reference means
"none" (matching the import service's `normalizeOptionalFk`) and is never reported.

| Rule code | Checks |
|-----------|--------|
| `R_LOCATION_REF` / `R_EVENT_REF` / `R_ITEM_REF` / `R_CHOICE_REF` / `R_CLASS_REF` / `R_MISSION_REF` | Every positive reference resolves to an existing entity of the right type within the story. Covers story FKs (`idLocationStart`, `idLocationAllPlayerComa`, `idEventAllPlayerComa`, `idEventEndGame`), event refs (`idSpecificLocation`, `idItemToAdd`, `idEventNext`), choice refs (`idEvent`, `idLocation`, `idEventTorun`), choice-condition/effect `idChoices`, event-effect (`idEvent`, `idItemTarget`, `targetClass`), item-effect `idItem`, class-bonus `idClass`, mission-step `idMission`, weather/global-random `idEvent`, neighbor `idLocationFrom`/`idLocationTo`, and item/trait/template `idClassPermitted`/`idClassProhibited`. |
| `R2_NEIGHBOR_SELF` | A neighbor links a location to itself. |
| `R2_NEIGHBOR_DIR` | A neighbor has a blank/missing `direction`. |
| `R2_NEIGHBOR_DUP` | The same `(from, direction)` points at two different locations. |
| `R3_EVENT_CYCLE` | The `idEventNext` chain forms a cycle (iterative DFS with colouring). |
| `R4_CHOICE_EMPTY` | A choice has no option (no `choiceEffects` row) **and** no `otherwiseFlag`. |
| `R4_CONDITION_KEY` | A choice-condition `key` does not match any `keys[].name` in the story. **v0.31.0**: only checked on `KEYS`-type conditions — on any other `type`, `key` names a stat or an id, not a registry key, and checking it there used to false-fail otherwise-legal stories. |
| `R6_STAT_RANGE` | `lifeMax`/`energyMax` must be positive; `dexterityStart`/`intelligenceStart`/`constitutionStart`/`sadMax` must be non-negative. |
| `R6_CLASS_CONFLICT` | An item/trait/template has the same class permitted and prohibited. |
| `R6_DIFFICULTY_RANGE` | (entity-local) `minCharacter` exceeds `maxCharacter`. |
| `R8_CHOICE_EVENT` | **(v0.31.0)** Every choice must have a non-null `idEvent` and a null `idLocation` — a choice belongs to an event, never a location (the location binding is deprecated). Hard-fail on import and `validate-story`; entity-local (lenient CRUD) rejects only a non-null `idLocation`, tolerating a still-missing `idEvent` so a draft choice can exist before its event while authoring. See [Step31_ChoiceEngine.md](./Step31_ChoiceEngine.md). |

**Entity-local (lenient CRUD) subset:** `character-templates` → stat ranges + class
conflict; `items`/`traits` → class conflict; `difficulties` → character range; `choices` →
non-null `idLocation` rejected (v0.31.0). Forward references are intentionally **not** checked
on CRUD.

### Shared rule engine
Both entry points normalise their input into one internal `StoryGraph` (id-sets +
reference records + neighbor/template/restriction lists + event-chain edges + choice
option/otherwise maps) and run a single rule engine. The import path builds the graph from
the raw map (camelCase keys, reading reference fields the import persistence step does not
itself store); the report path builds it from `StoryReadPort` rows (snake_case keys). A
key-agnostic accessor lets the same rules apply to both.

---

## 3. Endpoint APIs

OpenAPI source of truth:
[`code/backend/java/adapter-rest/src/main/resources/openapi/v0.22.0-story-validation-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.22.0-story-validation-api.yaml).

### 3.1 `GET /api/admin/stories/{uuid}/validate` (NEW)

| HTTP | Condition |
|------|-----------|
| `200` | `{ "valid": bool, "count": int, "errors": [ {rule,entityType,entityId,field,message} ] }` |
| `401` | Missing / invalid admin token |
| `404` | `STORY_NOT_FOUND` |

### 3.2 `POST /api/admin/stories/import` (extended)

Adds a failure mode: when validation fails the endpoint returns **400** and persists nothing.

```json
{
  "error": "INVALID_STORY",
  "message": "choices idEvent=99 references a non-existent event",
  "errors": [
    { "rule": "R_EVENT_REF", "entityType": "choices", "entityId": "1",
      "field": "idEvent", "message": "choices idEvent=99 references a non-existent event" }
  ]
}
```

### 3.3 `POST/PUT /api/admin/stories/{uuid}/{entityType}` (extended)

May now return the same `400 INVALID_STORY` body when entity-local validation fails.

All endpoints are served only on the admin port **8044** and require ADMIN role.

---

## 4. Per-backend implementation

| Backend | Validator | Wiring (import / CRUD / endpoint) |
|---------|-----------|-----------------------------------|
| **Java** | `core/.../service/story/StoryValidatorService` implementing `port/story/StoryValidatorPort` (with nested `StoryValidationException`); models `StoryValidationError` + `StoryValidationReport`. | `StoryImportService` (2-arg ctor) hard-fails; `StoryCrudService` (3-arg ctor) lenient; `CoreConfig` bean wiring; `StoryAdminController` validate endpoint + import 400; `StoryCrudAdminController` `@ExceptionHandler`. DTOs `StoryValidationReportResponse` / `StoryValidationErrorResponse`. |
| **Python** | `app/core/services/story/story_validator_service.py` + `app/core/ports/story/story_validator_port.py` (`StoryValidationError`/`Report`/`Exception`). | `story_import_service.py`, `story_crud_service.py` (optional `validator_port`); `launcher.py` wiring; `story_admin_controller.py` (validate route + import 400) and `story_crud_admin_controller.py` (400 mapping). |
| **AWS** | Standalone `lambda/story/story_validator.py` (`validate_story_dict`, `validate_entity`, `summary`). | `lambda/story/handler.py`: `import_story` 400, `create_entity`/`update_entity` lenient, `validate_story` handler + route; `template/story.yaml` `ValidateStoryRoute`. Code + tests only (not deployed). |

---

## 5. Test coverage

### 5.1 Backend unit tests

| Backend | New / extended tests | Result |
|---------|----------------------|--------|
| Java | `StoryValidatorServiceTest` (rules R1–R7, cycle, lenient, DB-path) + controller validation tests | `mvn -pl core,adapter-admin -am test` → core 250, admin 66, **BUILD SUCCESS** |
| Python | `tests/test_story_validator_service.py` (28 cases) | `pytest tests` → **487 passed** |
| AWS | `tests/test_story_validator.py` + handler validation tests | `pytest tests` → **246 passed** |

Each suite covers: a fully-consistent story passing; each broken-reference variant;
event-chain cycle (and self-cycle); empty choice; unknown condition key; stat-range and
class-conflict edges; lenient CRUD allowing forward references; and the persisted (DB-row)
path.

### 5.2 Robot Framework — `tests/22_story_validation/story_validation.robot`

Eight backend-agnostic cases: import with missing event ref → 400; missing-location
neighbor → 400; event-chain cycle → 400; empty choice → 400; class conflict → 400; valid
story imports (201) and validates clean (200, `valid:true`); validate without token → 401;
CRUD forward reference is lenient (201). New keywords in `resources/stories.resource`:
`Post Admin Story Import`, `Import Payload Should Fail Validation`, `Validate Admin Story`.

**Fixture note:** four pre-existing minimal fixtures in `tests/14_admin/story_import.robot`
were technically invalid stories (an empty choice, `energyMax:0`); they were made
referentially valid so they still import under the new hard-fail rule. The four real story
JSON files (`story_demo_3/4`, `tutorial_large`, `tutorial_story_dev`) already validate
clean.

### 5.3 react-admin

`StoryEditorPage` gains a **"Validate story"** button (metadata toolbar) that calls
`GET /api/admin/stories/{uuid}/validate` and renders a report panel — a success alert when
valid, or a list of `errors[]` when not. Import/CRUD 400s continue to surface through the
existing `ErrorAlert` + `client.js` interceptor. New API function
`validateStory(uuid)` in `src/api/storyApi.js`. Tests: `StoryEditorPage.test.jsx` +2 cases.
`npx vitest run` → **269 passed**.

---

## 6. Files changed (summary)

- **Java**: `core/model/story/StoryValidation{Error,Report}.java`, `core/port/story/StoryValidatorPort.java`,
  `core/service/story/StoryValidatorService.java`; edits to `StoryImportService`,
  `StoryCrudService`, `CoreConfig`, `AdminConstant`, `StoryAdminController`,
  `StoryCrudAdminController`; DTOs; OpenAPI yaml; tests.
- **Python**: `story_validator_port.py`, `story_validator_service.py`; edits to import/crud
  services, `launcher.py`, both admin controllers; tests.
- **AWS**: `lambda/story/story_validator.py`; edits to `lambda/story/handler.py`,
  `template/story.yaml`; tests.
- **Robot**: `tests/22_story_validation/story_validation.robot`, `resources/stories.resource`,
  fixture fixes in `tests/14_admin/story_import.robot`.
- **react-admin**: `src/api/storyApi.js`, `src/pages/story/StoryEditorPage.jsx`,
  `src/tests/pages/StoryEditorPage.test.jsx`.

---

# Version Control

- Created with AI prompt:
  ```
  ciao read step 22 on roadmap file (documentation_v0/Roadmap.md) and write a plan to realize all components.
  projects are backend/java, robot test, react-game, react-admin, aws lambda and python project.
  at the end write Step22_xxx.md file with specific documentation agent. let's go
  ```
- **Document Version**: 0.31.0 (here only due changes)
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.22.0 | Story validation & integrity checking — StoryValidator across all 4 backends (import hard-fail, CRUD lenient), `GET /api/admin/stories/{uuid}/validate` report endpoint, robot suite `22_story_validation`, react-admin Validate button | June 10, 2026 |
    | 0.31.0 | New rule `R8_CHOICE_EVENT` (choice→event binding mandatory, `idLocation` deprecated, see [Step31_ChoiceEngine.md](./Step31_ChoiceEngine.md)); fixed `R4_CONDITION_KEY` to run only on `KEYS`-type conditions | July 22, 2026 |

- **Last Updated**: July 22, 2026
- **Status**: Complete




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

