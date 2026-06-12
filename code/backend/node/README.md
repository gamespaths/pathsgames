# Paths Games — Node.js TypeScript Backend

Hexagonal architecture REST API for Paths Games storytelling platform. Fastify + PostgreSQL + Prisma.

## Features

- ✓ Dual ports (8042 public, 8044 admin)
- ✓ JWT authentication with token rotation
- ✓ Guest session management
- ✓ Story catalog queries (categories, groups)
- ✓ Match lifecycle (create, list, update, admin control)
- ✓ Content detail queries (cards, texts, creators with lang fallback)
- ✓ Story import with full graph persistence + validation engine
- ✓ Character selection and stats initialization
- ✓ Trait filtering and cost-budget enforcement
- ✓ OpenAPI-compliant endpoints (suites 16, 20–23)
- ✓ Robot Framework test compatibility (`/api/dev/cleanup`)
- ✓ TypeScript strict mode (0 tsc errors)
- ✓ PostgreSQL with Prisma ORM
- ✓ 20/20 Jest unit tests passing

## Quick Start

### Local Development (Docker)

```bash
# Copy env template
cp .env.example .env

# Build and start containers (postgres + app + nginx)
# Always build first after any schema or seed change to avoid stale image issues
docker-compose build --no-cache app
docker-compose up

# App should be running on http://localhost:8042 (public) and :8044 (admin)
```

### Without Docker

```bash
# Install dependencies
npm install

# Start postgres
docker network create pathsgames-net
docker run -d \
  --name postgres_pathsgames \
  --network pathsgames-net \
  --network-alias postgres \
  -e POSTGRES_DB=pathsgames_dev \
  -e POSTGRES_USER=pathsgames \
  -e POSTGRES_PASSWORD=pathsgames \
  -p 5432:5432 \
  postgres:16-alpine
#note "--network-alias postgres" but in hosts file add "127.0.0.1   postgres"

# Run db adminer
# docker run -d --name postgres_pathsgames_adminer --restart unless-stopped --network pathsgames-net -p 8046:8080 adminer

# Setup database
npx prisma db push

# Start dev server
npm run dev
# or "npx prisma db push --accept-data-loss" to update old database schema!

# Check server ports
curl http://localhost:8044/api/echo/status
curl http://localhost:8042/api/echo/status

# Run robot robot 
cd "../../code/tests/robot" && pip install -r requirements.txt
ROBOT_EXIT=0
ROBOT_VAR_ADMIN_TOKEN="${ROBOT_VAR_ADMIN_TOKEN:-}" robot --variablefile variables/dev.yaml --outputdir reports-local-node/ tests/ || ROBOT_EXIT=$?
echo "Esito test robot: $ROBOT_EXIT "
```

