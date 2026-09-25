# Story Format

How a Paths Games adventure is authored, exported and imported: the JSON contract every
backend (Java reference, Python, AWS) reads and writes, and the validation rules that gate
it. Version-independent and kept current; see `documentation_v0/` for full rationale.

## 1. Top-Level Structure

A story import/export payload is one JSON object: the story's own fields at the top level,
plus one array per sub-entity type. Order below is the order `StoryImportService` (Java,
`code/backend/java/core/src/main/java/games/paths/core/service/story/StoryImportService.java`)
actually writes them in — the authoritative source, confirmed against a real seed file
(`code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/tutorial_story_dev.json`).

```
{
  "uuid": "...", "idCard": 2, "idTextTitle": 1, "idTextDescription": 0,
  "author": "...", "versionMin": "0.19.3", "versionMax": null,
  "category": "...", "group": "...", "visibility": "PUBLIC", "priority": 1,
  "idLocationStart": 1, "idLocationAllPlayerComa": 2, "idEventAllPlayerComa": 3,
  "idEventEndGame": 4, "idTextClockSingular": 10, "idTextClockPlural": 11,
  "idTextCopyright": 513, "linkCopyright": "...", "idCreator": null,

  "creators": [...], "texts": [...], "cards": [...],
  "difficulties": [...], "classes": [...], "locations": [...],
  "weatherRules": [...], "events": [...], "items": [...],
  "locationNeighbors": [...], "eventEffects": [...], "itemEffects": [...],
  "choices": [...], "choiceConditions": [...], "choiceEffects": [...],
  "keys": [...], "traits": [...], "characterTemplates": [...],
  "globalRandomEvents": [...], "missions": [...], "missionSteps": [...],
  "classBonuses": [...]
}
```

Field names are **camelCase** everywhere in JSON/DTOs; the underlying SQL columns are
**snake_case** (`Step06_NamingConventions.md`). Every array element carries `id` (a
**story-local** integer, §3) and most carry `idCard`/`idTextName`/`idTextDescription` for
their visual/text representation.

`id_item_to_add` on events and forward references such as `id_event_next`, the five
location trigger events and a weather rule's `id_event` are resolved in a **second pass**
(`linkDeferredReferences`, v0.35.8) after every entity type is loaded once, so an event can
legally reference a location or event that appears later in the same payload, or a cycle
(event A → event B → event A).

## 2. Entity Reference

One row per entity: table it maps to and its main authoring fields (not every column — see
[DataModel.md §2](./DataModel.md) for the full column catalog).

| Entity (JSON array) | Table | Main fields |
|---|---|---|
| *(top level)* | `list_stories` | `idLocationStart`, `idEventEndGame`, `category`, `group`, `visibility`, `priority`, `versionMin`/`versionMax` |
| `difficulties` | `list_stories_difficulty` | `expCost`, `maxWeight`, `minCharacter`/`maxCharacter`, `costHelpComa`, `expCostBase`, `maxStatValue`, `numberMaxFreeAction`, base stats |
| `keys` | `list_keys` | `name`, `value`, `group`, `priority`, `visibility` |
| `classes` | `list_classes` | `weightMax`, `dexterityBase`/`intelligenceBase`/`constitutionBase` |
| `classBonuses` | `list_classes_bonus` | `idClass`, `statistic`, `value` |
| `traits` | `list_traits` | `idClassPermitted`/`idClassProhibited`, stat deltas, `costPositive`/`costNegative`, `hideOnStartMatch` |
| `characterTemplates` | `list_character_templates` | `lifeMax`/`energyMax`/`sadMax`, `dexterityStart`/`intelligenceStart`/`constitutionStart`, `idClassPermitted`/`idClassProhibited` |
| `locations` | `list_locations` | `costEnergyEnter`, `counterTime`, `secureParam`, `maxCharacters`, five `idEventIf...` trigger fields, `priorityAutomaticEvent` |
| `locationNeighbors` | `list_locations_neighbors` | `idLocationFrom`/`idLocationTo`, `direction`, `flagBack`, `energyCost`, `conditionRegistryKey`/`conditionRegistryValue`, `costFood`/`costMagic`/`costCoin` |
| `items` | `list_items` | `weight`, `isConsumabile`, `idClassPermitted`/`idClassProhibited`, `flagShowEffects`, `maxPerCharacter`, `amountDrop`/`amountUse` |
| `itemEffects` | `list_items_effects` | `idItem`, `effectCode`, `effectValue`, `traitsToAdd`/`traitsToRemove` |
| `weatherRules` | `list_weather_rules` | `probability`, `costMoveSafeLocation`/`costMoveNotSafeLocation`, `conditionKey`/`conditionKeyValue`, `timeFrom`/`timeTo`, `idEvent` |
| `events` | `list_events` | `type` (AUTOMATIC/FIRST/NORMAL/ONCE), `costEnery`, `costCoin`, `costFood`/`costMagic`, `flagEndTime`, `idEventNext`, condition fields |
| `eventEffects` | `list_events_effects` | `idEvent`, `statistics`, `value`, `target`/`targetClass`, `traitsToAdd`/`traitsToRemove`, `idItemTarget`/`itemAction`, `idLocation` (forced move) |
| `choices` | `list_choices` | `idEvent` (mandatory), `priority`, `idEventTorun`, `limitSad`/`limitDex`/`limitInt`/`limitCos`, `otherwiseFlag`, `isProgress`, `logicOperator` |
| `choiceConditions` | `list_choices_conditions` | `type`, `key`, `value`, `operator` |
| `choiceEffects` | `list_choices_effects` | `flagGroup`, `statistics`, `value`, `key`/`valueToAdd`/`valueToRemove`, `idEvent`, `idLocation`, `idWeather`, `idItemTarget`/`itemAction` |
| `globalRandomEvents` | `list_global_random_events` | `conditionKey`/`conditionValue`, `probability`, `idEvent` |
| `missions` | `list_missions` | `conditionKey`, `conditionValue`/`conditionValues` (PIPE-separated AND), `idEventCompleted` |
| `missionSteps` | `list_missions_steps` | `idMission`, `step`, same condition fields as `missions` |
| `cards` | `list_cards` | `urlImage`, `idTextTitle`/`idTextDescription`, `styleMain`/`styleDetail`, `styleImageLittle`/`styleImageMedium`/`styleImageLarge`, `cardType` |
| `texts` | `list_texts` | `idText`, `lang`, `shortText`, `longText` |
| `creators` | `list_creator` | `link`, `url`, `urlImage`, `urlEmote`, `urlInstagram` |

