# Step 15 — How to Add a Field into the Card Object

This guide walks through every layer of the **Paths Games** monorepo that has
to be touched when you add a new column to the `list_cards` table (the visual
card entity) and want it round‑tripping through every backend, the public API,
the admin UI and the in‑game renderer.

It is based on the real changes made in `v0.19.3` (`style_image_little`,
`style_image_medium`, `style_image_large`) and `v0.19.4` (`card_type`).

> Naming conventions: snake_case in SQL, camelCase in DTO/JSON and React.
> See `Step06_NamingConventions.md`.

---

## 0. Decide the contract first

Before changing any code answer:

| Question | Notes |
|---|---|
| Column name (snake_case) | e.g. `card_type` |
| JSON / DTO name (camelCase) | e.g. `cardType` |
| SQL type | `TEXT` for SQLite, `VARCHAR(N)` or `TEXT` for PostgreSQL/MySQL |
| Nullable? | Cards columns are almost always nullable for backward compat |
| Enumerated values? | If yes, declare an options array in React Admin |

---

## 1. Database schema — Flyway (Java) 

### 1.1 Java — add a new Flyway migration

Migration files live in:

- `code/backend/java/adapter-sqlite/src/main/resources/db/migration/v0/`
- `code/backend/java/adapter-postgres/src/main/resources/db/migration/v0/`

Both folders are independent — write one migration file in **each**, with the
**same version**.

Pick the next free `V0.X.Y` number (look at the highest existing file):

```text
adapter-sqlite/.../V0.19.3__add_card_style_image_sizes.sql
adapter-postgres/.../V0.19.3__add_card_style_image_sizes.sql
```

Body (`ALTER TABLE`, not `CREATE TABLE` — the base table is defined by
`V0.10.5__create_story_content.sql` which carries a `NEVER EDIT THIS FILE
MANUALLY` header):

```sql
-- SQLite
ALTER TABLE list_cards ADD COLUMN card_type TEXT;

-- PostgreSQL
ALTER TABLE list_cards ADD COLUMN card_type VARCHAR(50);
```

Flyway runs migrations automatically at boot, so once the file is on the
classpath the new column will appear at the next launcher start.

### 1.3 Python — SQLAlchemy model

`code/backend/python/app/adapters/persistence/story/models.py`

Add the column to the `CardEntity` class:

```python
class CardEntity(Base):
    __tablename__ = "list_cards"
    ...
    card_type = Column(String(50))
```

Python uses SQLAlchemy's `create_all` against the model metadata so no
migration file is needed.

### 1.4 AWS DynamoDB — no schema change

DynamoDB is schemaless. The new attribute appears automatically once the
write path includes it (see §4).

---

## 2. Domain & DTO objects

You must extend the in‑memory representations in **every** backend so the
field survives the trip from DB → service → REST.

### 2.1 Java

| File | Change |
|---|---|
| `core/.../entity/story/CardEntity.java` | Add `@Column(name = "card_type") private String cardType;` + getter/setter |
| `core/.../model/story/CardInfo.java` | Add field, builder method, getter |
| `adapter-rest/.../dto/CardInfoResponse.java` | Add field, ctor arg, getter/setter |

Tip: `CardInfoResponse` has a positional constructor — every test that calls
it (`CardInfoResponseTest`, `StoryDetailResponseTest`, controller tests) must
be updated to pass the new positional argument.

### 2.2 Python

| File | Change |
|---|---|
| `core/models/story/card_info.py` | Add field on the `@dataclass` |
| `adapters/persistence/story/story_persistence_adapter.py` | Add an entry to the `save_cards` field map: `"card_type": "cardType"` |

### 2.4 AWS Lambda

There is no class hierarchy: every handler reads/writes Python dicts. The
relevant code is in:

- `code/backend/aws/lambda/story/handler.py`
- `code/backend/aws/lambda/content/handler.py`
- `code/backend/aws/lambda/seed/handler.py`

---

## 3. Read path (DB → API response)

This is the path that resolves a card and returns it in JSON.

### 3.1 Java services

