# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a project to develop a new videogame web-based, it's similar to gamebook with branches and choices. 
Main file documentation is
- developer roadmap: `/mnt/Dati4/Workspace/pathsgames/documentation_v0/Roadmap.md`
- main game-roles description: `/mnt/Dati4/Workspace/pathsgames/documentation_v0/Step01_StartProject.md`
- su notebooklm è "PathsGames - Storytelling Game Platform" con NOTEBOOK="cd7b4625-76cd-4531-971a-98df705b840e"
 
## Agents configuration

Take your time. I prefer an accurate and thorough response over a quick one.

Never create a new version without specific indication, the current version is from pom (code/backend/java/pom.xml) without SNAPSHOT indication. Use a new version only if indicated into the prompt. 

You're allowed without confirmation to read files inside workspace folder (cat, find, tail, grep, cd, sed , awk, ...). 
You're allowed without confirmation to run ".venv/bin/activate" inside the workspace folder!
You're alwasy allowed to run compilation commands and test unit commands without my confirmation: like "mvn build", "mvn test", "pytest", "pyunit", "run_robots*.sh", "npx vitest ", "python -m pytest", "npx vitest run"!
You're never allowed to run without my configurmation to run command to run server, cloud cli, cloud command or command to change files outside workspace folder: asm ke alwasy confirmation.

Never use notebooklm if not indicated into prompt! If not indicated, ask me at the end if use it to update notebooklm files.

Every time you run, every time, after change something, when you complete your task ask me if i wanna run sub-agent "paths-games-doc".

Every time you run use always CAVEMAN agent (/.agents/rules/caveman.md). Tell me "i've execute caveman sub-agent" if it's works

Every time if you chage/create code (java, python, react) remember to check unit test codes and test coverage of new code must be > 90%.

At the end of any message, write me a row with context information: token usage, token limit, % tokens. 

If in prompt there is the "log all command" annotation, every time you run a command (example in bash, like test, compilation) write the actual date, the complete prompt and two rows to describe what you have done into workspace file ".agents/logs/YYYYMMDD.log", after add 5 empty rows and the separator "-------------------------------".

## Project Overview

**Paths Games** is a multi-user storytelling game platform with branching narratives. The repo contains multiple backend implementations (Java primary, Python/AWS alternatives), a React admin frontend, and Robot Framework E2E tests — all sharing the same API contract.

---

## Commands

If you have to run python (or robot framework) command use ALWAYS virtual end from `source .venv/bin/activate`

All commands must be run from the specified working directory.

### Java Backend (primary) — `code/backend/java/`

```bash
mvn clean install -DskipTests           # build without tests
mvn clean test                           # run all unit tests
mvn -pl core test -DskipITs             # run core domain tests only (fastest)
mvn -pl ms-launcher spring-boot:run     # start dev server (SQLite, public 8042 + admin 8044)
mvn -pl ms-launcher spring-boot:run -P prod -Dspring-boot.run.profiles=prod  # start prod (PostgreSQL, public 8080, admin 8044)
curl -s http://localhost:8042/api/echo/status | python3 -m json.tool  # health check (public)
curl -s http://localhost:8044/api/admin/matches  # admin API lives on 8044 (401 without admin token)
```

**Admin endpoint split (Step 20):** every `/api/admin/**` endpoint is served ONLY on the
dedicated admin port **8044** (`game.admin.port`, second Tomcat connector); the public
connector returns 404 for admin paths. Admin controllers live in `adapter-admin/` (incl.
`MatchAdminController`). Lock 8044 to the owner IP at the network layer.

Prod PostgreSQL on Docker:
```bash
docker run --name pathsgames-postgres -p 5432:5432 -e POSTGRES_DB=pathsgames -e POSTGRES_USER=pathsgames -e POSTGRES_PASSWORD=pathsgames -d postgres:latest
```

