# Step 20 — Dedicated Admin Endpoint

## Goal

Isolate every `/api/admin/**` endpoint onto a **separate network boundary** so the admin
surface can be locked down to the owner's IP, independently of the public/player API.

- **Java / Python / PHP** — admin APIs are served on a dedicated **port 8044**; the public
  API stays on 8042 (8080 in Java prod).
- **AWS** — admin APIs are served on a **separate HTTP API** gated by an IP-allow-list
  Lambda authorizer (there is no "port" in API Gateway).

The split is **strict**: the public listener returns `404` for `/api/admin/**`, and the admin
listener serves nothing but `/api/admin/**`. Admin-role authorization (JWT) is unchanged and
still applies on top of the network boundary.

Before this step, admin endpoints were mixed into the public listener and protected only by a
path-prefix check (`/api/admin/`). Admin match endpoints were also embedded in the player
`MatchController`. Step 20 extracts all admin code into its own files and onto its own endpoint.

---

## Architecture

```
                 ┌─────────────────────────── public ───────────────────────────┐
  player/public  │  8042 (Java/Python/PHP) · 8080 (Java prod) · PathsGamesApi    │
                 │  /api/echo, /api/auth, /api/stories, /api/content, /api/matches│
                 └───────────────────────────────────────────────────────────────┘
                 ┌─────────────────────────── admin ────────────────────────────┐
  admin only     │  8044 (Java/Python/PHP) · PathsGamesAdminApi (AWS)            │
  (firewall to   │  /api/admin/**  → guests, stories CRUD, match management      │
   owner IP)     │  AWS: + IP-allow-list Lambda authorizer                       │
                 └───────────────────────────────────────────────────────────────┘
```

Two layers of defense on the admin surface:
1. **Network boundary** — separate port (firewalled) / separate API (IP authorizer).
2. **Admin role** — the existing JWT check (`admin-path-prefix` / `is_admin`) still runs.

### Health check on the admin endpoint
The admin endpoint also serves **`GET /api/echo/status`**, backed by the **same EchoService**
as the public endpoint, so the admin endpoint can be monitored independently:
- **Java** — `AdminPortFilter` allows `/api/echo/status` on the admin connector (the shared
  `EchoController` already answers on both connectors).
- **Python** — `echo_controller.router` is included on `app_admin`.
- **PHP** — `RouteRegistrar::registerAdmin` registers `GET /api/echo/status`.
- **AWS** — the `EchoFunction` gets a route on the admin API (`EchoAdminRoute`), gated by the
  same IP authorizer as the other admin routes.

The local run scripts use `GET http://localhost:8044/api/echo/status` (expect 200) as the
admin-server readiness check. Robot suite `01_smoke/admin_echo.robot` asserts the admin echo
returns 200, has the same body shape, and reports the same `status` as the public echo.

### Dev / maintenance endpoints (`/api/dev/**`)
The dev-only maintenance endpoints — `POST /api/dev/cleanup` (remove Robot test data) and,
on AWS, `POST /api/dev/seed` — are served **only on the admin endpoint** so they sit behind
the same IP boundary (no admin JWT required; the network/IP gate is the protection):
- **Java** — `AdminPortFilter` treats `/api/dev/**` as admin-only (served on 8044, 404 on 8042);
  the shared `DevController` answers on the admin connector.
- **Python** — `dev_controller.router` is mounted on `app_admin` only.
- **PHP** — `RouteRegistrar::registerAdmin` registers `POST /api/dev/cleanup` (removed from public).
- **AWS** — the `SeedFunction` routes (`/api/dev/seed`, `/api/dev/cleanup`) live on the admin API
  with the IP authorizer; the `SeedEndpoint` output points at the admin API.

Run scripts call cleanup on the admin endpoint: local `POST http://localhost:8044/api/dev/cleanup`;
AWS seeds/cleans via `AdminApiUrl` (env `AWS_ADMIN_API_URL_TEST` or the stack output).

---

## Java — `code/backend/java/`

- Admin match endpoints extracted from `adapter-rest/.../match/MatchController` into
  **`adapter-admin/.../controller/match/MatchAdminController`** (joins the existing
  `GuestAdminController`, `StoryAdminController`, `StoryCrudAdminController`). `adapter-admin`
  now depends on `adapter-rest` to reuse the match DTOs, so admin/player JSON stays identical.
- **`AdminServerConfig`** (`ms-launcher`) adds a second Tomcat connector on `game.admin.port`
  via `WebServerFactoryCustomizer.addAdditionalTomcatConnectors(...)`.
- **`AdminPortFilter`** (`ms-launcher`, registered at order 0 in `SecurityFilterConfig`) keys on
  `request.getLocalPort()`: admin port + non-admin path → 404; public port + admin path → 404.
- Config: `game.admin.port` = `${ADMIN_PORT:8044}` in `application.yml` / `application-prod.yml`.

Run: `mvn -pl ms-launcher spring-boot:run` → public 8042 + admin 8044 in one JVM.