| File | Method | Action |
|---|---|---|
| `core/.../service/story/ContentQueryService.java` | `getCardByStoryAndCardUuid` | Add `.cardType(card.getCardType())` to the `CardInfo.builder()` chain |
| `core/.../service/story/StoryQueryService.java` | `resolveCardInfo` | Same |
| `adapter-rest/.../controller/story/ContentController.java` | `toCardInfoResponse` | Pass the value through to the `CardInfoResponse` ctor |
| `adapter-rest/.../controller/story/StoryController.java` | `toCardInfoResponse` | Same |

### 3.2 Python services

| File | Action |
|---|---|
| `core/services/story/content_query_service.py` | `CardInfo(... cardType=card.get("card_type") ...)` |
| `core/services/story/story_query_service.py` | Same in `_map_to_detail`, `_map_to_summary`, `_resolve_card` |
| `adapters/rest/story/content_controller.py` | Include `"cardType": card.cardType` in the response dict |

`StoryDetail` / `StorySummary` are dataclasses serialized via `asdict()` —
they pick up new fields automatically once `CardInfo` has them.


### 3.4 AWS Lambda

In `story/handler.py`:

- `_build_card()` (story summary) → add `'cardType': card.get('cardType')`
- The import path (`stored_cards.append({...})` inside `import_story`) → carry
  the field from the incoming JSON into the DynamoDB item

In `content/handler.py`:

- `get_card_by_uuid` response dict → add `'cardType'`

In `seed/handler.py`:

- Add the field to the seeded card stub if you want it populated for tests

---

## 4. Write path (create / update / import)

### 4.1 Java

`core/.../service/story/StoryImportService.java` → `importCards()` — add
`e.setCardType(getString(item, "cardType"));`

`core/.../service/story/StoryCrudService.java`:

- `toMap(e)` for `CardEntity` → `m.put("cardType", cd.getCardType());` so GET
  admin endpoints include the field
- `applyCardFields(e, d)` → `if (d.containsKey("cardType")) e.setCardType(...)` so PUT/POST update it

### 4.2 Python

The Python crud service uses generic snake↔camel conversion (see
`StoryCrudService._convert_to_camel_case`) — no per‑field change needed once
the column is in the SQLAlchemy model and the persistence mapping.



### 4.4 AWS

The import logic in `story/handler.py` (look for `stored_cards.append`) is
where you carry the new value from the request JSON into DynamoDB.

---

## 5. OpenAPI specs

Specs live in:

```
code/backend/java/adapter-rest/src/main/resources/openapi/
  v0.14.0-story-api.yaml         (StorySummary / StoryDetail)
  v0.15.0-story-content-api.yaml (Cards listing)
  v0.16.0-content-detail-api.yaml (Single‑card detail)
```

Add the property under each `CardInfoResponse` schema. Mark it
`nullable: true` unless the field is mandatory.

---

## 6. Robot Framework tests

Tests live in `code/tests/robot/tests/`. The card CRUD lives in:

`17_admin_crud/admin_crud.robot` → `Create And Delete Card With Style Fields`

1. Add the new field to the request `Create Dictionary` payload
2. Add a `Response Field Should Equal` assertion against the create response
3. Add the same assertion against the GET response so we test round‑trip

The same suite runs against every backend (Java/SQLite, Java/Postgres,
Python, AWS lambda) via the launcher scripts in
`code/scripts/dev/run_robots/`.

---

## 7. React Admin (story editor)

`code/frontend/react-admin/src/constants/story/storiesEntities.jsx`

Find the `cards: [...]` array inside `STORIES_ENTITIES_FIELDS` and append a
field descriptor:

```jsx
{ key: 'cardType', label: 'Card Type', type: 'select', options: CARD_TYPE_OPTIONS }
{ key: 'styleImageLittle', label: 'Style Image Little', type: 'text' }
```

For free text use `type: 'text'`, for a number `type: 'number'`, for a
dropdown `type: 'select'` with an `options` array of `{ value, label }`.

Reusable option arrays live in
`code/frontend/react-admin/src/constants/story/storyFieldOptions.js` — add
a `mapOptions([...])` export and import it from `storiesEntities.jsx`.

The form & table renderer (`EntityForm`, `EntityTable`) pick the new field up
automatically from the descriptor — no further wiring.