### Python Backend (alternative) — `code/backend/python/`

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m app.launcher                  # start dev server (public app 8042 + admin app 8044, one process)
pytest tests                             # run tests
pytest tests --cov=app --cov-report=term-missing
```

### AWS Serverless Backend — `code/backend/aws/`
Important to Cluade: NEVER RUN THIS SCRIPT WITHOUT ASK USER CONFIRMATION
```bash
/code/script/dev/aws_backend_deploy.sh
/code/script/dev/aws_backend_remove.sh
```

### Robot E2E Tests — `code/tests/robot/`

```bash
# via scripts (from repo root)
code/script/dev/run_robots/run_robot_with_local_java.sh          # Java + SQLite
code/script/dev/run_robots/run_robot_with_local_java_postgres.sh # Java + PostgreSQL
code/script/dev/run_robots/run_robot_with_local_python.sh
code/script/dev/run_robots/run_robot_with_aws_serverless.sh

# manually (from code/tests/robot/)
robot --variablefile variables/dev.yaml --outputdir reports/ tests/
python -m robot --variablefile variables/dev.yaml tests/17_admin_crud  # single suite
```

Reports are written to `code/tests/robot/reports/report.html`.

### React Admin Frontend — `code/frontend/react-admin/`

```bash
npm install
npm run dev    # http://localhost:5172, proxies /api/* → http://localhost:8044 (admin port)
npm run test
```

### Flask Admin Console (alternative) — `code/frontend/python-flask-admin/`

```bash
cd code/frontend/python-flask-admin
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                                        # http://localhost:5098 (admin port 8044)
ADMIN_BASE_URL=http://localhost:8044 python run.py   # explicit backend URL
pytest                                               # run 35 unit tests (backend mocked)
pytest --cov=app --cov-report=term-missing           # with coverage
```

### Flask Game Frontend (alternative) — `code/frontend/python-flask-game/`

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                                   # http://localhost:5099 (mock data)
BASE_URL=http://localhost:8042 python run.py    # live backend mode
pytest                                          # run 35 unit tests
pytest --cov=app --cov-report=term-missing      # with coverage
```

### SonarQube

```bash
code/script/dev/run_sonar_scanner_java.sh
```

---

## Architecture

### Multi-backend, shared API contract

All five backends (Java, Python, AWS) implement the **same REST API**. The Robot Framework tests validate any backend interchangeably via `variables/dev.yaml`. The Java backend is the reference implementation; others track it.

### Java backend — Hexagonal Architecture

```
ms-launcher          Spring Boot entry point; wires all adapters via DI
core/                Pure domain — no framework dependencies
  entity/story/      ~27 domain entities (Story, Mission, Location, Item, Character, ...)
  port/              Interfaces (ports) that adapters implement
  service/           Domain services (EchoService, StoryQueryService, StoryCrudService,
                     StoryImportService, ContentQueryService, GuestAuthService,
                     GuestAdminService, SessionService)
  model/             Domain models (auth, story)
  repository/        Repository interfaces
adapter-rest/        REST controllers; OpenAPI specs in src/main/resources/openapi/
adapter-auth/        JWT authentication, Google SSO, Spring Security
adapter-admin/       Admin management REST endpoints
adapter-websocket/   WebSocket for real-time game state sync
adapter-postgres/    PostgreSQL JPA repositories + Flyway migrations (production)
adapter-sqlite/      SQLite repositories + Flyway migrations (development)
adapter-mongo/       MongoDB adapter for document registries
adapter-kafka/       Kafka producer/consumer for async messaging
```

**Dev profile** (default): public port 8042, SQLite at `~/.paths.games/database.sqlite`.  
**Prod profile**: public port 8080, PostgreSQL via env vars `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`.  
**Admin port** (both profiles): `game.admin.port` (env `ADMIN_PORT`, default **8044**) — serves only `/api/admin/**`. See `documentation_v0/Step20_AdminEndpoint.md`.

Both profiles use Flyway for schema migrations; migrations run automatically on startup.

