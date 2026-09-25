# Architecture

**Paths Games** is a web gamebook: a multi-user storytelling platform with branching
narratives. Three backends share one REST API contract, two React frontends and a website
consume it, and one Robot Framework suite validates all three backends the same way.

## 1. Repository layout

```
code/backend/java/            Java backend (reference implementation)
code/backend/python/          Python backend (mirrors Java)
code/backend/aws/             AWS serverless backend (mirrors Java)
code/frontend/react-admin/    Admin console (React)
code/frontend/react-game/     Player-facing game (React)
code/website/terraform-aws/   Static-website AWS infrastructure (Terraform)
code/tests/robot/             Robot Framework E2E suites, run against any backend
code/scripts/                 Dev/test/prod helper scripts (build, deploy, run, cleanup)
wiki/                Shared, version-independent reference docs (this folder)
documentation_vN/             Frozen, per-version step-by-step design history
.github/workflows/            CI: build/test, SonarQube analysis, website deploy
```

**Rule:** the three backends implement the same OpenAPI contract. A change to one backend's
API surface or DB schema is normally made in the other two as well — see
[ApiConventions](./ApiConventions.md) and CLAUDE.md.

## 2. Java backend (reference implementation)

Hexagonal architecture (Ports and Adapters), Java 21 + Spring Boot, built with Maven.
See [Step05](documentation_v0/Step05_BackendStructure.md).

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

- Persistence uses **Spring Data JPA** only (no raw JDBC); dialect switches per profile
  (`SQLiteDialect` dev, `PostgreSQLDialect` prod); Flyway always owns schema creation
  (`ddl-auto=none`).
- **Dev profile** (default): public port `8042`, SQLite at `~/.paths.games/database.sqlite`.
- **Prod profile**: public port `8080`, PostgreSQL via `DB_HOST`/`DB_PORT`/`DB_NAME`/
  `DB_USERNAME`/`DB_PASSWORD`.
- **Admin port 8044** (both profiles, `game.admin.port` / env `ADMIN_PORT`): serves
  `/api/admin/**` and nothing else; the public connector 404s on admin paths. Meant to be
  locked to the owner IP at the network layer — see [Security](./Security.md).
- MongoDB (`adapter-mongo`) backs complex document registries when needed; Kafka
  (`adapter-kafka`) carries async messaging — both are optional infrastructure, not required
  to run a dev instance.
- Flyway migrations: `adapter-{postgres,sqlite}/src/main/resources/db/migration/`, one file
  per schema change, numbered against the project's step/version (e.g. Step 10 → `V0.10.x`).

## 3. Python backend (mirror)

FastAPI, same hexagonal split as Java: `app/core/` (domain, framework-free), `app/adapters/`
(REST, auth, persistence). Entry point `app/launcher.py`. Same two ports as Java: public
`8042`, admin `8044`; SQLite in dev, PostgreSQL in prod. Kept API- and schema-compatible with
Java release by release; where a naming drift exists between the two (e.g. `is_safe` vs
`secure_param`) it is called out in the relevant `documentation_vN` step file.

## 4. AWS serverless backend (mirror)

API Gateway (HTTP v2) → Lambda (Python 3.13) → DynamoDB single-table design with GSIs,
deployed with AWS SAM. Does not use the relational `list_*`/`gaming_*` schema — DynamoDB uses
a key-prefix design instead (`GSI1`, `GSI2` for secondary access patterns).

```
code/backend/aws/lambda/
  auth/          guest login, session/token endpoints
  authorizer/    IP allow-list Lambda authorizer, gates /api/admin/** at the API Gateway level
  content/       story content read APIs (cards, texts, creators)
  echo/          unversioned health check
  match/         match lifecycle, gameplay actions, admin match control
  seed/          dev/test data seeding and cleanup
  story/         story catalog and admin story CRUD
  common/        shared helpers (db_utils, jwt_utils, security_utils, http_utils, log_utils)
```

SAM templates: `code/backend/aws/template.yaml` (root stack) plus one nested template per
module under `code/backend/aws/template/` (`auth.yaml`, `match.yaml`, `story.yaml`,
`content.yaml`, `echo.yaml`, `seed.yaml`). Environments are `dev` and `test` (deployed with
`code/scripts/test/aws/aws_backend_deploy.sh [dev|test]`) and `prod` (`sam deploy
--config-env prod`) — details in [Environments](./Environments.md).

## 5. Frontends

Both frontends are React 18 + Vite 5, Tailwind + Bootstrap 5, Axios, React Router 6.

- **react-admin** (`code/frontend/react-admin/`): admin console for stories/cards/matches
  management. Dev proxy sends `/api/admin/**` to `http://localhost:8044` (the admin port
  only — it never talks to the public port). A JWT admin token is pasted at login.
- **react-game** (`code/frontend/react-game/`): the player-facing game. Dev proxy sends
  `/api/**` to `http://localhost:8042` (the public port). Falls back to mocked data when no
  backend is reachable in some dev flows.

## 6. Robot Framework E2E suites

`code/tests/robot/` — backend-agnostic suites (`variables/*.yaml` selects the target: local
Java, local Java+Postgres, local Python, or the AWS stack). Suites are numbered by the step
that introduced them (`12_auth/`, `19_match/`, `28_movement/`, `41_security/`, …) up to the
current `39_random_events/`. Run everything with
`code/scripts/dev/run_robot_everywhere.sh`, or one backend at a time with the matching
`code/scripts/dev/run_robots/run_robot_with_*.sh` script. Reports land in
`code/scripts/dev/run_robot_results/` (batch run) or `code/tests/robot/reports/` (manual run).

## 7. CI/CD

GitHub Actions, `.github/workflows/`:

| Workflow | Purpose |
|---|---|
| `backend-ci.yml` | Builds and tests the Java backend with Maven, pushes its Docker image |
| `sonarqube-java.yml` | SonarQube analysis, Java backend |
| `sonarqube-python.yml` | SonarQube analysis, Python backend |
| `sonarqube-aws-lambda.yml` | SonarQube analysis, AWS Lambda backend |
| `sonarqube-react-admin.yml` | SonarQube analysis, react-admin |
| `sonarqube-react-game.yaml` | SonarQube analysis, react-game |
| `website-deploy.yml` | Deploys the static website to production |

The Java application image is published to
[Docker Hub](https://hub.docker.com/r/pathsgames/pathsgames).

## 8. Website infrastructure

`code/website/terraform-aws/` provisions S3 + CloudFront + ACM + WAF + CSP for the static
website, one Terraform state per environment (`production`, `test`). Full detail in
[Environments](./Environments.md).

## 9. Keeping the backends aligned

Java is the reference implementation; Python and AWS track it release by release. Changing
one backend's endpoints, DTOs or database columns is normally a three-way change (Java,
Python, AWS) plus the shared OpenAPI spec and the Robot suite that exercises all three — see
[ApiConventions §5](./ApiConventions.md) and CLAUDE.md's "When you change code" section.

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared write-up of how the whole system fits together | September 25, 2026 |

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
