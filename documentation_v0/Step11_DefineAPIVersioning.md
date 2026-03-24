# Paths Games V1 - Step 11: Define API Versioning

This document defines the **API versioning strategy** for **Paths Games**, covering the versioning scheme, DNS structure, backward compatibility policy, deprecation lifecycle, supported-version documentation, and the backend code structure that enables future version coexistence.

All naming conventions follow [Step 06 - Naming Conventions](./Step06_NamingConventions.md). The backend module structure is defined in [Step 05 - Backend Structure](./Step05_BackendStructure.md). The existing REST endpoints and WebSocket topics are listed in [Step 06 - Naming Conventions](./Step06_NamingConventions.md) § 1.4 and § 2.1.


  - ✅ Establish a versioning scheme

  - ✅ Decide backward compatibility policy

  - ✅ Define deprecation strategy

  - ✅ Document supported versions

  - ✅ Prepare structure for future versions



## 1. Establish a Versioning Scheme

### 1.1 Versioning Model: DNS-Based Versioning

Paths Games uses **DNS-based versioning** — the API version is encoded in the **subdomain**, not in the URL path. The URL path always starts with `/api/` followed directly by the context and resource, with no version segment.

```
https://api.{version}.paths.games/api/{context}/{resource}/{id}

Examples:
  GET  https://api.v1.paths.games/api/stories
  POST https://api.v1.paths.games/api/games
  POST https://api.v1.paths.games/api/gameplay/{id_game}/action/pass
  GET  https://api.v2beta1.paths.games/api/game/{id}/players
```

Every REST endpoint uses the same `/api/...` path regardless of version. The version is resolved entirely at the DNS and infrastructure layer.


### 1.2 Why DNS-Based Versioning

Five common API versioning strategies were evaluated:

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **DNS / subdomain** | `api.v1.paths.games/api/stories` | Clean paths, full isolation, zero app-level version logic | DNS configuration required per version |
| URL path | `/api/v1/stories` | Simple, visible | Pollutes URLs, forces versioned code in Java packages |
| Header | `Accept: application/vnd.paths.v1+json` | Clean URLs | Hidden, harder to test/debug |
| Query parameter | `/api/stories?version=1` | Easy to add | Messy, poor caching |
| Content negotiation | `Accept: application/json; version=1` | RESTful purist | Complex, poor tooling support |

**Decision**: DNS-based versioning is chosen because:
- **Clean code**: Java controllers, packages, and DTOs have **no version suffixes or prefixes** — the codebase is version-agnostic
- **Full isolation**: Each version can be a separate deployment, a separate container, or routed via infrastructure (CloudFront, ALB, API Gateway)
- **Independent scaling**: `api.v1.paths.games` and `api.v2.paths.games` can scale independently
- **Zero application logic**: The application never needs to parse or route by version — DNS and infrastructure handle it entirely
- **Simple migration**: Switching a client from v1 to v2 is a DNS/base-URL change — no path rewrites
- **Consistency**: WebSocket connections also use the same subdomain (`api.v1.paths.games/ws/...`)


### 1.3 Version Format

The version label appears as a subdomain segment and follows a strict format:

```
api.v{major}.paths.games            — Stable release (e.g., api.v1, api.v2)
api.v{major}beta{n}.paths.games     — Beta / preview (e.g., api.v2beta1)
api.v{major}alpha{n}.paths.games    — Alpha / experimental (e.g., api.v2alpha1)
```

| Component | Rule | Examples |
|-----------|------|---------|
| Prefix | Always lowercase `api.v` | `api.v1`, `api.v2` |
| Major number | Positive integer, incremented on breaking changes | `1`, `2`, `3` |
| Stability label | Optional suffix — `alpha{n}` or `beta{n}` | `api.v2beta1`, `api.v2alpha1` |
| No minor/patch | API versions track breaking changes only — not bug fixes | `api.v1` (not `api.v1.2.3`) |

**Current active version**: **`api.v1.paths.games`**

> **Note**: The API version (`v1`, `v2`) is independent from the project version (`0.10.13`) and the database schema version (`V0.10.x`). The API version increments only when there are breaking changes to the public HTTP contract.


### 1.4 DNS Structure

Each API version is served from its own subdomain:

```
api.v1.paths.games        → v1 stable deployment
api.v2.paths.games        → v2 stable deployment
api.v2beta1.paths.games   → v2 beta deployment
```