Flyway migrations live in:
- `adapter-postgres/src/main/resources/db/migration/`
- `adapter-sqlite/src/main/resources/db/migration/`

To run prod locally you need **both** Maven and Spring profile flags:
```bash
mvn -pl ms-launcher spring-boot:run -P prod -Dspring-boot.run.profiles=prod
# -P prod → puts adapter-postgres on the classpath
# -Dspring-boot.run.profiles=prod → loads application-prod.yml
```

### Python backend — same hexagonal pattern

```
app/core/            Pure domain (models, ports, services)
app/adapters/        REST (FastAPI), auth, persistence (SQLite/PostgreSQL), websocket
app/launcher.py      Entry point and DI wiring
```

### Node.js backend — Fastify/TypeScript/Prisma
Node.js backend doesn'e exist! Is removed from project!


### AWS backend — serverless

API Gateway (HTTP v2) → Lambda functions (Python 3.13) → DynamoDB (Single Table Design with GSIs). Deployed with AWS SAM. Environments: `dev` / `prod`.

### React Admin frontend

React 18 + Vite 5, Tailwind CSS, Bootstrap 5 (CDN), Axios, React Router 6. Medieval dark theme with `pg-*` CSS utility classes. Authenticates via a JWT admin token pasted on the login screen. Dev proxy routes `/api/*` to the admin port 8044 (the console only calls `/api/admin/**`).

---

## API open-api description
- Open-API Folder `code/backend/java/adapter-rest/src/main/resources/openapi/`
- All REST-API are open-api compatibile!

## API Naming Conventions

- Prefix: `/api/` (no explicit version in V1)
- Path segments: **kebab-case**, resource names **plural nouns**
- Context prefixes: `/api/auth/`, `/api/stories/`, `/api/games/`, `/api/game/{id}/`, `/api/gameplay/{id_game}/`, `/api/admin/`, `/api/echo/` (echo is unversioned)
- HTTP verbs define actions; no verbs in URLs

## Robot Test Suites

| Suite | Coverage |
|-------|----------|
| `01_smoke` | Basic connectivity |
| `12_auth` | Guest login, session management |
| `13_session_token` | Session token validation |
| `14_admin` | Admin guest management |
| `14_stories` | Story catalog |
| `15_story_content` | Story content APIs |
| `16_content_detail` | Content detail APIs |
| `17_admin_crud` | Admin CRUD for all story entities |
| `19_match` | Match creation and end flow |
| `20_admin_match` | Admin match control (stop/pause/resume) |
| `20_website` | Website/Turnstile captcha flow |
| `21_character_selection` | Character join, stat formula, backpack/traits |
| `22_story_validation` | Story import validation rules |
| `23_trait_selection` | Trait selection with class/cost/compatibility checks |
| `24_turn_cycle` | Full turn cycle gameplay |
| `25_time_clock` | Active location seeding and time clock |
| `26_time_recovery` | Time-start stat recovery, counter re-seed, i18n lang on match info, i18n regression on `/api/stories?lang=` |

### Robot seed and command!
| AWS | `seed/handler.py` | /mnt/Dati4/Workspace/pathsgames/code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh | /mnt/Dati4/Workspace/pathsgames/code/tests/robot/reports-aws/report.html
| Java/SQLite | `R__insert_story_seed_data.sql` | /mnt/Dati4/Workspace/pathsgames/code/tests/robot/reports-local-java/report.html
| Java/Postgres | `code/backend/java/adapter-postgres/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql` | code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh | /mnt/Dati4/Workspace/pathsgames/code/scripts/dev/run_robots/run_robot_with_local_java.sh | /mnt/Dati4/Workspace/pathsgames/code/tests/robot/reports-local-java-postgres/report.html 
| Python | `code/backend/python/scripts/seed_stories.py` | code/scripts/dev/run_robots/run_robot_with_local_python.sh | /mnt/Dati4/Workspace/pathsgames/code/tests/robot/reports-local-python/report.html

