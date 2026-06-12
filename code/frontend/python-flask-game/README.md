# Paths Games — Flask Frontend (`python-flask-game`)

A server-side rendered (Flask + Jinja2) alternative to the React game frontend
(`code/frontend/react-game/`), built with **as little JavaScript as possible**.
It reuses the same medieval colour palette, styles and translation files
(`en.json` / `it.json`), and the same public API contract (port 8042).

# Version Control
- Starting from 0.1.0 version

## Tech Stack
- **Flask** >= 3.0 + **Jinja2** (server-side rendering)
- **Bootstrap 5** via CDN — grid, cards
- **Font Awesome** via CDN — icons
- **requests** >= 2.31 — optional backend calls with mock fallback
- **pytest** >= 8.0 — unit tests
- **JavaScript**: minimal — only inline Google Consent Mode v2 defaults + `static/js/consent.js` (GTM loader on consent). No framework.
- Dev port: **5099**
- API proxy: `BASE_URL` env var → `http://localhost:8042` (public backend)

## Commands

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py            # http://localhost:5099
```

Live backend mode:

```bash
BASE_URL=http://localhost:8042 python run.py
```

## Test

```bash
source .venv/bin/activate
pytest                                          # 35 tests
pytest --cov=app --cov-report=term-missing      # with coverage
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `mock` | `mock` or an http(s) backend base URL (e.g. `http://localhost:8042`) |
| `GTM_ID` | _(empty)_ | Google Tag Manager container ID — empty disables GTM |
| `SECRET_KEY` | dev value | Flask session signing key — override in production |
| `HUMAN_TTL` | `1800` | Anti-bot arithmetic pass validity (seconds) |
| `DEFAULT_LANG` | `en` | Default UI language when no cookie is set |
| `PORT` | `5099` | Dev server port |

## Project Structure

```
python-flask-game/
├── run.py                   # Entry point — creates app and starts dev server
├── requirements.txt
├── pytest.ini
├── app/
│   ├── __init__.py          # Application factory (create_app), blueprint wiring, context_processor
│   ├── config.py            # Config class — reads env vars (BASE_URL, GTM_ID, SECRET_KEY, ...)
│   ├── i18n.py              # make_translator(lang) helper, dot-path lookup + {var} interpolation
│   ├── adapter.py           # Port of react-game tutorialStoryAdapter.js — fetchWithFallback pattern
│   ├── data.py              # Port of react-game stories.js — getStories(), getStory(uuid)
│   ├── captcha.py           # Server-side anti-bot: arithmetic challenge + honeypot, TTL in session
│   ├── matches.py           # Match mock management — session-backed match store
│   ├── selection.py         # Loadout selection (class/character/trait/difficulty) — session-backed
│   └── blueprints/
│       ├── catalog.py       # / catalog (Netflix grid), /story/<uuid> detail (book layout)
│       ├── config_bp.py     # /story/<uuid>/select/<kind> — element change (class/character/trait/difficulty)
│       ├── match_bp.py      # /story/<uuid>/start (anti-bot gate), /match/<uuid> (half-mock gameplay)
│       ├── user_bp.py       # /me — guest profile + match list
│       ├── legal.py         # /privacy, /terms, /cookies — legal pages from i18n
│       └── prefs.py         # /prefs/lang, /prefs/theme, /prefs/consent — set cookie + redirect, no JS
├── templates/
│   ├── base.html            # Base layout: Navbar, Footer, GTM snippet, consent init, theme toggle
│   ├── catalog.html         # Netflix-style story grid
│   ├── story_detail.html    # Book layout: big story card left, loadout cards right
│   ├── select_element.html  # Element picker (single or multi-select trait toggle)
│   ├── start_match.html     # Anti-bot gate page (arithmetic challenge + honeypot)
│   ├── match.html           # Half-mock match gameplay (location, stats, actions)
│   ├── user.html            # Guest profile left, match list right
│   ├── partials/            # Reusable Jinja2 includes (card, navbar, footer, ...)
│   └── legal/               # privacy.html, terms.html, cookies.html
├── static/
│   ├── css/
│   │   ├── variables.css    # CSS tokens — copied verbatim from react-game styles
│   │   ├── game.css         # Custom rules from react-game build (Tailwind directives stripped)
│   │   ├── flaskgame.css    # Flask-specific layout additions
│   │   └── accessibility.css # High-contrast / large-text low-vision theme
│   ├── js/
│   │   └── consent.js       # GTM loader fired on analytics consent (only JS file)
│   ├── data/
│   │   ├── tutorial_story.json  # Mock story bundle (copied from react-game mock/)
│   │   └── gameData.json        # Mock gameplay data (locations, actions — copied from react-game mock/)
│   └── i18n/
│       ├── en.json          # English translations — same file as react-game src/i18n/en.json
│       └── it.json          # Italian translations — same file as react-game src/i18n/it.json
└── tests/
    ├── conftest.py          # Flask test client fixture
    ├── test_adapter.py      # fetchWithFallback, story parsing
    ├── test_data.py         # getStories(), getStory() with mock data
    ├── test_i18n.py         # dot-path lookup, {var} interpolation, missing key fallback
    ├── test_captcha.py      # Arithmetic challenge generation, honeypot, TTL
    ├── test_matches.py      # Session-backed match CRUD
    └── test_routes.py       # HTTP route smoke tests (catalog, detail, start, match, user, legal, prefs)
```

