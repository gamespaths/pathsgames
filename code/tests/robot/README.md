# Paths Games — Robot Framework Integration Tests

End-to-end API tests for the Paths Games backend. The same test suite validates all five backend implementations (Java, Python, AWS) via `variables/dev.yaml`.

## Structure

```
robot/
├── requirements.txt               Python deps (robotframework, requests library)
├── variables/
│   └── dev.yaml                   Environment variables (base URL, admin token, UUIDs)
├── resources/
│   ├── common.resource            Shared keywords (sessions, assertions)
│   ├── auth.resource              Auth flow keywords (guest login, token helpers)
│   ├── stories.resource           Story API keywords (import, list, detail, delete)
│   └── matches.resource           Match API keywords (Create Match, Create Match With Loadout)
└── tests/
    ├── 01_smoke/
    │   └── smoke.robot            Server up, public reachable, admin guard works
    ├── 12_auth/
    │   └── guest_auth.robot       Guest login, /me, logout, PLAYER role guard
    ├── 14_stories/
    │   ├── story_list.robot              GET /api/stories — list, fields, UUIDs
    │   ├── story_detail.robot            GET /api/stories/{uuid} — detail, 404
    │   └── difficulty_stat_fields.robot  Seven stat fields (life/energy/sad/dexterity/intelligence/constitution/weight) on every difficulty entry; seed values for tutorial; sign constraints (4 tests)
    ├── 14_admin/
    │   ├── story_import.robot     POST/GET/DELETE /api/admin/stories — import, idempotency, character-template FK round-trip
    │   └── guest_admin.robot      GET/DELETE /api/admin/guests — list, stats, single, expired
    ├── 15_story_content/
    │   ├── story_categories.robot             GET /api/stories/categories and /category/{cat}
    │   ├── story_groups.robot                 GET /api/stories/groups and /group/{group}
    │   ├── story_detail_enriched.robot        Classes, templates, traits, card in story detail
    │   ├── story_card_populated.robot         Card fields populated for sub-entities
    │   ├── story_detail_class_bonuses_and_templates.robot   bonuses[] on each class; idClassPermitted / idClassProhibited on character templates
    │   └── story_detail_trait_stats.robot     Seven stat-delta fields (life/energy/sad/dexterity/intelligence/constitution/weight) on every trait; seed sanity for non-zero bonus; Demo 2 coverage
    ├── 16_content_detail/
    │   ├── content_card.robot
    │   ├── content_creator.robot
    │   └── content_text.robot
    ├── 17_admin_crud/
    │   └── admin_crud.robot       Admin CRUD for all story entity types
    ├── 19_match/
    │   └── match_creation.robot   POST /api/matches happy path, missing fields, no token, full loadout round-trip (v0.19.9)
    ├── 28_movement/
    │   ├── movement.robot              POST movements/start + GET locations: energy cost, adjacency, error codes, admin locations (10 tests)
    │   ├── neighbor_card_back.robot    Covered by suite 29_neighbor_card_back
    │   ├── neighbor_flag_back.robot    One-way links: flagBack=YES returns backward neighbor; flagBack=NO hides it in /info + /locations (2 tests, v0.28.3)
    │   └── location_cards.robot        GET /locations returns a full `card` per location + neighbor, ?lang= param, admin==player view (5 tests, v0.28.5)
    ├── 29_neighbor_card_back/
    │   └── neighbor_card_back.robot   Admin-set idCardBack reflected in match-info neighbors; guards AWS locationNeighbors desync (v0.28.2)
    └── 30_event_location/
        └── event_location.robot       Admin-set idSpecificLocation reflected in locationsActive[].events; guards AWS stale-alias + Python column bugs (v0.28.2)
```

## Setup

```bash
cd code/tests/robot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Admin Token

The admin-protected tests require a valid admin JWT.
There is no `username+password` login endpoint — tokens are:
1. Obtained by logging in from the admin panel (`/admin.html` → Token field)
2. Passed via `variables/dev.yaml`:
   ```yaml
   ADMIN_TOKEN: "eyJ..."
   ```
3. Or overridden at run time:
   ```bash
   ROBOT_VAR_ADMIN_TOKEN="eyJ..." robot --variablefile variables/dev.yaml tests/
   ```

## Running Tests

Start the desired backend first, then run the Robot tests. Use the convenience scripts from the repo root:

| Backend | Script |
|---|---|
| Java + SQLite | `code/scripts/dev/run_robots/run_robot_with_local_java.sh` |
| Java + PostgreSQL | `code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh` |
| Python | `code/scripts/dev/run_robots/run_robot_with_local_python.sh` |
| AWS Serverless | `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh` |

Alternatively, start any backend manually on port 8042 (public) + 8044 (admin), then:

### All tests

```bash
robot --variablefile variables/dev.yaml tests/
```

### Only smoke tests

```bash
robot --variablefile variables/dev.yaml --include smoke tests/
```

### Only public-endpoint tests (no admin token needed)

```bash
robot --variablefile variables/dev.yaml --include smoke --include stories tests/
```

### Only auth tests

```bash
robot --variablefile variables/dev.yaml --include auth tests/
```

### Only admin tests

```bash
robot --variablefile variables/dev.yaml --include admin tests/
```

### With output dir

```bash
robot --variablefile variables/dev.yaml --outputdir reports/ tests/
```

## Tags Reference

| Tag            | Test suites |
|----------------|-------------|
| `smoke`        | 01_smoke/smoke.robot |
| `auth`         | 12_auth/guest_auth.robot |
| `stories`      | 14_stories/story_list.robot, story_detail.robot, difficulty_stat_fields.robot |
| `admin`        | 14_admin/story_import.robot, guest_admin.robot |
| `step12`       | Auth and guest management tests |
| `step14`       | Story list, story detail, difficulty stat fields |
| `step15`       | Story content: categories, groups, enriched detail, class bonuses, character template class fields, trait stat-delta fields |
| `guests`       | Guest admin management tests |
| `movement`     | 28_movement/movement.robot — adjacency, energy cost, error codes, admin locations; 28_movement/location_cards.robot |
| `step28`       | 28_movement/movement.robot, neighbor_flag_back.robot, location_cards.robot; 29_neighbor_card_back/neighbor_card_back.robot; 30_event_location/event_location.robot |
| `flag-back`    | 28_movement/neighbor_flag_back.robot — one-way link enforcement (v0.28.3) |
| `movement-back`| 28_movement/neighbor_flag_back.robot; 29_neighbor_card_back/neighbor_card_back.robot |
| `match-info`   | 29_neighbor_card_back/neighbor_card_back.robot; 30_event_location/event_location.robot; 28_movement/neighbor_flag_back.robot |
| `regression`   | 28_movement/neighbor_flag_back.robot; 29_neighbor_card_back/neighbor_card_back.robot; 30_event_location/event_location.robot |
| `locations`    | 28_movement/location_cards.robot — full `card` resolution on GET /locations (v0.28.5) |
| `location-card`| 28_movement/location_cards.robot (5 tests, v0.28.5) |

## Seed Data

The dev database (`R__insert_story_seed_data.sql`) contains:

| Story       | UUID                                   | Visibility |
|-------------|----------------------------------------|------------|
| Tutorial | `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d` | PUBLIC     |
| Demo 1   | `b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e` | PUBLIC     |

Import-only stories (JSON files in `adapter-sqlite/.../dev/`):

| Story      | UUID                                   |
|------------|----------------------------------------|
| Demo 3    | `c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f` |
| Demo 4    | `d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a` |








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





