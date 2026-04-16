# Paths Games — v0.15.0-prototype — API-Powered Story Catalog

> **Concept version**: `v0.15.0-prototype`  
> **Date**: April 16, 2026  
> **Goal**: Replace the static story catalog with live data from the backend REST API (Steps 14 & 15), while keeping locations, actions, and choices in a static JSON file.

---

## What Changed

| Component | Before (v0.12.x) | After (v0.15.0-prototype) |
|-----------|-------------------|---------------------------|
| **Story Catalog** | Static `STORIES[]` array in `stories.js` | Fetched from `GET /api/stories` |
| **Story Detail** | Not available (only basic preview) | Fetched from `GET /api/stories/{uuid}` (enriched) |
| **Categories** | Hardcoded in the stories array | Available from `GET /api/stories/categories` |
| **Locations** | Static `STORIES_LOCATIONS` in `stories.js` | **Still static** — API does not yet provide location data |
| **Actions/Choices** | Static in `STORIES_LOCATIONS` | **Still static** — same reason |
| **Fallback** | N/A | Full static fallback when API is unreachable |


## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (this prototype)              │
│                                                          │
│  ┌─────────────┐    ┌────────────────────────────────┐   │
│  │  stories.js  │    │         main.js                │   │
│  │ (static)     │    │ (API integration + rendering)  │   │
│  │              │    │                                │   │
│  │ LOCAL_CONFIG │◄───│ getLocalConfig(story)          │   │
│  │ LOCATIONS    │◄───│ renderLocation(id)             │   │
│  │ FALLBACK     │◄───│ loadStories() [if API fails]  │   │
│  └─────────────┘    └─────────┬──────────────────────┘   │
│                               │                          │
└───────────────────────────────┼──────────────────────────┘
                                │ fetch()
                                ▼
┌──────────────────────────────────────────────────────────┐
│              Backend API (Java / Python / PHP / AWS)      │
│                                                          │
│  GET /api/stories               → Story list (catalog)   │
│  GET /api/stories/{uuid}        → Story detail (enriched)│
│  GET /api/stories/categories    → Distinct categories    │
│  GET /api/stories/category/{c}  → Stories by category    │
│  GET /api/stories/groups        → Distinct groups        │
│  GET /api/stories/group/{g}     → Stories by group       │
└──────────────────────────────────────────────────────────┘
```


## Files

| File | Description |
|------|-------------|
| `index.html` | Main page — same visual structure as production site, with API config bar |
| `main.js` | Application logic — fetches stories from API, renders catalog, handles game navigation |
| `stories.js` | Static data — `STORIES_LOCATIONS` (locations/actions/choices), `LOCAL_STORY_CONFIG` (emote/startLocation mapping), `FALLBACK_STORIES` |
| `style.css` | Prototype-specific styles (API config bar, source tags, detail badges) |
| `README.md` | This file |

Base styles are imported from the production site:
- `../../html/variables.css` — CSS custom properties (colors, fonts, card sizes)
- `../../html/style.css` — All component styles (navbar, cards, modals, footer)


## API Endpoints Used

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/stories` | GET | Load story catalog | Public |
| `/api/stories/{uuid}` | GET | Load enriched story detail on preview | Public |
| `/api/stories/categories` | GET | Available for future category filtering | Public |

### API Response → Internal Mapping

```
API StorySummary                    Internal Story Object
─────────────────                   ─────────────────────
uuid                          →     id, uuid
title                         →     title
description                   →     desc
category                      →     category (capitalized)
group                         →     group
author                        →     author
priority                      →     priority
peghi                         →     peghi
difficultyCount               →     difficultyCount
─ (not in API) ─              →     emote        ← LOCAL_STORY_CONFIG
─ (not in API) ─              →     startLocation ← LOCAL_STORY_CONFIG
─ (not in API) ─              →     cover        ← story detail card.imageUrl
```


## How It Works

### 1. Story Catalog Loading