### Build & Run

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── core/                        # Pure domain logic
│   ├── services/                # Business logic (11 services)
│   ├── models/                  # Domain interfaces
│   └── ports/                   # Port interfaces (repository + JWT)
├── adapters/
│   ├── rest/
│   │   ├── controllers/         # HTTP handlers (11 controllers)
│   │   └── middleware/          # JWT auth middleware
│   ├── persistence/prisma/      # Prisma repositories (7 implementations)
│   └── auth/                    # JWT token adapter
├── __tests__/                   # Unit test suites (Jest)
└── main.ts                      # Entry point + DI wiring
```

## API Endpoints

### Public (Port 8042)

**Health Check**
- `GET /api/echo/status` → `{ status, timestamp, properties }`

**Guest Auth**
- `POST /api/auth/guest` → `{ userUuid, username, accessToken, ... }` (X-Test-Marker: robottest)
- `POST /api/auth/guest/resume` → Resume session via cookie

**Sessions**
- `POST /api/auth/refresh` → Refresh tokens
- `POST /api/auth/logout` → Logout & clear cookies
- `GET /api/auth/me` → Current user info
- `POST /api/auth/logout/all` → Logout from all sessions

**Stories** (No auth required)
- `GET /api/stories?lang=en` → List public stories
- `GET /api/stories/categories` → List categories
- `GET /api/stories/category/{category}?lang=en` → Filter by category
- `GET /api/stories/groups` → List groups
- `GET /api/stories/group/{group}?lang=en` → Filter by group
- `GET /api/stories/{uuid}?lang=en` → Story detail
- `GET /api/stories/{uuid}/classes/{classUuid}/traits?lang=en` → Traits selectable for a class

**Content Detail** (No auth required)
- `GET /api/content/{story}/cards/{card}?lang=en` → Card info with text resolution and creator embed
- `GET /api/content/{story}/texts/{idText}/lang/{lang}` → Text with lang fallback to en
- `GET /api/content/{story}/creators/{creator}?lang=en` → Creator detail

**Matches** (Requires auth token)
- `POST /api/matches` → Create match
- `GET /api/matches` → List user's matches
- `GET /api/match/{uuid}/info` → Match detail
- `POST /api/matches/{uuid}/join` → Join match with character loadout (201/400/401/404/409)
- `GET /api/match/{uuid}/players` → List character instances
- `GET /api/match/{uuid}/characters/{charUuid}` → Character instance detail

**Dev** (Only when DEV_ENDPOINTS_ENABLED=true)
- `POST /api/dev/cleanup` → Delete guests + matches matching `robottest%`

### Admin (Port 8044)

All require `role: 'admin'` JWT token.

**Guest Admin**
- `GET /api/admin/guests` → List all guests
- `GET /api/admin/guests/stats` → Guest statistics
- `DELETE /api/admin/guests/{uuid}` → Delete guest

**Story Admin**
- `GET /api/admin/stories` → List all stories (all visibility)
- `POST /api/admin/stories/import` → Import story from Java JSON format (full graph persistence; returns 400 INVALID_STORY with errors[] on validation failure)
- `GET /api/admin/stories/{uuid}/validate` → Validate story referential integrity
- `DELETE /api/admin/stories/{uuid}` → Delete story by uuid
- `PUT /api/admin/stories/{uuid}` → Update story metadata
- `GET/POST/PUT/DELETE /api/admin/stories/{uuid}/{entityType}/{entityUuid}` → Generic entity CRUD

**Match Admin**
- `GET /api/admin/matches` → List all matches
- `GET /api/admin/matches/statuses` → List valid statuses
- `PUT /api/admin/matches/{uuid}` → Update match (status, name)
- `POST /api/admin/matches/{uuid}/stop|pause|resume` → Control match lifecycle
- `DELETE /api/admin/matches/{uuid}` → Delete match (terminal statuses only; 409 MATCH_NOT_STOPPED otherwise)

**Guest Admin**
- `GET /api/admin/guests/{uuid}` → Get guest details
- `DELETE /api/admin/guests/expired` → Delete expired guests

## Configuration

Environment variables (see `.env.example`):

```
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=pathsgames_dev
DB_USER=pathsgames
DB_PASSWORD=pathsgames

# Ports
PUBLIC_PORT=8042
ADMIN_PORT=8044

# JWT
JWT_SECRET=your-secret-key (≥32 chars)
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=7

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5172

# Dev
DEV_ENDPOINTS_ENABLED=true
```

## Testing

```bash
# Unit tests with coverage
npm run test
npm run test:cov

# Watch mode
npm run test:watch

