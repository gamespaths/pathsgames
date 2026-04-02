# Step 13 — Implement Session and Token Management

This document describes the implementation of **Step 13: Implement Session and Token Management** from the [Roadmap](./Step00_Roadmap.md).

## Summary

| Item | Detail |
|------|--------|
| **Step** | 13 |
| **Goal** | Token validation, refresh with rotation, logout, and API protection |
| **Pattern** | Hexagonal Architecture (Ports & Adapters) |
| **Auth mechanism** | JWT (access + refresh tokens) via JJWT library |
| **Token rotation** | Every refresh revokes ALL previous tokens, issues new pair |
| **Max tokens** | 5 active refresh tokens per user (configurable) |
| **Protection** | Servlet filter for API authentication + admin authorization |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 13.1 | Define JWT structure and claims | Reuses Step 12 JWT structure; added `parseToken()` and `validateToken()` to `JwtPort` |
| 13.2 | Implement token validation middleware | `JwtAuthenticationFilter` — servlet filter validating Bearer tokens on all `/api/*` requests |
| 13.3 | Handle token refresh flow | `POST /api/auth/refresh` with full token rotation (revoke all, issue new pair) |
| 13.4 | Implement logout and token revocation | `POST /api/auth/logout` (single) + `POST /api/auth/logout/all` (all sessions) |
| 13.5 | Protect API endpoints with authentication | Public paths configurable in `application.yml`; all other paths require valid access token |
| 13.6 | Protect admin API with authorization | `JwtAuthenticationFilter` blocks non-ADMIN users from `/api/admin/**` with 403 |


## Architecture

Following the project's **Hexagonal Architecture**:

```
┌──────────────────────────────────────────────────────────────┐
│                         core module                          │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │   TokenInfo      │  │    SessionService                │  │
│  │   RefreshedSess. │  │    implements SessionPort        │  │
│  │   (models)       │  │    (pure domain logic)           │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │  SessionPort     │  │    JwtPort (out) — extended      │  │
│  │  (port.in)       │  │    TokenPersistencePort (out)    │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          ▼                ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ adapter-rest │  │  adapter-auth   │  │   ms-launcher    │
│              │  │                 │  │                  │
│ SessionCtrl  │  │ JwtTokenProv.   │  │ CoreConfig       │
│ JwtAuthFilter│  │ (parse/validate)│  │ SecurityFilterCfg│
│ RefreshReq   │  │ TokenPersist.   │  │ (bean wiring)    │
│ RefreshResp  │  │ Adapter         │  │                  │
└──────────────┘  └─────────────────┘  └──────────────────┘
```


## API Endpoints

### POST `/api/auth/refresh` — Refresh Token (with Rotation)

Exchanges a valid refresh token for a new access + refresh token pair.
**Token rotation policy:** ALL previous tokens for the user are revoked.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Response (200 OK):**
```json
{
  "userUuid": "550e8400-e29b-41d4-a716-446655440000",
  "username": "guest_550e8400",
  "role": "PLAYER",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...(new)",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...(new)",
  "accessTokenExpiresAt": 1711533600000,
  "refreshTokenExpiresAt": 1712138400000
}
```

**Response (400 Bad Request):**
```json
{
  "error": "MISSING_REFRESH_TOKEN",
  "message": "refreshToken is required"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "INVALID_REFRESH_TOKEN",
  "message": "Refresh token is invalid, expired, or revoked. Please login again."
}
```


### POST `/api/auth/logout` — Logout (Single Token)

Revokes a single refresh token (logout from one device/channel).
Requires a valid access token in the `Authorization` header.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Response (200 OK):**
```json
{
  "status": "OK",
  "message": "Token revoked successfully",
  "timestamp": 1711533600000
}
```

**Response (404 Not Found):**
```json
{
  "error": "TOKEN_NOT_FOUND",
  "message": "Refresh token not found or already revoked"
}
```


### POST `/api/auth/logout/all` — Logout All Sessions