## Pages & Features

1. **Catalog** (`/`) — Netflix-style story grid grouped by category.
2. **Story detail** (`/story/<uuid>`) — book layout: big story card on the left, small selectable loadout cards (class, character, traits, difficulty) on the right.
3. **Change element** (`/story/<uuid>/select/<kind>`) — pick a class / character / difficulty (single-select) or toggle traits (multi-select). Stored in Flask session.
4. **Start match** (`/story/<uuid>/start`) — JS-free anti-bot gate: arithmetic challenge + honeypot field before creating the match.
5. **Match** (`/match/<uuid>`) — half-mock gameplay view: location card, player stats, available actions from `gameData.json`.
6. **User** (`/me`) — guest profile on the left, played matches on the right; link always present in navbar.
7. **Legal** (`/privacy`, `/terms`, `/cookies`) — dedicated pages rendered from i18n texts.
8. **Cookie management + Google Tag (GTM)** — Consent Mode v2. Inline defaults in `base.html`; GTM container loaded by `static/js/consent.js` only after analytics consent.
9. **Low-vision theme** (`?theme=access`) — high-contrast / large-text toggle in the navbar; styles in `static/css/accessibility.css`.
10. **i18n** — English / Italian, switchable from the navbar via `POST /prefs/lang` (sets `pg_lang` cookie, no JS required).

## Data Source

Mock by default — `static/data/tutorial_story.json` + `gameData.json`.
Set `BASE_URL` to point at the live Java public backend (port 8042):

```bash
BASE_URL=http://localhost:8042 python run.py
```

`app/adapter.py` mirrors the `fetchWithFallback` pattern from `src/api/client.js`:
it calls the backend and silently falls back to mock data on any error.

## i18n

Translations are the **same** `en.json` / `it.json` files used by the React frontend (copied to `static/i18n/`). The `make_translator(lang)` helper in `app/i18n.py` resolves dot-path keys (e.g. `catalog.title`) with `{var}` interpolation. Missing keys return the key itself as fallback.

## Anti-bot (CAPTCHA)

Server-side only — no JavaScript, no third-party service. On `GET /story/<uuid>/start` a random arithmetic question is generated and stored in the session (with a TTL). The form posts back to the same URL; `app/captcha.py` validates the answer and honeypot field. A successful pass is recorded in the session for `HUMAN_TTL` seconds.

## Notes

- Everything is server-rendered. The only JavaScript shipped is `static/js/consent.js` (GTM loader) and the inline Consent Mode v2 defaults in `base.html`.
- `static/css/game.css` contains the custom rules from the React build with Tailwind directives stripped; `flaskgame.css` adds Flask-specific layout; `accessibility.css` holds the low-vision theme.
- Guest identity is synthesised server-side in `app/__init__.py` (`_ensure_guest` before_request hook): a `guest_id` UUID and `guest_name` are stored in the Flask session on first visit, mirroring the React `GuestUserProvider`.

---

- **Document Version**: 0.1.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.1.0 | Flask game frontend initial implementation | June 11, 2026 |
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