# Robot E2E tests — full setup (docker-compose build + tests + cleanup):
./code/scripts/dev/run_robots/run_robot_with_local_node.sh
```

### Important: Docker image must be rebuilt before Robot tests

The run script always executes `docker-compose build --no-cache app` before
`docker-compose up -d`. This is required because:

- `prisma generate` and `npm run build` must run inside the container against
  the current `prisma/schema.prisma`.  A stale image (built before a schema
  change) will not contain the new Prisma client models, causing
  `prisma/seed.js` to throw an exception.  The seed failure is silent
  (`|| echo 'seed skipped'`) so the story seed data is absent and Robot tests
  fail with cascading 404s, not an obvious seed error.
- `prisma` is listed in `dependencies` (not `devDependencies`) so
  `npx prisma db push` works correctly even in the production image built with
  `npm ci --omit=dev`.

Never run Robot tests against the Node backend by calling `docker-compose up`
directly without `--build` after any schema or seed change.

## Database

Uses Prisma with PostgreSQL. Schema defined in `prisma/schema.prisma` (32 models).

### Schema: documented `list_*` relational model

The Prisma schema implements the same relational model documented in
`documentation_v0/Step10_CreateDBschema.md` and used by the Java, Python, and PHP backends.

Key mapping conventions:

| Convention | This backend (Prisma) | Java/Python/PHP (SQL) |
|---|---|---|
| Table names | `@@map("list_stories")`, `@@map("gaming_match")`, ... | `list_stories`, `gaming_match`, ... |
| Column names | `@map("id_story")`, `@map("ts_insert")`, ... | `id_story`, `ts_insert`, ... |
| Composite PKs | `@@id([id, idStory])` | `PRIMARY KEY (id, id_story)` |
| `list_stories.id` only | `@default(autoincrement())` | `BIGSERIAL PRIMARY KEY` |
| Other composite PK parts | `id Int, idStory Int` (no autoincrement) | `BIGINT, BIGINT` |

**32 Prisma models** cover:
- Story domain (24): `Story`, `StoryDifficulty`, `StoryClass`, `StoryClassBonus`, `Trait`,
  `CharacterTemplate`, `Location`, `LocationNeighbor`, `Item`, `ItemEffect`, `WeatherRule`,
  `Event`, `EventEffect`, `Choice`, `ChoiceCondition`, `ChoiceEffect`, `GlobalRandomEvent`,
  `Mission`, `MissionStep`, `Creator`, `Card`, `StoryText` (+ key/text entry helpers)
- Auth (2): `User` (`@@map("users")`, state=6 for guests) + `UserToken` (`@@map("users_tokens")`)
- Gaming (6): `Match` (`@@map("gaming_match")`), `CharacterInstance`
  (`@@map("gaming_character_instance")`), and supporting tables

**ID assignment**: composite PKs cannot use `SERIAL` in PostgreSQL via Prisma. Integer `id`
values for imported entities are assigned by the import service using `MAX(id) + 1` scoped
per story — same strategy as Java/Python.

**`id_text_*` references**: columns like `idTextName`, `idTextDescription` are integer FKs
pointing to `list_texts(id_story, id_text, lang)`. They are not formal FK constraints; the
application resolves them at query time with a lang fallback to `en`.

### Schema management (dev workflow)

```bash
# Push current schema to DB — drops missing columns, dev only
npx prisma db push --accept-data-loss

# Seed tutorial story and system data
node prisma/seed.js

# Regenerate Prisma client after schema change
npx prisma generate
```

The `--accept-data-loss` flag allows schema changes that drop columns without a formal
migration file. It must **not** be used in production against a database with real data.

The Docker container startup script (`docker-compose.yml` entrypoint) executes both commands
automatically before starting the app, so `docker-compose build --no-cache app` is required
after any `prisma/schema.prisma` or `prisma/seed.js` change.

## Architecture

**Hexagonal (Ports & Adapters):**
- **Core:** Pure domain services, models, port interfaces (no framework)
- **Adapters:** REST controllers, Prisma repositories, JWT auth
- **Middleware:** JWT extraction, CORS
- **DI:** Manual wiring in main.ts (no DI container)

**Tech Stack:**
- Fastify 4.25 (REST framework)
- Prisma 5.7 (ORM)
- PostgreSQL 16 (database)
- TypeScript 5.3 (language)
- Jest 29 (testing)

## OpenAPI

All endpoints match Java backend OpenAPI specs:
- `/code/backend/java/adapter-rest/src/main/resources/openapi/`

Verification: Route paths, DTOs, status codes, auth requirements are 1:1 compatible.


## Known Limitations

- No match gameplay progression — match state machine stops at character join (no card/choice loop)
- No admin role creation — must create admin guests directly in the database
- No websocket support — REST only
- No file upload endpoints for story assets





# < Paths Games />

All source code and information in this repository are the result of careful and patient development work by the developer team, who have made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit the [Paths.Games](https://paths.games/) website.

## License

Made with ❤️ by the <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>

Public projects:
<a href="https://www.gnu.org/licenses/gpl-3.0" valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

Narrative Content & Assets: The story, dialogues, characters, sounds, music, art, and world-building (located in the `/data` folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).

(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.