Revokes all active sessions for the authenticated user.
Requires a valid access token in the `Authorization` header.

**Request:** No body required (user UUID extracted from JWT by the filter).

**Response (200 OK):**
```json
{
  "status": "OK",
  "message": "All sessions revoked successfully",
  "timestamp": 1711533600000
}
```


### GET `/api/auth/me` — Get Current User Info

Returns the authenticated user's identity from the valid access token.
Requires a valid access token in the `Authorization` header.

**Response (200 OK):**
```json
{
  "userUuid": "550e8400-e29b-41d4-a716-446655440000",
  "username": "guest_550e8400",
  "role": "PLAYER",
  "timestamp": 1711533600000
}
```


## Authentication Filter

The `JwtAuthenticationFilter` is a `OncePerRequestFilter` registered on `/api/*`:

| Feature | Implementation |
|---------|---------------|
| **Public paths** | Configurable list (supports `/**` wildcards). Defaults include `/api/echo/**`, `/api/auth/guest`, `/api/auth/guest/resume`, `/api/auth/refresh`, `/api/versions` |
| **OPTIONS** | Always passes through (CORS preflight) |
| **Token extraction** | `Authorization: Bearer <token>` header |
| **Validation** | Calls `SessionPort.validateAccessToken()` → `JwtPort.validateToken()` + `parseToken()` |
| **Admin check** | Paths starting with `/api/admin/` require `role=ADMIN`; returns 403 if not |
| **Request attributes** | Sets `userUuid`, `username`, `role`, `tokenId` on the request for controllers |

### Error responses

| Status | Error Code | When |
|--------|-----------|------|
| 401 | `MISSING_TOKEN` | No `Authorization` header or doesn't start with `Bearer ` |
| 401 | `EMPTY_TOKEN` | Bearer token is empty/blank |
| 401 | `INVALID_TOKEN` | Token is expired, malformed, or invalid signature |
| 403 | `FORBIDDEN` | Non-ADMIN user accessing `/api/admin/**` |


## Token Rotation Flow

```
Client                        Server
  │                              │
  │  POST /api/auth/refresh      │
  │  { refreshToken: "old" }     │
  │  ─────────────────────────►  │
  │                              │  1. Validate JWT signature & expiry
  │                              │  2. Parse claims — verify type=refresh
  │                              │  3. Check DB: not revoked
  │                              │  4. Find user data by refresh token
  │                              │  5. REVOKE ALL user tokens (rotation)
  │                              │  6. Generate new access + refresh
  │                              │  7. Store new refresh token in DB
  │  ◄─────────────────────────  │
  │  200 { newAccess, newRefresh }│
  │                              │
```

> **Why token rotation?** If a refresh token is compromised, the attacker
> can only use it once. The legitimate user's next refresh will fail
> (because the old token was revoked), signaling a potential breach.


## Database Usage

No new tables or schema changes. Uses existing V0.10.1 migration tables:

### `users_tokens` table — Operations added
| Operation | Method | Description |
|-----------|--------|-------------|
| Find valid token | `findByRefreshTokenAndRevokedFalse` | Check token exists and not revoked |
| Find by refresh | `findByRefreshToken` | Find regardless of revoked status |
| Count active | `countActiveTokensByUserId` | JPQL count of non-revoked, non-expired |
| Revoke all | `revokeAllByUserId` | JPQL UPDATE sets revoked=true for all |
| Find oldest | `findActiveTokensByUserIdOrderByTsInsertAsc` | For token limit enforcement |

### `users` table — Operations added
| Operation | Method | Description |
|-----------|--------|-------------|
| Find by UUID | `findByUuid` | Find any user (any state) by UUID |


## Configuration

Properties added to `application.yml`:

```yaml
game:
  auth:
    max-tokens-per-user: 5
    admin-path-prefix: /api/admin/
    public-paths: /api/echo/**,/api/auth/guest,/api/auth/guest/resume,/api/auth/refresh,/api/versions
```


## Files Created / Modified