---

## 8. React Game (in‑play renderer)

`code/frontend/react-game/src/components/layout/GameCard.jsx` is where a card
is actually drawn. To consume a new visual field:

1. Destructure it from `card` (or read `card?.fieldName`)
2. Apply it to the right JSX element (e.g. `className`, `style`, or text node)
3. Document it in the JSDoc header so other components know what the field is
   for

If the field is variant‑specific (like `styleImageLittle/Medium/Large`),
branch on the `variant` prop.

---

## 9. Documentation

For any non‑trivial field:

- Add a row to the `list_cards` schema table in
  `documentation_v0/Step09_DesignCoreDataModel.md`
- Add the DTO property and an example in
  `documentation_v0/Step15_StoryContentAPIs.md`
- Update the per‑backend README changelog (e.g.
  `code/backend/java/README.md`, `code/backend/aws/README.md`,
  `code/frontend/react-game/README.md`)

---

## 10. The `card_type` field — current possible values

`card_type` classifies which kind of story sub‑entity a card belongs to.
The React Admin form exposes it as a dropdown driven by the
`CARD_TYPE_OPTIONS` list. Default catalogue:

| Value | Maps to table |
|---|---|
| `story` | `list_stories` (the story itself) |
| `difficulty` | `list_stories_difficulty` |
| `creator` | `list_creator` |
| `card` | `list_cards` (self‑referential / nested) |
| `text` | `list_texts` |
| `key` | `list_keys` |
| `class` | `list_classes` |
| `classBonus` | `list_classes_bonus` |
| `trait` | `list_traits` |
| `character` | `list_character_templates` |
| `location` | `list_locations` |
| `locationNeighbor` | `list_locations_neighbors` |
| `item` | `list_items` |
| `itemEffect` | `list_items_effects` |
| `event` | `list_events` |
| `eventEffect` | `list_events_effects` |
| `choice` | `list_choices` |
| `choiceCondition` | `list_choices_conditions` |
| `choiceEffect` | `list_choices_effects` |
| `weatherRule` | `list_weather_rules` |
| `globalRandomEvent` | `list_global_random_events` |
| `mission` | `list_missions` |
| `missionStep` | `list_missions_steps` |

The column is **declarative only** — there is no DB‑level FK; the rest of the
codebase still uses the integer `id_card` columns on each sub‑entity to point
at a specific card. `card_type` exists so the admin UI (and any future
content tooling) can filter or auto‑pick the right card for a given entity
type without scanning every related table.

To extend the catalogue:

1. Add the new value to `CARD_TYPE_OPTIONS` in
   `code/frontend/react-admin/src/constants/story/storyFieldOptions.js`
2. (Optional) Document it in this file
3. No backend changes are needed — the field is a free‑form `VARCHAR(50)`

---

## 11. Quick checklist

Use this when adding a new field to the card object:

- [ ] Add column to SQLite Flyway migration
- [ ] Add column to PostgreSQL Flyway migration (same version number)
- [ ] Add column to `models.py` `CardEntity` (Python)
- [ ] Update Java `CardEntity`, `CardInfo`, `CardInfoResponse`
- [ ] Update Java `ContentController` + `StoryController` mapping
- [ ] Update Java `ContentQueryService` + `StoryQueryService` builder
- [ ] Update Java `StoryImportService.importCards`
- [ ] Update Java `StoryCrudService.toMap` + `applyCardFields`
- [ ] Update Python `card_info.py`, query services, content controller, persistence map
- [ ] Update AWS `story/handler.py`, `content/handler.py`, `seed/handler.py`
- [ ] Update 3 OpenAPI yaml files
- [ ] Update `admin_crud.robot` (round‑trip assertion)
- [ ] Update React Admin `storiesEntities.jsx` (and `storyFieldOptions.js`
      if enumerated)
- [ ] Update React Game `GameCard.jsx` (if visual / rendered)
- [ ] Update `Step09` + `Step15` docs and per‑backend README changelogs
- [ ] Patch the unit tests that use positional constructors
      (Java `CardInfoResponseTest` / `StoryDetailResponseTest`)



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.


