# Paths Games - Backend Python

This is a backend for Paths Games, a game platform. 

This version of backend is written in Python and uses FastAPI and SQLAlchemy (multi-module backend using **Hexagonal Architecture**  with Ports and Adapters).


## Project Structure

```
code/backend/python/
├── app/
│   ├── core/           # Pure domain: ports, services, models (no FastAPI/SQLAlchemy)
│   ├── adapters/       # Infrastructure: REST, Auth, Persistence
│   ├── config.py       # Configuration loading
│   └── launcher.py     # Application entry point & DI wiring
├── tests/              # Unit tests
├── Dockerfile          # Container image definition
├── .env.example        # Environment variables template
├── pyproject.toml      # Dependency management
└── README.md
```

## Quick Start

- Prerequisites: **Python 3.13+** and `apt install libpq-dev`
- Install dependencies:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
- Run (development):
    ```bash
    python3 -m app.launcher
    ```
- Run (production):
    ```bash
    uvicorn app.launcher:app --host 0.0.0.0 --port 8042
    ```

## Run with Docker

The Dockerfile builds a single image that serves **both** FastAPI apps in one process
(`python -m app.launcher`):
- **port 8042** — public API (`/api/auth`, `/api/stories`, `/api/matches`, …)
- **port 8044** — admin API (`/api/admin/**`, `/api/dev/**`)

The `HOST` environment variable controls the bind address for both uvicorn servers.
Default in `app/config.py` is `127.0.0.1` (loopback, safe for local dev); the
Dockerfile overrides it to `HOST=0.0.0.0` so published ports are reachable from
outside the container.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- A `.env` file created from `.env.example` (copy and edit it):
    ```bash
    cp .env.example .env
    ```

### Development mode (SQLite, no external DB needed)

```bash
# Build the image
docker build -t pathsgames-backend-python .

# Run with SQLite (default ENV=development), publish both ports
docker run --rm \
  -p 8042:8042 -p 8044:8044 \
  -e ENV=development \
  -e JWT_SECRET=PathsGamesDevSecret2026_MustBeAtLeast32Chars! \
  -v "$(pwd)/database.sqlite:/app/database.sqlite" \
  pathsgames-backend-python
```

> The `-v` mount persists the SQLite database across container restarts.

### Production mode (PostgreSQL)

```bash
docker run --rm \
  -p 8042:8042 -p 8044:8044 \
  -e ENV=production \
  -e JWT_SECRET=<your-strong-secret> \
  -e CORS_ALLOWED_ORIGINS=https://paths.games,https://www.paths.games \
  -e DB_HOST=<postgres-host> \
  -e DB_PORT=5432 \
  -e DB_NAME=pathsgames \
  -e DB_USER=pathsgames \
  -e DB_PASSWORD=<db-password> \
  pathsgames-backend-python
```

> `DB_USER` is the Python env key for the database username (the Java backend uses `DB_USERNAME` instead).

### Using an `.env` file

```bash
docker run --rm -p 8042:8042 -p 8044:8044 --env-file .env pathsgames-backend-python
```

### Build and push for EC2 (test environment)

A dedicated script builds the image for `linux/amd64` (required for EC2 `t3` instances)
and pushes it to Docker Hub with tag `:test-python`:

```bash
# From the repo root
code/scripts/test/build_docker_python_test_and_push.sh

# Preview only (no push)
code/scripts/test/build_docker_python_test_and_push.sh --dry-run
```

This is the Python counterpart of `build_docker_test_and_push.sh` (Java). After pushing,
use `code/scripts/test/aws_ec2_with_python_docker/redeploy.sh` to roll the image onto a
running EC2 instance (server3), or `start.sh` to launch a fresh one. See
`documentation_v0/Step20_GameWebSiteFirstRun.md` — "EC2 Docker Deploy (Python / server3)"
for full details.

### Useful Docker commands