## Python — `code/backend/python/`

- Admin match routes extracted into **`app/adapters/rest/match/match_admin_controller.py`**
  (reuses the `_summary_to_camel` / `_detail_to_camel` presenters from `match_controller`).
- **`launcher.py`** builds two FastAPI apps — `app` (public) and `app_admin` (admin) — each with
  its own `JwtMiddleware` + CORS, and runs both in one process via
  `asyncio.gather(uvicorn.Server(...8042), uvicorn.Server(...8044))`.
- Config: `admin_port: int = 8044` in `app/config.py`.

Run: `python3 -m app.launcher` → public 8042 + admin 8044 in one process.

## PHP — `code/backend/php/`

- Admin match methods extracted into **`src/Adapter/Rest/Matches/MatchAdminController.php`**.
- Shared wiring moved to **`public/bootstrap.php`**; routes split into
  **`src/Adapter/Rest/RouteRegistrar.php`** (`registerPublic` / `registerAdmin`).
- Two front controllers: **`public/index.php`** (public only) and
  **`public/index_admin.php`** (admin only).

Run both:
```bash
php -S localhost:8042 -t public                            # public
php -S localhost:8044 -t public public/index_admin.php     # admin
```

## AWS — `code/backend/aws/`

- New **`PathsGamesAdminApi`** (second `AWS::Serverless::HttpApi`) carries every `/api/admin/**`
  route; the public `PathsGamesApi` keeps the player/public routes.
- New **`AdminIpAuthorizerFunction`** (`lambda/authorizer/handler.py`) + **`AdminIpAuthorizer`**
  (REQUEST authorizer, simple responses, no `IdentitySource` → runs on every request) gate the
  admin API by source IP against `AdminIpWhitelist`. Empty allow-list = allow all (dev only).
- **Shared functions:** the existing Auth/Story/Match Lambdas keep serving admin routes; each
  admin-bearing module gained a second integration (`<Fn>AdminIntegration`) and a second invoke
  permission (`<Fn>AdminPermission`) for the admin API. Admin routes use
  `AuthorizationType: CUSTOM` + `AuthorizerId`.
- The in-Lambda `_check_admin_ip` stays as defense-in-depth.
- New stack output **`AdminApiUrl`**.

Set the allow-list at deploy time:
```bash
sam deploy ... --parameter-overrides AdminIpWhitelist=<your.ip.here>
```
> Deploys require explicit confirmation — see the AWS notes in `CLAUDE.md`.

---

## Frontend — `code/frontend/`

- **react-admin** (the only frontend that calls `/api/admin/**`) now defaults to the admin
  endpoint: `client.js` baseURL → `http://localhost:8044`, the Vite proxy → 8044, and
  `VITE_DEFAULT_SERVERS` lists the admin endpoint first. For AWS, point it at `AdminApiUrl`.
- **react-game** is unchanged (it makes no admin calls).

## Robot tests — `code/tests/robot/`

- New variable **`ADMIN_BASE_URL`** (`http://localhost:8044` in `dev.yaml`; the admin API URL in
  `aws.yaml`). The shared **`Create Admin Session`** keyword (`resources/common.resource`) now
  opens its session against `${ADMIN_BASE_URL}` — suites `14_admin` and `17_admin_crud` are
  unchanged.
- Local run scripts (`run_robot_with_local_java*.sh`, `_python.sh`, `_php.sh`) start/await the
  8044 admin listener and clean it up.

## Infra

- `code/scripts/test/java_docker_compose/docker-compose.yml` publishes the backend admin port
  `8044` to the host — **firewall it to the owner IP** (host firewall / security group). With the
  strict split, the legacy nginx by-path admin filter on 8042 is redundant.

---

## How to restrict to your IP

| Backend | Mechanism |
|---|---|
| Java / Python / PHP (bare) | OS firewall / cloud security group rule allowing 8044 only from your IP |
| Java docker-compose | host port `8044` mapping + host firewall / security group |
| AWS | `AdminIpWhitelist` deploy parameter → the Lambda authorizer rejects other IPs with 403 |

---

## Verification

```bash
# Java (one JVM serves both)
mvn -pl ms-launcher spring-boot:run
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8042/api/echo/status      # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8042/api/admin/matches    # 404 (admin hidden on public)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8044/api/admin/matches    # 401 (admin up, needs token)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8044/api/echo/status      # 404 (public hidden on admin)
```

- **Java:** `mvn test` — `MatchAdminControllerTest`, `AdminPortFilterTest`, `AdminServerConfigTest`.
- **Python:** `pytest tests` — `test_match_admin_controller.py`, `test_launcher_apps.py`.
- **PHP:** `vendor/bin/phpunit tests/Unit` — `MatchAdminControllerTest`, `RouteRegistrarTest`.
- **AWS:** `sam validate`; `pytest tests/test_authorizer_handler.py`.
- **Frontend:** `npm run test` (react-admin); **Robot:** suites `14_admin`, `17_admin_crud`.