```
loadStories()
  │
  ├── Try: GET /api/stories
  │     │
  │     ├── Success → map to internal format using apiStoryToInternal()
  │     │              + match LOCAL_STORY_CONFIG by title for emote/startLocation
  │     │
  │     └── Fail → use FALLBACK_STORIES (same data as original stories.js)
  │
  └── renderCatalog() — group by category, render Netflix-style rows
```

### 2. Story Preview (Modal)

```
showStoryPreview(storyId)
  │
  ├── Show modal with basic data (already loaded)
  │
  ├── If API available + story has UUID:
  │     GET /api/stories/{uuid}
  │     │
  │     ├── Update cover image from card.imageUrl
  │     ├── Cache detail in storyDetails{}
  │     └── Show API detail badges (author, locations, events, etc.)
  │
  └── Render options flow (difficulty → character → type → login → terms → start)
```

### 3. Gameplay (Locations)

```
startStory(storyId)
  │
  ├── Resolve localId via LOCAL_STORY_CONFIG (match by title)
  ├── Look up STORIES_LOCATIONS[localId]
  │     │
  │     ├── Found → render game view with locations, neighbors, actions
  │     └── Not found → show "No location data available" popup
  │
  └── Navigation uses static STORIES_LOCATIONS (unchanged from v0.12.x)
```


## How to Run

### With API (full experience)

1. Start the backend:
   ```bash
   cd code/backend/java
   mvn spring-boot:run -pl ms-launcher
   # Default: http://localhost:8042
   ```

2. Open `index.html` in a browser

3. The API config bar shows connection status:
   - **Green** `✓ N stories loaded from API` — connected
   - **Red** `✗ Using static fallback` — API unreachable, using static data

4. To change the API base URL, click **API Config** and update the URL

### Without API (static fallback)

Open `index.html` directly — the site works with `FALLBACK_STORIES` and `STORIES_LOCATIONS` from `stories.js`, identical to the original v0.12.x behavior.


## What's Still Static (Future API Integration)

These elements are **not** yet provided by the REST API and remain in `stories.js`:

| Element | Static Source | Future API Endpoint |
|---------|---------------|---------------------|
| Locations | `STORIES_LOCATIONS[storyId]` | `GET /api/stories/{uuid}/locations` |
| Location neighbors | `loc.neighbors[]` | `GET /api/stories/{uuid}/locations/{id}/neighbors` |
| Actions | `loc.actions[]` | `GET /api/stories/{uuid}/locations/{id}/actions` or events API |
| Choices | *(not yet in prototype)* | `GET /api/stories/{uuid}/events/{id}/choices` |
| Emotes / Icons | `LOCAL_STORY_CONFIG._by_title` | Story card: `card.awesomeIcon` in story detail |
| Start location | `LOCAL_STORY_CONFIG._by_title` | Story metadata: starting location field |

When these API endpoints are implemented, `stories.js` can be reduced to an empty fallback or removed entirely.


## Configuration

### Matching API Stories to Local Location Data

The prototype matches API stories to local config by **title** (case-insensitive). To add new playable stories:

1. Import the story via `POST /api/admin/stories/import`
2. Add the story's title to `LOCAL_STORY_CONFIG._by_title` in `stories.js`:
   ```js
   'my new story title': {
     localId: 'my_story',
     emote: '⚔️',
     startLocation: 'starting_location_id'
   }
   ```
3. Add the location data to `STORIES_LOCATIONS`:
   ```js
   my_story: {
     starting_location_id: { id: '...', title: '...', ... }
   }
   ```


## Version Control

| Version | Description | Date |
|---------|-------------|------|
| 0.15.0-prototype | API-powered story catalog with static location fallback | April 16, 2026 |


---

# < Paths Games />
Made with ❤️ by the [Paths Games dev team](https://github.com/gamespaths/pathsgames)

The software is distributed under the terms of the GNU General Public License v3.0.
