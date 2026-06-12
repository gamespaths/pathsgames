# Node backend — OpenAPI/robot gap plan (stages 0–5)

All stages are **COMPLETE** as of 2026-06-11. `tsc --noEmit` = 0 errors, `jest` = 20/20 passing.

## Stage 1 — Admin match control (suite 20) ✅ DONE
`GET /api/admin/matches/statuses`, `GET /…/:m/info`, `POST /…/:m/stop|pause|resume`,
delete-terminal-only (409 `MATCH_NOT_STOPPED`), `MatchActionResult` shapes.
(7 jest tests in `matchAdmin.test.ts`)

## Stage 0 — Schema + import alignment ✅ DONE

Prisma schema reworked with new migration:
- Added models: `StoryText`, `StoryClass`, `Trait`, `CharacterTemplate`, `CharacterInstance`
- Updated: `Match` (name, loadout fields), `Difficulty` (traitCostBudgets), `Creator`
  (storyId FK, url/urlImage/urlEmote/urlInstagram/link), `Card` (storyId direct, creatorUuid)
- `StoryImportService` fully rewritten: persists texts, classes, traits, characterTemplates,
  creators, cards idempotently
- `seed.js` updated: 4 classes, 5 traits, 3 character templates for tutorial story

## Stage 2 — Content detail (suite 16) ✅ DONE

`ContentController` + `ContentQueryService` registered on `publicApp`:
- `GET /api/content/:uuidStory/cards/:uuidCard?lang` — resolves `idTextTitle`/`idTextDescription`
  to text (lang fallback en), embeds creator
- `GET /api/content/:uuidStory/texts/:idText/lang/:lang` — with fallback to en when requested
  lang is missing; returns `{idText, lang, resolvedLang, shortText, longText}`
- `GET /api/content/:uuidStory/creators/:uuidCreator?lang` — returns
  `{uuid, name, url, urlImage, urlEmote, urlInstagram}`
- 404 when story/card/creator/text not found

## Stage 3 — Story validation (suite 22) ✅ DONE

`StoryImportService` completely rewritten; `GET /api/admin/stories/:uuid/validate` added
to `StoryAdminController` on `adminApp`:
- Validates R_EVENT_REF, R_LOCATION_REF, R3_EVENT_CYCLE, R4_CHOICE_EMPTY, R6_CLASS_CONFLICT
- `POST /api/admin/stories/import` returns 400 `INVALID_STORY` with `errors[]` on validation
  failure
- Response shape: `{ valid:bool, count:int, errors:[{code,message,...}] }`
- Test suite: `storyImportValidation.test.ts`

## Stage 4 — Character selection (suite 21) ✅ DONE

`MatchCommandService.joinMatch()` + three endpoints on `publicApp`:
- `POST /api/matches/:uuid/join` (201/400/401/404/409) — instantiates `CharacterInstance`
  from loadout `{characterTemplateUuid, classUuid, traitUuids}` (falls back to match loadout)
- `GET /api/match/:uuid/players` — list character instances of the match
- `GET /api/match/:uuid/characters/:uuid` — one instance full detail
- Stats computation: `life = lifeMax + difficulty.life + class.lifeBonus + Σ trait.life`
- Test suite: `characterJoin.test.ts`

## Stage 5 — Traits + character stats (suite 23) ✅ DONE

- `GET /api/stories/:uuidStory/classes/:uuidClass/traits?lang` on `publicApp` — traits
  selectable with the class (filter `idClassPermitted`/`idClassProhibited`)
- Trait validation in both `joinMatch()` and `createMatch()`:
  TRAIT_NOT_FOUND, TRAIT_DUPLICATED, TRAIT_NOT_COMPATIBLE, TRAIT_COST_EXCEEDED
- Difficulty trait-cost budgets enforced at join time

## Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `jest` | 20/20 passing |
| New test suites | `storyImportValidation.test.ts`, `characterJoin.test.ts` |

## Endpoint → robot suite map (all implemented)

| Endpoint | Suite | Status |
|---|---|---|
| `GET /api/content/:story/cards/:card` | 16_content_detail | ✅ |
| `GET /api/content/:story/texts/:id/lang/:lang` | 16_content_detail | ✅ |
| `GET /api/content/:story/creators/:creator` | 16_content_detail | ✅ |
| `POST /api/matches/:uuid/join` | 21_character_selection | ✅ |
| `GET /api/match/:uuid/players` | 21_character_selection | ✅ |
| `GET /api/match/:uuid/characters/:uuid` | 21_character_selection | ✅ |
| `GET /api/stories/:uuid/classes/:uuid/traits` | 23_trait_selection | ✅ |
| `GET /api/admin/stories/:uuid/validate` | 22_story_validation | ✅ |