DNS records point each subdomain to the corresponding deployment (e.g., CloudFront distribution, ALB target group, or Kubernetes service). The application behind each subdomain serves all endpoints under `/api/`:

```
GET  /api/echo/status          — health check
GET  /api/stories               — story catalog
POST /api/games                 — create match
GET  /api/versions              — version discovery
```

The health-check endpoint `/api/echo/status` is available on **every** versioned subdomain and is used for monitoring, load-balancer health checks, and diagnostics.


### 1.5 WebSocket Versioning

WebSocket connections use the same DNS-based versioning — the client connects to the versioned subdomain:

```
wss://api.v1.paths.games/ws/game/{uuid_match}
wss://api.v2.paths.games/ws/game/{uuid_match}
```

The WebSocket path has **no version segment** — just `/ws/game/{id}`. The version is implicit from the subdomain. WebSocket message types (`TURN_UPDATE`, `STATE_SYNC`, etc.) and their payload shapes are tied to the deployment version behind that subdomain.



## 2. Backward Compatibility Policy

### 2.1 What is a Breaking Change

A change is **breaking** if it can cause existing clients to fail. The following changes are considered breaking:

| Change Type | Breaking? | Example |
|-------------|-----------|---------|
| Remove an endpoint | ✅ Yes | Removing `GET /api/games/active` |
| Rename an endpoint path | ✅ Yes | `/api/games` → `/api/matches` |
| Remove a response field | ✅ Yes | Removing `characterName` from turn updates |
| Change a field type | ✅ Yes | `characterId: number` → `characterId: string` |
| Change an enum value | ✅ Yes | `"SLEEPING"` → `"ASLEEP"` |
| Make an optional request field required | ✅ Yes | Adding mandatory `difficulty` to join request |
| Change error code format | ✅ Yes | `"ERROR_CODE"` → `{ code: "ERROR_CODE", ... }` |
| Add a new optional response field | ❌ No | Adding `avatarUrl` to player response |
| Add a new endpoint | ❌ No | Adding `GET /api/games/{id}/summary` |
| Add a new optional request field | ❌ No | Adding optional `nickname` to join request |
| Add a new enum value | ❌ No | Adding `"FROZEN"` to match states |
| Change internal behavior (same contract) | ❌ No | Optimizing turn calculation algorithm |
| Fix a bug in response data | ❌ No | Returning correct timestamp format |

### 2.2 Compatibility Rules for V1

| Rule | Description |
|------|-------------|
| **No breaking changes within v1** | Once `v1` is released, its contract is frozen. Bug fixes and non-breaking additions are allowed. |
| **Additive changes only** | New endpoints, new optional fields, and new enum values can be added to `v1` without creating `v2`. |
| **One active stable version at a time** | During V1 development, only `v1` exists. When `v2` is introduced, `v1` enters deprecation (see § 3). |
| **Beta/alpha versions have no guarantee** | `v2beta1` can change freely. Clients using beta versions accept instability. |
| **UUID stability** | Public UUIDs are permanent identifiers. An entity's UUID never changes across API versions. |


### 2.3 Version Coexistence

When a breaking change is needed, a new major version is created. Both versions coexist for a transition period:

```
Timeline:
  ┌──────────────────────────────────────────────────────────┐
  │ v1 (stable)                              v1 (deprecated) │
  │ ████████████████████████████████████████░░░░░░░░░░░░░░░░│
  │                     v2 (beta)   v2 (stable)              │
  │                     ░░░░░░░░░░░█████████████████████████│
  └──────────────────────────────────────────────────────────┘
       v1 release      v2beta1     v2 release    v1 sunset
```

During coexistence:
- Both `v1` and `v2` controllers are deployed simultaneously
- The core domain layer (ports, services) is shared — only the adapter layer differs
- Database schema changes support both versions (additive-only column changes)



## 3. Deprecation Strategy

### 3.1 Deprecation Lifecycle

Each API version goes through four phases:

| Phase | Status | Duration | Client Impact |
|-------|--------|----------|---------------|
| **Active** | Current stable | Indefinite (until successor released) | Full support, SLA guarantees |
| **Deprecated** | Replaced by newer stable | Minimum 6 months | Functional, but returns deprecation headers |
| **Sunset** | End of life | 30-day warning period | Returns `410 Gone` after sunset date |
| **Removed** | Controllers deleted | Permanent | Requests return `404` |


### 3.2 Deprecation Headers