```bash
# Check running containers
docker ps

# View logs
docker logs <container-id>

# Stop a running container
docker stop <container-id>

# Remove the image
docker rmi pathsgames-backend-python
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/echo/status` | Server status, timestamp, and properties |
| POST | `/api/auth/guest` | Create a new guest session |
| POST | `/api/auth/guest/resume` | Resume an existing guest session |
| GET | `/api/admin/guests` | List all guest users |
| GET | `/api/admin/guests/stats` | Guest statistics |
| GET | `/api/admin/guests/{uuid}` | Get guest by UUID |
| DELETE | `/api/admin/guests/{uuid}` | Delete guest by UUID |
| DELETE | `/api/admin/guests/expired` | Cleanup expired guests |
| GET | `/api/stories` | List stories (can filter by language `?lang=en`) |
| GET | `/api/stories/{uuid}` | Get story details |
| GET | `/api/admin/stories` | List all stories (including non-public) |
| POST | `/api/admin/stories/import` | Import a JSON story tree |
| DELETE | `/api/admin/stories/{uuid}` | Delete story by UUID |
| POST | `/api/matches` | Create a new single-player match |
| GET | `/api/matches` | List matches owned by the authenticated user |
| GET | `/api/match/{uuid}/info` | Match runtime state (summary, location/registry state) |
| GET | `/api/admin/matches` | List all matches on the platform (ADMIN only) — paged envelope `{items, nextCursor, limit}`; query params: `limit`, `cursor`, `status`, `userUuid`, `storyUuid`, `sinceDays` |

## Architecture

Following the **Hexagonal Architecture** pattern:
1. **Core**: Contains domain entities and logical services. Independent of external frameworks.
2. **Ports**: Interfaces that define how the core interacts with the outside world.
3. **Adapters**: Implementations of ports for specific technologies (FastAPI, SQLAlchemy, PyJWT).

## Testing the API

Once the server is running (default: `http://localhost:8042`), you can use the following `curl` commands to test the endpoints:

### 1. Echo / Health Check
```bash
curl -s http://localhost:8042/api/echo/status | python3 -m json.tool
```

### 2. Guest Login (Create Session)
```bash
curl -X POST -s http://localhost:8042/api/auth/guest | python3 -m json.tool
COOKIE_TOKEN=$(curl -X POST -s http://localhost:8042/api/auth/guest | python3 -m json.tool | grep guestCookieToken | cut -d '"' -f 4)
echo $COOKIE_TOKEN
```

### 3. Resume Guest Session
Replace `<COOKIE_TOKEN>` with the `guestCookieToken` received from the create call:
```bash
curl -X POST -s http://localhost:8042/api/auth/guest/resume \
     -H "Content-Type: application/json" \
     -d '{"guestCookieToken": "'$COOKIE_TOKEN'"}' | python3 -m json.tool
```

### 4. Admin: List Guests
```bash
curl -s http://localhost:8042/api/admin/guests | python3 -m json.tool
```

### 5. Admin: Guest Stats
```bash
curl -s http://localhost:8042/api/admin/guests/stats | python3 -m json.tool
```

### 6. Admin: Delete Guest
```bash
curl -X DELETE -s http://localhost:8042/api/admin/guests/<UUID> | python3 -m json.tool
```

### 7. Running Automated Tests
```bash
PYTHONPATH=. pytest -v tests/
```





# Version Control
- Starting from 0.12.2 version, code is created with AI prompt:
    > Ciao, read all "documentation_v0" and ""code/backend" content, now i wanna create "code/backend/python" project, let's go!

    > add into readme file a "test" section with all curl calls

