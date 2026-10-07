# API Conventions

How the shared REST API is named, shaped and documented, so Java, Python and AWS keep
producing the same contract. Based on [Step06](documentation_v0/Step06_NamingConventions.md)
and [Step11](documentation_v0/Step11_DefineAPIVersioning.md), corrected against the actual
Java controllers where the two diverge — code is truth.

## 1. Base rules

- Every endpoint is prefixed with `/api/` except nothing — there is no separate unversioned
  root; the health check `/api/echo/status` is simply unversioned by convention.
- Path segments use **kebab-case** (e.g. `use-item`, `select-choice`, `change-password`).
- Resource collections are **plural nouns** (`/api/matches`, `/api/stories`); a single
  in-progress match's state lives under the **singular** `/api/match/{uuidMatch}/...` — the
  plural/singular split marks "collection" vs "one match's live state", not an inconsistency.
- HTTP verbs carry the action; URLs avoid verbs, with one deliberate exception: turn-locked
  player actions live under an explicit `action` sub-resource
  (`POST /api/gameplay/{uuidMatch}/action/sleep`, `.../action/select-choice`, `.../action/pass`,
  `.../action/use-exp`, `.../action/execute-event`) — the verb names *which* action, `action/`
  marks it as a command, not a resource to CRUD.
- Identifiers appear as path variables, generally UUIDs: `/{uuid}`, `/{uuidMatch}`,
  `/{uuidStory}`, `/{uuidCharacter}`.

## 2. Context prefixes (current)

| Prefix | Purpose |
|---|---|
| `/api/auth/...` | Guest login, session/token management |
| `/api/stories/...` | Story catalog (read-only reference data), categories, groups |
| `/api/content/...` | Story content detail (cards, texts, creators) |
| `/api/matches` | Match creation, join, start, list, logs (collection) |
| `/api/match/{uuidMatch}/...` | Read-heavy in-match state: info, players, characters,
  locations, missions, registry, turn-sequence, clock, weather |
| `/api/gameplay/{uuidMatch}/...` | Write-heavy, turn-locked player actions and inventory |
| `/api/admin/...` | Admin tools — served only on the dedicated admin port/API, see
  [Security §2](./Security.md) |
| `/api/dev/...` | Dev/test-only endpoints (e.g. test-data cleanup), never enabled in prod |
| `/api/echo/...` | Health check / internal diagnostics (unversioned) |

Query parameters use **camelCase** (`?limit=100&status=ACTIVE`); `?lang=` selects the
localized story text/card language and is forwarded end-to-end wherever content is resolved.

## 3. Versioning — planned vs actual (gap)

[Step11](documentation_v0/Step11_DefineAPIVersioning.md) specifies a DNS/path
versioning scheme (`/api/{version}/...`, e.g. `/api/v1/...`) with a `VersionController` at
`/api/versions`. **This was never implemented**: no controller in
`code/backend/java/adapter-rest` has a version segment in its path, and none of Python/AWS do
either. In practice the API has stayed a single, evolving `v1` contract with no version
segment in the URL; per-endpoint history is tracked instead through the OpenAPI file names
(§5) and the `documentation_vN/StepNN_*.md` history. Treat Step11's DNS-versioning design as
aspirational until (or unless) it is actually built.

## 4. JSON / DTO naming

- JSON fields: **camelCase** (`characterId`, `isSleeping`, `deadlineTimestamp`).
- Enum/status string values: **SCREAMING_SNAKE_CASE** (`IN_PROGRESS`, `SLEEPING`,
  `CHOICES_PENDING`).
- DTO class suffix by purpose: `Request` (request body), `Response` (response body), `DTO`
  (internal transfer object). Example: `CreateMatchRequest`, `MatchSummaryResponse`.

## 5. Error format

Every backend returns the same shape on error, regardless of status code:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description", "timestamp": 1700000000000 }
```
`ERROR_CODE` is SCREAMING_SNAKE_CASE and stable across Java/Python/AWS (e.g.
`WEATHER_NOT_FOUND`, `ACTIVE_MATCH_ALREADY_EXISTS`, `TRAIT_NOT_SELECTABLE`,
`MISSING_TOKEN`, `INVALID_TOKEN`, `FORBIDDEN`). Confirmed against the Java
`JwtAuthenticationFilter` and the per-controller `error(status, code, message)` helpers — all
build this exact envelope. Success responses put data directly at root level, or wrap it in a
paged envelope only when pagination metadata is needed (§6).

## 6. Pagination

Cursor-based, not offset-based, wherever a list can grow without bound (matches, admin
guests, match logs):
```json
{ "items": [ "..." ], "nextCursor": "opaque-cursor-or-null", "limit": 50 }
```
`nextCursor` is `null` on the last page. Callers pass `?limit=` and `?cursor=` (plus
resource-specific filters, e.g. `?status=`, `?userUuid=`, `?storyUuid=`, `?sinceDays=` on
admin matches). AWS backs this with a DynamoDB GSI keyset; Java/Python with a keyset query on
the relational tables — the wire shape is identical across all three.

## 7. OpenAPI specs

Location: `code/backend/java/adapter-rest/src/main/resources/openapi/`. One file per feature
step, named `vX.Y.Z-name-api.yaml` where `X.Y.Z` is the version that introduced or changed the
endpoint (e.g. `v0.12.0-guest-auth-api.yaml`, `v0.28.0-movement-api.yaml`,
`v0.37.7-security-api.yaml`, `v0.39.0-random-events-api.yaml`). All three backends implement
the same OpenAPI-described contract; Java's spec files are the canonical copy.

## 8. Admin API isolation

`/api/admin/**` is never reachable on the public port/listener: Java/Python 404 it on port
`8042`/`8080` and only serve it on admin port `8044`; AWS puts it behind a separate API
Gateway (`PathsGamesAdminApi`) with its own IP-allow-list Lambda authorizer. See
[Security](./Security.md) for the full access-control picture.

## 9. Cross-backend consistency

Because Java, Python and AWS all implement this same contract, a change to an endpoint's
path, request/response shape, error code or the underlying DB columns is made in all three
places at once, together with the OpenAPI spec (§7) and the Robot Framework suite that
exercises the endpoint on every backend — see [Architecture §9](./Architecture.md).

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared guide to how the API is named | September 25, 2026 |

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
