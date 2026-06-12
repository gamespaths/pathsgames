# Paths Games — Flask Admin Console (`python-flask-admin`)

A server-side rendered (Flask + Jinja2) twin of the React admin console
(`code/frontend/react-admin/`), built with **as little JavaScript as possible**,
using **Bootstrap 5** + **Font Awesome** (CDN). It is a thin UI over the
admin REST API and reuses the same medieval `pg-*` styles.

## Stack
- **Flask** >= 3.0 + **Jinja2** (server-side rendering)
- **Bootstrap 5** via CDN — grid, modals, tables
- **Font Awesome** via CDN — icons
- **requests** >= 2.31 — HTTP calls to the admin backend
- **pytest** >= 8.0 — unit tests (backend mocked via `unittest.mock`)
- **JavaScript**: minimal — only `static/js/admin.js` for the fast-create modal (`fetch` POST). All other UI is plain HTML forms.
- Dev port: **5098**

## Backend
The console talks ONLY to `/api/admin/**` endpoints, served on the dedicated
**admin port 8044**. You authenticate by pasting a JWT admin access token on the
login screen (kept in the Flask session); every request carries it as a bearer
token. The server URL defaults to `http://localhost:8044` and can be changed on
the login screen or via `ADMIN_BASE_URL`.

## Pages
| Route | Page |
|---|---|
| `/login` | Paste JWT token + admin server URL |
| `/` | Dashboard — server status, guest stats, story count |
| `/guests` | Guest (anonymous user) admin — list, delete, purge expired |
| `/stories` | Story list — create / delete / open editor |
| `/stories/import` | Import a story from `tutorial_story.json` (paste or upload) |
| `/stories/<uuid>/edit` | Story editor — metadata + CRUD over all 22 sub-entities (tabbed) |
| `/stories/<uuid>/validate` | Story integrity report |
| `/matches` | Match admin — list + stop/pause/resume/delete |
| `/matches/<uuid>` | Match detail — info, characters, status/name edit, controls |
| `/echo` | Server status |

### Fast card / fast text (no page change)
Inside the story editor, every entity form has **Fast card** and **Fast text**
buttons. They open a Bootstrap modal and create the card/text via a small
`fetch` POST (`/stories/<uuid>/fast/card|text`) — the only custom JavaScript in
the project — then write the new id back into the entity form field, without
reloading the page.

## Entity coverage
All 22 story sub-entities from react-admin are ported in `app/entities.py`
(tabs, table columns, form fields + select options): cards, creators, texts,
keys, difficulties, locations, location-neighbors, events, event-effects, items,
item-effects, character-templates, classes, class-bonuses, traits, choices,
choice-conditions, choice-effects, weather-rules, global-random-events,
missions, mission-steps.

## Admin APIs covered

| API | Endpoint |
|-----|----------|
| Server status | `GET /api/echo/status` |
| Guest statistics | `GET /api/admin/guests/stats` |
| List all guests | `GET /api/admin/guests` |
| Get guest by UUID | `GET /api/admin/guests/:uuid` |
| Delete guest | `DELETE /api/admin/guests/:uuid` |
| Cleanup expired guests | `DELETE /api/admin/guests/expired` |
| List all stories | `GET /api/admin/stories` |
| Create story | `POST /api/admin/stories` |
| Delete story | `DELETE /api/admin/stories/:uuid` |
| Import story | `POST /api/admin/stories/import` |
| Validate story | `GET /api/admin/stories/:uuid/validate` |
| CRUD all 22 sub-entities | `/api/admin/stories/:uuid/<entity>` |
| List all matches | `GET /api/admin/matches` |
| Match detail | `GET /api/match/:uuid/info` |
| Stop / pause / resume match | `PUT /api/admin/matches/:uuid` |
| Delete match | `DELETE /api/admin/matches/:uuid` |

## Run
```bash
cd code/frontend/python-flask-admin
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py            # http://localhost:5098
```

Live backend (default `http://localhost:8044`):
```bash
ADMIN_BASE_URL=http://localhost:8044 python run.py
```

## Test
```bash
source .venv/bin/activate
pytest                                          # 35 tests, api mocked — no backend needed
pytest --cov=app --cov-report=term-missing
```

## Environment variables
| Variable | Default | Description |
|---|---|---|
| `ADMIN_BASE_URL` | `http://localhost:8044` | Admin backend base URL |
| `SECRET_KEY` | dev value | Flask session signing key — override in production |
| `BACKEND_TIMEOUT` | `15` | HTTP timeout (seconds) |
| `PORT` | `5098` | Dev server port |

## Structure
```
python-flask-admin/
├── run.py                   # Entry point — creates app and starts dev server
├── requirements.txt
├── pytest.ini
├── app/
│   ├── __init__.py          # create_app factory + blueprint wiring + context_processor
│   ├── config.py            # env config (ADMIN_BASE_URL, SECRET_KEY, BACKEND_TIMEOUT, PORT)
│   ├── api.py               # admin REST client (JWT from session) — port of react-admin api/*.js
│   ├── auth.py              # session login/logout + login_required decorator
│   ├── entities.py          # 22 entities: tabs / columns / fields / select options
│   ├── forms.py             # HTML form → typed JSON payload coercion
│   └── blueprints/          # auth, dashboard, guests, stories, editor, story_import, matches, echo
├── templates/
│   ├── base.html            # Base layout: navbar, sidebar, flash messages, theme
│   ├── partials/            # navbar, sidebar, footer, flash, entity_field includes
│   └── story/               # story editor templates (editor, import, validate)
├── static/
│   ├── css/admin.css        # pg-* styles from react-admin index.css (Tailwind directives stripped)
│   └── js/admin.js          # the only JS: fast-create modal fetch helper
└── tests/
    ├── conftest.py          # Flask test client fixture
    ├── test_entities.py     # entity registry completeness and field definitions
    ├── test_forms.py        # HTML form → payload coercion
    ├── test_api.py          # REST client with requests mocked
    └── test_routes.py       # HTTP route smoke tests (login, dashboard, guests, stories, matches, echo)
```

## Version Control
- **Document Version**: 0.22.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.22.0 | Initial implementation — Flask + Jinja2 admin console covering all react-admin features: 10 pages, 22 sub-entities, fast-create modals, match controls, story import/validate, 35 pytest tests | June 11, 2026 |
- **Last Updated**: June 11, 2026
- **Status**: Active development


---

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