## 3. Texts and Languages

- `list_texts` rows are keyed by `(id_story, id_text, lang)`. `lang` is a short code —
  `EN`/`IT` in every shipped story.
- Any entity field named `idText*` (`idTextName`, `idTextDescription`, `idTextTitle`,
  `idTextNarrative`, `idTextCopyright`, …) is a **soft reference**: it names an `id_text`
  group, and the API resolves the caller's requested language against it at read time, with
  **English as fallback** when the requested language is missing. There is no database
  constraint tying these fields to an existing `list_texts` row (§5, "Soft references").
- `short_text` is capped at 2000 characters (`VARCHAR(2000)` on PostgreSQL since v0.35.8;
  unbounded `TEXT` on SQLite, but the admin editors enforce the same 2000-char limit
  client-side via `textLimits.js`). `long_text` is unbounded on both.

## 4. Story-Local IDs

- Every entity's `id` is an integer **local to the story** (PK is the composite
  `(id, id_story)`, not a global auto-increment) — two different stories can both use
  `id: 1` for a location without colliding.
- On import, an explicit `id` is honored; a duplicate `id` within the same story/table
  raises a `400` error rather than being silently reassigned.
- The importer's ID-generation cache (`getOrGenerateId`) is scoped per story so IDs stay
  dense and story-local even for entities the payload leaves numberless.
- A public-facing `uuid` (random v4, auto-generated, never authored) exists on every row for
  API responses — internal numeric `id`s are never exposed outside the admin/import surface.
- **Hard FK vs. soft reference**: a small set of fields is enforced by a real database
  foreign key (e.g. `idCard` on `list_character_templates` → `(id_card, id_story)` on
  `list_cards` — the referenced card must be in the same import payload or already exist).
  Everything else (`idText*` fields, and any `id_event`/`id_location`/… that isn't part of a
  declared FK) is a soft, story-scoped reference checked only by the validator (§6), not by
  the database.

## 5. Import Flow

1. Extract `uuid` (auto-generate if absent).
2. If a story with that `uuid` already exists, **cascade-delete** it first (all sub-tables in
   reverse FK order, then matches played on it, then the story row) — import is
   replace-on-conflict, not merge.