### New files
| Module | File | Purpose |
|--------|------|---------|
| core | `model/auth/TokenInfo.java` | Immutable domain model for parsed JWT claims |
| core | `model/auth/RefreshedSession.java` | Immutable domain model for token refresh result |
| core | `port/auth/SessionPort.java` | Inbound port for session management |
| core | `port/auth/TokenPersistencePort.java` | Outbound port for token DB operations |
| core | `service/auth/SessionService.java` | Domain service — pure Java, no Spring |
| adapter-auth | `persistence/TokenPersistenceAdapter.java` | DB adapter using Spring Data JPA |
| adapter-rest | `controller/auth/SessionController.java` | REST endpoints for refresh/logout/me |
| adapter-rest | `filter/JwtAuthenticationFilter.java` | Servlet filter for JWT validation |
| adapter-rest | `dto/RefreshTokenRequest.java` | Request DTO |
| adapter-rest | `dto/RefreshTokenResponse.java` | Response DTO |
| ms-launcher | `config/SecurityFilterConfig.java` | Filter registration bean |

### Modified files
| File | Change |
|------|--------|
| `core/port/auth/JwtPort.java` | Added `parseToken()` and `validateToken()` methods |
| `adapter-auth/jwt/JwtTokenProvider.java` | Implemented `parseToken()` and `validateToken()` |
| `adapter-auth/repository/UserTokenRepository.java` | Added 5 new query methods for session management |
| `adapter-auth/repository/UserRepository.java` | Added `findByUuid()` method |
| `ms-launcher/config/CoreConfig.java` | Added `SessionPort` bean with max-tokens-per-user |
| `ms-launcher/resources/application.yml` | Added session/filter config properties, version 0.13.0 |


## Tests

| Module | Test Class | Tests | Description |
|--------|-----------|-------|-------------|
| core | `TokenInfoTest` | 12 | Builder validation, accessors, isAdmin/isAccessToken/isRefreshToken |
| core | `RefreshedSessionTest` | 7 | Builder validation, null checks |
| core | `SessionServiceTest` | 34 | All branches of refreshToken, logout, revokeAllSessions, validateAccessToken |
| adapter-auth | `TokenPersistenceAdapterTest` | 15 | All persistence methods with mocked JPA repos |
| adapter-auth | `JwtTokenProviderTest` (updated) | 10 new | parseToken and validateToken (valid, invalid, null, wrong key) |
| adapter-rest | `SessionControllerTest` | 13 | MockMvc endpoint tests for all 4 endpoints |
| adapter-rest | `JwtAuthenticationFilterTest` | 17 | Filter logic: public paths, OPTIONS, auth, admin check |
| adapter-rest | `RefreshTokenRequestTest` | 2 | DTO constructors and setters |
| adapter-rest | `RefreshTokenResponseTest` | 3 | DTO constructors and setters |
| ms-launcher | `SecurityFilterConfigTest` | 1 | Filter registration bean creation |


## Frontend Concept (v0.13.0)

A standalone JavaScript frontend demo is available at: `code/website/concepts_v0/v0.13.0/`
- **Guest login** → `POST /api/auth/guest` (from Step 12)
- **Refresh tokens** → `POST /api/auth/refresh` (token rotation)
- **GET /me** → `GET /api/auth/me` (protected endpoint)
- **Try Admin** → `GET /api/admin/guests` (shows 403 for guests)
- **Logout** → `POST /api/auth/logout` (single token revocation)
- **Logout All** → `POST /api/auth/logout/all` (all sessions)
- Activity log showing all API interactions
- Medieval theme consistent with the project's design language


## Version Control
- First version created with AI prompts:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step 13: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.13.0/ folder, write new md file inside documentation_v0 folder. don't look and don't change backend-python and backend-php. write or update openapi documentation. let's go

- **Document Version**: 0.13.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.13.0 | Step 13: Implement session and token management | April 2, 2026 |
- **Last Updated**: April 2, 2026
- **Status**: ✅ Complete



# < Paths Games />
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website