When a version enters the **Deprecated** phase, all responses from that subdomain include standard deprecation headers ([RFC 8594](https://datatracker.ietf.org/doc/html/rfc8594)):

```http
HTTP/1.1 200 OK
Deprecation: Sun, 01 Mar 2027 00:00:00 GMT
Sunset: Sun, 01 Sep 2027 00:00:00 GMT
Link: <https://api.v2.paths.games/api/stories>; rel="successor-version"
X-API-Version: v1
X-API-Status: deprecated
```

| Header | Purpose |
|--------|---------|
| `Deprecation` | Date when the version was officially deprecated |
| `Sunset` | Date when the version will stop responding |
| `Link` | Points to the equivalent endpoint on the successor subdomain |
| `X-API-Version` | Current version being used (resolved from subdomain) |
| `X-API-Status` | `active`, `deprecated`, or `sunset` |


### 3.3 Sunset Behavior

After the sunset date:
- All endpoints under the removed version return `410 Gone` with a JSON error body
- The response includes a migration guide URL

```json
{
  "error": "API_VERSION_SUNSET",
  "message": "API v1 has been retired. Please migrate to v2.",
  "sunsetDate": "2027-09-01T00:00:00Z",
  "migrationGuide": "https://paths.games/docs/api/migration-v1-to-v2",
  "successorBase": "https://api.v2.paths.games",
  "timestamp": 1725148800000
}
```


### 3.4 Version Discovery Endpoint

A version-discovery endpoint is available on **every** versioned subdomain:

```
GET https://api.v1.paths.games/api/versions
```

Response:
```json
{
  "versions": [
    {
      "version": "v1",
      "status": "active",
      "baseUrl": "https://api.v1.paths.games",
      "releasedAt": "2026-06-01T00:00:00Z",
      "deprecatedAt": null,
      "sunsetAt": null
    }
  ],
  "currentStable": "v1",
  "timestamp": 1711324800000
}
```

This endpoint returns metadata about **all** known API versions across all subdomains, allowing clients to discover available versions and plan migrations.



## 4. Document Supported Versions

### 4.1 Version Registry

The following table tracks all API versions across the project lifecycle. It will be updated as versions are introduced.

| Version | Status | Subdomain | Released | Deprecated | Sunset | Notes |
|---------|--------|-----------|----------|------------|--------|-------|
| `v1` | **Active** | `api.v1.paths.games` | V1 release | — | — | First stable version. All endpoints from Step 06 § 1.4. |

> This table is the single source of truth for API version lifecycle.


### 4.2 Version-to-Feature Mapping

Each API version is associated with specific feature sets. All endpoints below are served from the versioned subdomain (e.g., `api.v1.paths.games`) under the `/api/` prefix:

| Feature Area | Endpoints (under `/api/`) | Notes |
|-------------|--------------------------|-------|
| **Authentication** | `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `GET /auth/me`, `POST /auth/me/change-password`, `POST /auth/me/change-data` | JWT-based, Google SSO |
| **Stories** | `GET /stories`, `GET /stories/{id}/characters`, `GET /stories/{id}/lingua/{lingua}/testo/{id_testo}`, `GET /stories/{id}/lingua/{lingua}/carta/{id_immagine}` | Read-only catalog |
| **Match Management** | `GET /games/active`, `POST /games`, `POST /games/{id}/join`, `POST /games/{id}/start`, `POST /games/{id}/leave`, `GET /games/{id}/state`, `POST /games/{id}/select-character`, `DELETE /games/{id}` | CRUD + lifecycle |
| **In-Match State** | 12 GET/POST endpoints under `/game/{id}/` | Players, locations, missions, turn order, events, notifications |
| **Gameplay Actions** | 18 GET/POST/DELETE endpoints under `/gameplay/{id_game}/` | Movement, inventory, trade, actions, choices |
| **Chat** | Endpoints under `/gamechat/{id_game}/` | In-match chat |
| **Admin** | 8 endpoints under `/admin/` | Logs, snapshots, force-unlock, kick |
| **Infrastructure** | `GET /echo/status`, `GET /versions` | Health check, version discovery |

The full endpoint list is maintained in [Step 06 § 1.4](./Step06_NamingConventions.md). No endpoint path contains a version segment — the version is in the subdomain.


### 4.3 WebSocket Version Mapping

| API Version | WebSocket URL | Message Types |
|-------------|--------------|---------------|
| `v1` | `wss://api.v1.paths.games/ws/game/{uuid_match}` | 18 types defined in Step 06 § 2.2 |

WebSocket versions are always matched 1:1 with the REST API version. The version is determined by the subdomain, not the WebSocket path.



## 5. Prepare Structure for Future Versions

### 5.1 Backend Package Organization

The backend follows Hexagonal Architecture (Step 05). Since the API version is resolved at the DNS/infrastructure layer, the **Java codebase is completely version-agnostic**. There are **no version suffixes, no version sub-packages, and no version segments in request mappings**.

#### Package Structure

```
adapter-rest/
└── src/main/java/games/paths/adapters/rest/
    ├── controller/
    │   ├── EchoController.java              @RequestMapping("/api/echo")
    │   ├── VersionController.java           @RequestMapping("/api/versions")
    │   ├── AuthController.java              @RequestMapping("/api/auth")
    │   ├── StoryController.java             @RequestMapping("/api/stories")
    │   ├── MatchController.java             @RequestMapping("/api/games")
    │   ├── GameStateController.java         @RequestMapping("/api/game")
    │   ├── GameplayController.java          @RequestMapping("/api/gameplay")
    │   └── GameChatController.java          @RequestMapping("/api/gamechat")
    ├── dto/
    │   ├── request/
    │   │   ├── CreateMatchRequest.java
    │   │   ├── JoinMatchRequest.java
    │   │   └── ...
    │   └── response/
    │       ├── MatchStateResponse.java
    │       ├── TurnUpdateResponse.java
    │       └── ...
    └── config/
        ├── ApiVersionConfig.java            ← version metadata bean
        └── DeprecationInterceptor.java      ← adds deprecation headers
```

> **Key rule**: No folder, package, class, or mapping path in the Java codebase ever contains `v1`, `v2`, or any version reference. The same compiled artifact is deployed behind `api.v1.paths.games` today and could theoretically be deployed behind `api.v2.paths.games` with different configuration.

#### How v2 Works

When a breaking change is needed for v2:
1. A **new Git branch** (or fork) is created from the v1 codebase
2. Breaking changes are applied to controllers and DTOs — still with no version in package names or class names
3. The modified codebase is deployed behind `api.v2.paths.games`
4. The original v1 codebase continues to run behind `api.v1.paths.games`

```
Deployment view:

  api.v1.paths.games  →  Docker image: pathsgames:v1   →  branch: release/v1
  api.v2.paths.games  →  Docker image: pathsgames:v2   →  branch: release/v2
```

Both deployments have identical package structure — the only difference is the code inside the controllers and DTOs.


### 5.2 Controller Class Conventions

| Convention | Rule | Example |
|------------|------|---------|
| Class name | Plain name, **no version suffix** | `MatchController`, `AuthController` |
| Package | `games.paths.adapters.rest.controller` | **No version sub-package** |
| Base mapping | `@RequestMapping("/api/{context}")` | `/api/games`, `/api/stories` |
| Port injection | All controllers inject **core ports** (version-agnostic) | `MatchPort`, `AuthPort` |
| DTO package | `games.paths.adapters.rest.dto.request` / `.response` | **No version sub-package** |

#### Example Controller

```java
package games.paths.adapters.rest.controller;

import games.paths.core.port.in.MatchPort;
import games.paths.adapters.rest.dto.request.CreateMatchRequest;
import games.paths.adapters.rest.dto.response.MatchStateResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/games")
public class MatchController {

    private final MatchPort matchPort;

    public MatchController(MatchPort matchPort) {
        this.matchPort = matchPort;
    }

    @PostMapping
    public MatchStateResponse createMatch(@RequestBody CreateMatchRequest request) {
        // delegate to core port
        return matchPort.createMatch(request.getStoryId(), request.getDifficultyId());
    }

    @GetMapping("/active")
    public List<MatchStateResponse> listActiveMatches() {
        return matchPort.listActiveMatches();
    }
}
```

> Notice: no `V1` suffix, no `/v1/` in the path, no versioned package. This controller serves `https://api.v1.paths.games/api/games` (or any future subdomain).


### 5.3 Version Metadata Configuration

A Spring `@Configuration` bean exposes version metadata. The version info is injected via **environment variables or application properties**, not hardcoded — the same artifact can serve any version depending on its deployment context:

```java
package games.paths.adapters.rest.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.*;

@Configuration
public class ApiVersionConfig {

    public record ApiVersionInfo(
        String version,
        String status,          // "active", "deprecated", "sunset"
        String baseUrl,
        String releasedAt,
        String deprecatedAt,    // nullable
        String sunsetAt         // nullable
    ) {}

    @Value("${api.version:v1}")
    private String currentVersion;

    @Value("${api.version.status:active}")
    private String currentStatus;

    @Value("${api.version.base-url:https://api.v1.paths.games}")
    private String currentBaseUrl;

    @Value("${api.version.released-at:2026-06-01T00:00:00Z}")
    private String releasedAt;

    @Value("${api.version.deprecated-at:#{null}}")
    private String deprecatedAt;

    @Value("${api.version.sunset-at:#{null}}")
    private String sunsetAt;

    @Bean
    public ApiVersionInfo currentApiVersion() {
        return new ApiVersionInfo(
            currentVersion, currentStatus, currentBaseUrl,
            releasedAt, deprecatedAt, sunsetAt
        );
    }

    @Bean
    public String currentStableVersion() {
        return currentVersion;
    }
}
```

Example `application.yml` for the v1 deployment:
```yaml
api:
  version: v1
  version:
    status: active
    base-url: https://api.v1.paths.games
    released-at: 2026-06-01T00:00:00Z
```

Example `application.yml` for a deprecated v1 deployment:
```yaml
api:
  version: v1
  version:
    status: deprecated
    base-url: https://api.v1.paths.games
    released-at: 2026-06-01T00:00:00Z
    deprecated-at: 2027-03-01T00:00:00Z
    sunset-at: 2027-09-01T00:00:00Z
```


### 5.4 Deprecation Interceptor

When a deployment is configured as deprecated (via `api.version.status=deprecated`), a Spring `HandlerInterceptor` automatically adds deprecation headers to all responses:

```java
package games.paths.adapters.rest.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

public class DeprecationInterceptor implements HandlerInterceptor {

    private final ApiVersionConfig.ApiVersionInfo versionInfo;

    public DeprecationInterceptor(ApiVersionConfig.ApiVersionInfo versionInfo) {
        this.versionInfo = versionInfo;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        response.setHeader("X-API-Version", versionInfo.version());
        response.setHeader("X-API-Status", versionInfo.status());

        if ("deprecated".equals(versionInfo.status())) {
            if (versionInfo.deprecatedAt() != null) {
                response.setHeader("Deprecation", versionInfo.deprecatedAt());
            }
            if (versionInfo.sunsetAt() != null) {
                response.setHeader("Sunset", versionInfo.sunsetAt());
            }
        }
        return true;
    }
}
```

> The interceptor reads from the **deployment configuration**, not from hardcoded version constants. The same interceptor class works for v1, v2, or any future version.


### 5.5 WebSocket Structure

The WebSocket adapter mirrors the REST pattern — **no version in packages, class names, or paths**:

```
adapter-websocket/
└── src/main/java/games/paths/adapters/websocket/
    ├── config/
    │   └── WebSocketConfig.java
    ├── handler/
    │   └── GameWebSocketHandler.java
    └── dto/
        ├── TurnUpdateMessage.java
        ├── GameEventMessage.java
        └── StateSyncMessage.java
```

WebSocket configuration registers topic prefixes without version segments:

```java
@Override
public void configureMessageBroker(MessageBrokerRegistry config) {
    config.enableSimpleBroker("/topic");
    config.setApplicationDestinationPrefixes("/app");
}

// Client connects to: wss://api.v1.paths.games/ws/game/{uuid_match}
// Messages are sent to: /topic/game/{uuid_match}
```

The version is determined by which subdomain (`api.v1` vs `api.v2`) the WebSocket client connects to.


### 5.6 Database Schema Compatibility

API versions and database schema versions are **independent**:

| Concern | API Version | DB Schema Version |
|---------|-------------|-------------------|
| Format | `v1`, `v2` (DNS subdomain) | `V0.10.x`, `V0.11.x`, `V1.0.x` |
| Trigger | Breaking HTTP contract change | Any DDL change |
| Scope | DNS routing + deployment | Database tables, columns, indexes |
| Lifecycle | Long-lived (months/years) | Incremental (per feature step) |

When a new API version requires schema changes:
- **Additive-only column changes** are preferred (compatible with both v1 and v2 deployments)
- If a destructive change is needed, a data migration script handles the transition
- Both v1 and v2 deployments may share the same database, relying on additive-only column strategy
- Flyway version range `V0.11.x` is reserved for Step 11 if DDL changes are needed (currently none required)


### 5.7 Version Selection for Clients

Clients choose their API version by **base URL** (subdomain). There is no path-based or header-based negotiation. The recommended client pattern:

```javascript
// Frontend API client configuration
const API_BASE = 'https://api.v1.paths.games/api';

// When migrating to v2:
// const API_BASE = 'https://api.v2.paths.games/api';

async function getActiveMatches() {
    const response = await fetch(`${API_BASE}/games/active`);
    return response.json();
}
```

The frontend stores the versioned base URL in a single constant, making version upgrades a one-line change. Note that the `/api/` prefix is always present and never contains a version segment.



## 6. Implementation Checklist

The following changes implement this step's API versioning scheme in the codebase:

| # | Task | Module | Status |
|---|------|--------|--------|
| 1 | Create controllers under `adapter-rest/controller/` (no version sub-package) | `adapter-rest` | 🔲 |
| 2 | Create DTOs under `adapter-rest/dto/request/` and `dto/response/` (no version sub-package) | `adapter-rest` | 🔲 |
| 3 | Create `ApiVersionConfig` bean with externalized version properties | `adapter-rest` | 🔲 |
| 4 | Create `DeprecationInterceptor` (reads status from config) | `adapter-rest` | 🔲 |
| 5 | Create `GET /api/versions` endpoint (`VersionController`) | `adapter-rest` | 🔲 |
| 6 | Create WebSocket handler under `adapter-websocket/handler/` (no version sub-package) | `adapter-websocket` | 🔲 |
| 7 | Create WebSocket DTOs under `adapter-websocket/dto/` (no version sub-package) | `adapter-websocket` | 🔲 |
| 8 | Verify EchoController serves at `/api/echo` with no version | `adapter-rest` | 🔲 |
| 9 | Write unit tests for `ApiVersionConfig`, `VersionController`, and `DeprecationInterceptor` | `adapter-rest` | 🔲 |
| 10 | Configure DNS record `api.v1.paths.games` pointing to deployment | `terraform-aws` | 🔲 |
| 11 | Add `api.version` properties to `application.yml` | `ms-launcher` | 🔲 |

> **Note**: No database migration is required for this step. The existing 52-table schema is compatible with the versioning structure. Flyway version range `V0.11.x` remains reserved for future use.



## 7. Quick Reference

| Aspect | Decision |
|--------|----------|
| **Versioning model** | DNS-based — `api.{version}.paths.games` |
| **Current version** | `api.v1.paths.games` |
| **Format** | `v{major}` (stable), `v{major}beta{n}`, `v{major}alpha{n}` |
| **URL prefix** | `/api/` — no version segment in path |
| **Breaking change policy** | New subdomain + new deployment required |
| **Non-breaking changes** | Allowed within current deployment |
| **Deprecation period** | Minimum 6 months |
| **Sunset warning** | 30 days before removal |
| **Deprecation headers** | `Deprecation`, `Sunset`, `Link`, `X-API-Version`, `X-API-Status` |
| **Controller naming** | `{Entity}Controller` — **no version suffix** |
| **DTO naming** | `dto.request`, `dto.response` — **no version sub-package** |
| **WebSocket** | `wss://api.{version}.paths.games/ws/game/{id}` — no version in path |
| **Java codebase** | **Zero version references** in packages, classes, or mappings |
| **Version config** | Externalized via `application.yml` / environment variables |
| **Core domain** | Version-agnostic — shared across all API versions |
| **DB schema** | Independent from API version — Flyway `V0.11.x` reserved |



# Version Control
- First version created with AI prompt:
    > read all md files and write the Step11 file
- Second version created with AI prompt:
    > version API will be configured from dns, for example api.v1.domain.com or api.v2beta2.domain.com, leave only "api/" suffix, on java NEVER use v1 or v2 on suffix or package paths
- **Document Version**: 0.11.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.11.0 | first version: versioning scheme, compatibility policy, deprecation strategy, supported versions, code structure | March 24, 2026 |
    | 0.11.1 | second version: switch from URL-path to DNS-based versioning, remove all v1/v2 from Java code | March 24, 2026 |
- **Last Updated**: March 24, 2026
- **Status**: Complete ✅



# < Paths Games />
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
