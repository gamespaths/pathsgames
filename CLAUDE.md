# CLAUDE.md

Guidance for Claude Code in this repo. **Keep this file small** — it is loaded into every
session, so every line here is paid for on every request. Reference material belongs in the
on-demand files listed below, not here.

**Paths Games** is a web gamebook: a multi-user storytelling platform with branching
narratives. The repo holds several backends (Java is the reference implementation; Python
and AWS track it), a React admin frontend, a React game frontend, and Robot Framework E2E
tests — all sharing one REST API contract.

Caveman mode (full) is always active: a SessionStart hook loads `.claude/hooks/caveman-rules.md`.

## Read on demand (do NOT preload)

| Need | File |
|---|---|
| Build / run / test any component | `.claude/docs/commands.md` |
| Robot suites, seed files, report paths | `.claude/docs/robot-suites.md` |
| Anything in the design docs | `wiki/INDEX.md` — the single map (shared docs + one line per version). **Never open a Step file without it.** |
| Versions, 42-step rules, recurring steps | `wiki/VersionTemplate.md`, `wiki/Roadmap.md` |
| Game rules / data model / story format | `wiki/GameRules.md`, `DataModel.md`, `StoryFormat.md` |
| Search the design docs | Ask the `doc-finder` subagent (Haiku, read-only, returns a summary) |
| Analyse a step / develop an analysed step | `paths-games-new-feature` / `paths-games-dev-feature` subagents |

`wiki/` holds small shared docs (current state). Each version has `wiki/documentation_vN/`
(own `INDEX.md`, `Roadmap.md` with 42 steps, step files). `wiki/documentation_v0/` is ~4.2 MB (~1M
tokens), `Step28_MovementSystem.md` alone 29k: grep and read line ranges; never `cat` a Step file.
Never read `wiki/documentation_v0/website_concepts_v0/` (450 MB of images).

## Hard rules

- **Never commit or push.** No exceptions.
- **Never bump the version** unless the prompt says so. Current version = `code/backend/java/pom.xml` minus `-SNAPSHOT`.
- **Never touch NotebookLM** unless the prompt says so. (Notebook: "PathsGames - Storytelling Game Platform", `NOTEBOOK=cd7b4625-76cd-4531-971a-98df705b840e`.)
- Take your time — an accurate answer beats a fast one.
- Never change `.env` & `.env.test` files , ask me after any changes.
- Never change files into `.alnao` folder.

## Permissions

- **Allowed without asking:** reading anything in the workspace (`cat`, `find`, `grep`, `sed`, `awk`, `for`, `do`,`echo`, …); `source .venv/bin/activate`; builds and unit tests (`mvn`, `pytest`, `npx`,`npx vitest`, `run_robots*.sh`, `python3`,`python`).
- **Always ask first:** starting servers, any cloud/AWS CLI command, anything writing outside the workspace.

## When you change code

- Python and Robot commands always run inside the venv: `source .venv/bin/activate`.
- Java / Python / React changes need unit tests; coverage of new code must be **> 96%**.
- Changing one backend usually means changing the others — they share the API contract.
- Docs are updated **on request**, via `/doc-update` (runs the `paths-games-doc` subagent). Do not offer it after every task; suggest it only when a feature is complete or the API, schema, or a component actually changed.
    - Version Control table of any doc: max ONE row per version, at the bottom; description ONE line, max 10 plain non-technical words. Row for the current version already there → no new row, at most extend it with a short phrase.
    - Index files: one line of description per file, Keywords max 10 words. `wiki/INDEX.md` = shared files + one line per version; `wiki/documentation_vN/INDEX.md` = only that version.
    - Docs of previous (launched) versions are frozen: never edit them, except their `Hotfixes.md`. Shared docs stay small and current. Everything in English.
- When you add/change comments (for example // in java) add maximum one row.
    On head of file (example with /** comment */ in java) add maximum two row

## Architecture

Java backend — hexagonal, `code/backend/java/`:

```
ms-launcher      Spring Boot entry point; DI wiring
core/            Pure domain, no framework deps (entity/, port/, service/, model/, repository/)
adapter-rest/    REST controllers; OpenAPI specs in src/main/resources/openapi/
adapter-auth/    JWT, Google SSO, Spring Security
adapter-admin/   Admin REST endpoints
adapter-websocket/  Real-time game state sync
adapter-postgres/   JPA + Flyway (prod)     adapter-sqlite/  SQLite + Flyway (dev)
adapter-mongo/      Document registries     adapter-kafka/   Async messaging
```

- **Dev profile** (default): public port 8042, SQLite at `~/.paths.games/database.sqlite`.
- **Prod profile**: public port 8080, PostgreSQL via `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD`.
- **Admin port 8044** (both profiles, `game.admin.port` / env `ADMIN_PORT`): serves `/api/admin/**` and nothing else; the public connector 404s on admin paths. Lock 8044 to the owner IP at the network layer.
- Flyway migrations run on startup, in `adapter-{postgres,sqlite}/src/main/resources/db/migration/`.

Python backend mirrors the same hexagonal split (`app/core/`, `app/adapters/`, `app/launcher.py`).
AWS backend is serverless: API Gateway (HTTP v2) → Lambda (Python 3.13) → DynamoDB single-table
with GSIs, deployed with SAM, envs `dev`/`prod`.
React admin: React 18 + Vite 5, Tailwind, Bootstrap 5 (CDN), Axios, Router 6; medieval dark
theme with `pg-*` classes; JWT admin token pasted at login; dev proxy `/api/*` → 8044.

**There is no Node.js backend** — it was removed from the project.

## API conventions

- OpenAPI specs: `code/backend/java/adapter-rest/src/main/resources/openapi/`. All REST APIs are OpenAPI-compatible.
- Prefix `/api/`, no explicit version in V1. Kebab-case segments, plural resource nouns, no verbs in URLs.
- Contexts: `/api/auth/`, `/api/stories/`, `/api/content/`, `/api/matches/`, `/api/match/{uuidMatch}/`, `/api/gameplay/{uuidMatch}/`, `/api/admin/`, `/api/echo/` (`/api/dev/` dev only).

## Output

End every message with one line: token usage, token limit, % used. Ask me if i wanna call "paths-games-doc" agent!

If the prompt contains **"log all command"**: for each command you run, append to
`.agents/logs/YYYYMMDD.log` the date, the full prompt, and two lines describing what you did,
then 5 blank lines and `-------------------------------`.