- **Document Version**: 0.28.6
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.12.3 | First version of this document | March 31, 2026 |
    | 0.12.5 | Add Docker section, fix production port, update project structure | April 1, 2026 |
    | 0.14.1 | Manage projects structure and 101 steps definition | April 09, 2026 |
    | 0.19.7 | list_stories_difficulty: added 7 stat columns (life, energy, sad, dexterity, intelligence, constitution, weight) to SQLAlchemy StoryDifficultyEntity; DifficultyInfo dataclass updated; story_query_service and persistence adapter save_difficulties updated; seed_dev_data and seed_stories include new fields; 48 unit tests pass | May 19, 2026 |
    | 0.19.9 | gaming_match: 4 loadout columns added (single_player, character_template_uuid, class_uuid, trait_uuids) via SQLAlchemy create_all (model updated); MatchCreateRequest and MatchSummary extended with classUuid, traitUuids, singlePlayer (characterTemplateUuid now persisted); trait list encoded as comma-separated string; 67 unit tests pass | May 20, 2026 |
    | 0.19.10 | GET /api/admin/matches: MatchController.list_all_matches, MatchQueryService.list_all_matches, MatchPersistenceAdapter.find_all_matches; 341 unit tests pass | May 20, 2026 |
    | 0.24.1 | Dockerfile rewritten to expose both ports 8042+8044 and run a single `python -m app.launcher` process. `app/config.py` gains `host` setting (default `127.0.0.1`, overridden to `0.0.0.0` by `HOST` env var in Docker). `launcher.py` uses `settings.host` for both uvicorn servers. New `tests/test_config_host.py`. New `code/scripts/test/build_docker_python_test_and_push.sh` and EC2 lifecycle scripts under `aws_ec2_with_python_docker/` (server3, tag `:test-python`). 524 unit tests pass | June 14, 2026 |
    | 0.28.1 | GET /api/admin/matches pagination & filtering: `MatchAdminController.list_all_matches` accepts query params (`limit`, `cursor`, `status`, `userUuid`, `storyUuid`, `sinceDays`); `MatchQueryService.list_matches_page` with helpers `_clamp_limit`, `_since_days_to_ts`, `_encode_cursor`, `_decode_cursor`; `MatchPersistenceAdapter.find_matches_page` (SQLAlchemy keyset on `ts_insert DESC, id DESC`); new dataclasses `MatchListFilter`, `MatchSummaryPage` in core models; response envelope `{items, nextCursor, limit}`; 699 unit tests pass | Jun 26, 2026 |
    | 0.28.5 | `GET /api/match/{uuid}/locations` and the admin variant now resolve a full `card` object per location/neighbor plus `?lang=` (default `en`). `MovementService.__init__` gained an optional `story_read_port` (backward-compatible); new `_resolve_card`/`_resolve_card_text` helpers; `movement_controller.py` and `match_admin_controller.py` accept `lang`; `launcher.py` wires the story read port into `MovementService`; `scripts/seed_stories.py` adds `idCard` to the tutorial locations for parity with Java/AWS. No change to location/neighbor lookup logic. 711 unit tests pass | Jul 11, 2026 |
    | 0.28.6 | Bugfix — fog-of-war leak on neighbor location cards: v0.28.5's card enrichment exposed the card of locations never visited by the match. `movement_service._build_locations` now nulls a neighbor's `id_card`/`card` when its destination is outside `find_visited_location_ids`. `match_query_service.MatchQueryService.__init__` gained an optional `movement_store=None` param; `_build_locations_active` gained a `visited_loc_ids` param and only nulls the **fallback** to the destination location's card, never an explicit `id_card` set on the neighbor edge itself. `launcher.py` now builds `movement_store_adapter` once, ahead of `match_query_service`, and shares it with `MovementService`. New Robot suite `28_movement/location_fog_of_war.robot` (4 tests). 715 unit tests pass | Jul 11, 2026 |
    | 0.28.6 | **Bugfix (production-visible)**: `StoryMatchReadAdapter.find_locations_by_story_id` projected only `{id, uuid, counter_time}`, but `_build_locations_active` reads `id_card` and `secure_param` off those dicts — so `/info` `locationsActive[].card` and `.secureParam` were ALWAYS `null` in production (the mocked unit fixture hid it). The projection now carries `id_card` and `secure_param` (`is_safe` doubles as `secure_param` in the Python schema). **Side effect: `locationsActive[].secureParam` now returns `0|1` instead of `null`, matching Java.** Contract changes: `/info` `locations[]` is VISITED-ONLY on the player endpoint (`_build_detail` gained `all_locations`, set True by `get_match_info_for_admin` so the console keeps the full runtime table); `MatchLocationState.name`, `MatchDetail.current_location_name` and `CharacterInstanceInfo.location_name` removed; `LocationNeighborInfo` gained `card_location_from` / `card_location_to` — the LOCATION card of each edge endpoint, gated on that endpoint's own visited flag via the new `_resolve_location_card`. New Robot suite `28_movement/match_info_visited_locations.robot` (5 tests). 719 unit tests pass, 92% coverage | Jul 11, 2026 |
    | 0.29.0 | (still v0.29.0, no version bump) Movement availability verdict on `/info`: `locationsActive[].neighbors[]` gains `available`/`reason`, mirroring the `available`/`reason` flag already published for events (Step 29). New pure `app/core/services/match/movement_availability.py`, sharing the same 8-code order as `movements/start` (`CHARACTER_CANNOT_ACT` → `MATCH_NOT_RUNNING` → `COMA` → `SLEEPING` → `NOT_A_NEIGHBOR` → `MOVEMENT_CONDITION_NOT_MET` → `OVERWEIGHT` → `INSUFFICIENT_ENERGY` → `LOCATION_FULL`); `movement_service._start_movement` refactored to call the checker instead of its own if-chain; `match_query_service` loads the check context once per request and loops the checker over neighbors, no query per edge. No schema change | Jul 13, 2026 |
- **Last Updated**: Jul 13, 2026
- **Status**: In progress





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