3. Insert the story row to obtain its generated PK.
4. Import creators, then texts (and back-patch the story's own text-id references).
5. Import cards (before any sub-entity, since several tables FK to `list_cards`).
6. Import difficulties, classes, locations, weather rules, events, items — **weather rules
   before events**, because an event's `idWeather` condition points at one (v0.35.8).
7. **Second pass** (`linkDeferredReferences`): fills `idEventNext`, `idItemToAdd`, the five
   location trigger events, and a weather rule's `idEvent` — fields that point forward or
   into a cycle.
8. Import choices, keys, traits, character templates, global random events, missions (with
   their steps), location neighbors, and all `*Effects`/`*Conditions` child tables.
9. Return an import result with a per-entity-type row count.

Full flow and every historical bugfix: [Step14_StoriesImportSystem.md](documentation_v0/Step14_StoriesImportSystem.md).

## 6. Validation Rule Catalog

One shared `StoryValidator` (`R_*` rule set) runs identically on Java, Python and AWS, at
three entry points with different strictness:

| Entry point | Strictness |
|---|---|
| `POST /api/admin/stories/import` | **Hard-fail** — validates the whole payload before writing anything; `400 INVALID_STORY` on any error, nothing persisted. |
| `POST`/`PUT /api/admin/stories/{uuid}/{entityType}` (admin CRUD) | **Lenient** — only the edited entity's own field ranges and self-consistency; forward references are not checked, so incremental authoring isn't blocked. |
| `GET /api/admin/stories/{uuid}/validate` | **Report-only** — runs the full rule set against a persisted story, returns `{valid, count, errors[], warnings[]}`, changes nothing. |

| Rule | Meaning | Import | CRUD |
|---|---|---|---|
| `R_LOCATION_REF` / `R_EVENT_REF` / `R_ITEM_REF` / `R_CHOICE_REF` / `R_CLASS_REF` / `R_MISSION_REF` | Every positive reference resolves to an existing entity of the right type in the story. | blocking | not checked |
| `R2_NEIGHBOR_SELF` | A neighbor edge links a location to itself. | blocking | — |
| `R2_NEIGHBOR_DIR` | A neighbor edge has a blank/missing `direction`. | blocking | — |
| `R2_NEIGHBOR_DUP` | The same `(from, direction)` points at two different locations. | blocking | — |
| `R3_EVENT_CYCLE` | The `idEventNext` chain forms a cycle. | blocking | — |
| `R4_CHOICE_EMPTY` | A choice has no option and no `otherwiseFlag`. | blocking | — |
| `R4_CONDITION_KEY` | A `KEYS`-type choice condition's `key` doesn't match any story `keys[].name`. | blocking | — |
| `R6_STAT_RANGE` | `lifeMax`/`energyMax` must be positive; start stats/`sadMax` non-negative. | blocking | blocking (character-templates) |
| `R6_CLASS_CONFLICT` | An item/trait/template has the same class permitted and prohibited. | blocking | blocking (items/traits) |
| `R6_DIFFICULTY_RANGE` | `minCharacter` exceeds `maxCharacter`. | blocking | blocking (difficulties) |
| `R8_CHOICE_EVENT` | A choice must have non-null `idEvent` and null `idLocation` (v0.31.0). | blocking | blocking (rejects non-null `idLocation` only) |
| `R10_MISSION_CONDITION` | A mission/step with a blank `conditionKey` or no comparable value (v0.37.0). | report-only (never blocks) | not checked |
| `R11_RANDOM_EVENT` | `probability` outside 0–100; missing/zero `idEvent`; the target event owns choices or sets weather; `conditionKey` set without `conditionValue` or vice versa (v0.39.0). | blocking | blocking |

`warnings[]` (v0.39.0, report-only, never flips `valid` to `false`) currently carries one
check: a story's `globalRandomEvents` probabilities summing past 100 (legal, scaled at
runtime).

Full catalog and per-backend wiring: [Step22_StoryValidation.md](documentation_v0/Step22_StoryValidation.md).

## 7. Export / Import Round-Trip

- **No null keys.** `stripNulls()` (`code/frontend/react-admin/src/utils/storyJson.js`)
  recursively drops every `null`/`undefined` object property before an export is written;
  array order and length are preserved. Every backend reads an **absent** key the same way
  it reads an explicit `null` (as "not set" / default), so a stripped export round-trips
  cleanly through import.
- A pre-v0.35.3 export using the old `coinCost` key (events) or the pre-v0.33.2
  `idEventIfCharacterEnterFirstTime` key (locations) is still accepted on import as a
  fallback for the renamed field, so an older export does not silently lose data.
- The top-level `locationNeighbors` array is the canonical location for edges (a
  `location.neighbors` nested form is not read); this is what both the exporter and
  `save_location_neighbors` (Python) target.
- Re-importing an existing story's `uuid` is a full replace (§5, step 2), not a merge —
  re-importing after a manual DB edit discards that edit.

## 8. How to Add a Field

Adding a new authored field (e.g. a new `list_cards` column) touches every layer once:
Flyway migration (Java, both dialects) → Python `models.py` → Java DTO/entity/service →
Python query/persistence → AWS `story`/`content`/`seed` handlers → 3 OpenAPI specs →
`admin_crud.robot` → react-admin form/options → react-game renderer (if visual) → this
document and the component READMEs. The full checklist, based on the real v0.19.3/v0.19.4
changes, is here: [Step15_StoryContentHowAddFiledIntoCard.md §11](documentation_v0/Step15_StoryContentHowAddFiledIntoCard.md#11-quick-checklist).

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First version of the story authoring format reference | September 25, 2026 |

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
