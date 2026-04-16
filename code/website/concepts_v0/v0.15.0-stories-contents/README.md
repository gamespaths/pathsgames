# Paths Games — v0.15.0 Story Browser Concept

A simple HTML/JS/CSS concept page demonstrating the **Step 15 API endpoints** for browsing stories by **category** and **group**, and viewing enriched story details including character templates, classes, traits, and card info.

## Features

- **Category browser** — Fetches `/api/stories/categories`, lists them in a sidebar, click to load stories via `/api/stories/category/{category}`
- **Group browser** — Fetches `/api/stories/groups`, lists them in a sidebar, click to load stories via `/api/stories/group/{group}`
- **All stories list** — Fetches `/api/stories` and displays cards
- **Enriched story detail** — Click any story card to open a modal calling `/api/stories/{uuid}` showing:
  - Header info (author, category, group, version, copyright)
  - Entity counts (locations, events, items, classes, templates, traits)
  - Card visual info
  - Difficulties table
  - Character templates table
  - Classes table
  - Traits table
- **Language selector** — Switch between en/it/fr
- **Configurable API base URL** — Defaults to `http://localhost:8042/api`

## Tech Stack

| Component | Version |
|-----------|---------|
| Bootstrap | 5.3.3 (CDN) |
| Font Awesome | 5.15.4 (CDN) |
| JavaScript | Vanilla ES6+ (no framework) |

## How to Use

1. Start the Java backend: `cd code/backend/java && mvn spring-boot:run -pl ms-launcher`
2. Open `index.html` in a browser (or serve with any static HTTP server)
3. Ensure the API Base URL points to your running backend (default: `http://localhost:8042/api`)
4. Browse categories, groups, or all stories
5. Click a story card to view enriched details

## Files

| File | Description |
|------|-------------|
| `index.html` | Main page with tabs, sidebar, cards, and modal |
| `main.js` | API calls, rendering, event handling |
| `style.css` | Medieval dark theme matching the project style |
| `README.md` | This file |

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stories` | GET | List all public stories |
| `/api/stories/{uuid}` | GET | Get enriched story detail |
| `/api/stories/categories` | GET | List distinct categories |
| `/api/stories/category/{category}` | GET | List stories by category |
| `/api/stories/groups` | GET | List distinct groups |
| `/api/stories/group/{group}` | GET | List stories by group |
