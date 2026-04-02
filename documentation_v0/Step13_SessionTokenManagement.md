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
| **Cookie security** | `refreshToken` → HttpOnly cookie; only `accessToken` exposed to JS (XSS-safe) |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 13.1 | Define JWT structure and claims | Reuses Step 12 JWT structure; added `parseToken()` and `validateToken()` to `JwtPort` |
| 13.2 | Implement token validation middleware | `JwtAuthenticationFilter` — servlet filter validating Bearer tokens on all `/api/*` requests |
| 13.3 | Handle token refresh flow | `POST /api/auth/refresh` with full token rotation (revoke all, issue new pair) |
| 13.4 | Implement logout and token revocation | `POST /api/auth/logout` (single) + `POST /api/auth/logout/all` (all sessions) |
| 13.5 | Protect API endpoints with authentication | Public paths configurable in `application.yml`; all other paths require valid access token |
| 13.6 | Protect admin API with authorization | `JwtAuthenticationFilter` blocks non-ADMIN users from `/api/admin/**` with 403 || 13.7 | HttpOnly cookie migration (XSS hardening) | `refreshToken` and `guestCookieToken` moved to HttpOnly `Set-Cookie` headers; only `accessToken` remains in JS memory |

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

Exchanges the `pathsgames.refreshToken` HttpOnly cookie for a new access token.
**Token rotation policy:** ALL previous tokens for the user are revoked.
No request body is required — the browser sends the HttpOnly cookie automatically
when the request is made with `credentials: 'include'`.

**Request:** No body. Cookie sent automatically:
```
Cookie: pathsgames.refreshToken=eyJhbGciOiJIUzI1NiJ9...
```

**Response (200 OK):**

Response `Set-Cookie` header (rotated):
```
Set-Cookie: pathsgames.refreshToken=<new-jwt>; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=604800
```

Response JSON body (`refreshToken` is now in the cookie, not here):
```json
{
  "userUuid": "550e8400-e29b-41d4-a716-446655440000",
  "username": "guest_550e8400",
  "role": "PLAYER",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...(new)",
  "accessTokenExpiresAt": 1711533600000,
  "refreshTokenExpiresAt": 1712138400000
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

Revokes the refresh token from the `pathsgames.refreshToken` HttpOnly cookie
(logout from one device/channel). The server clears both HttpOnly cookies in the response.
No request body is required.
Requires a valid access token in the `Authorization` header.

**Request:** No body. Cookie sent automatically:
```
Cookie: pathsgames.refreshToken=eyJhbGciOiJIUzI1NiJ9...
Authorization: Bearer <access-token>
```

**Response (200 OK):** Cookies cleared by server:
```
Set-Cookie: pathsgames.refreshToken=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0
Set-Cookie: pathsgames.guestcookie=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0
```
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
The server clears both HttpOnly cookies in the response.
Requires a valid access token in the `Authorization` header.

**Request:** No body (user UUID extracted from JWT by the filter).

**Response (200 OK):** Cookies cleared by server:
```
Set-Cookie: pathsgames.refreshToken=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0
Set-Cookie: pathsgames.guestcookie=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0
```
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
Client                          Server
  │                               │
  │  POST /api/auth/refresh        │
  │  Cookie: pathsgames.refreshToken=<old-jwt>  │
  │  (← sent automatically by browser)│
  │  ─────────────────────────►  │
  │                               │  1. Read refreshToken from HttpOnly cookie
  │                               │  2. Validate JWT signature & expiry
  │                               │  3. Verify type=refresh; check DB not-revoked
  │                               │  4. Find user data by refresh token
  │                               │  5. REVOKE ALL user tokens (rotation)
  │                               │  6. Generate new access + refresh tokens
  │                               │  7. Store new refresh token in DB
  │                               │  8. Set new refreshToken as HttpOnly Set-Cookie
  │  ◄─────────────────────────  │
  │  200 { newAccessToken }        │
  │  Set-Cookie: pathsgames.refreshToken=<new-jwt>; HttpOnly  │
  │                               │
```

> **Why HttpOnly cookies?** If the frontend is compromised by XSS, the attacker can
> steal the `accessToken` from memory, but **cannot steal the `refreshToken`** because
> `HttpOnly` prevents any JavaScript from reading it. This limits the XSS blast radius
> to a maximum of 30 minutes (access token lifetime).


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
    cookie:
      secure: false        # set to true in production (HTTPS only)
      same-site: Lax       # Lax prevents CSRF while allowing normal navigation
```

### HttpOnly Cookie Names

| Cookie | Value | Lifetime | Scope |
|--------|-------|----------|-------|
| `pathsgames.refreshToken` | JWT refresh token | 7 days | `Path=/api/auth` |
| `pathsgames.guestcookie` | Guest resumption UUID | 30 days | `Path=/api/auth` |

Both cookies are set with `HttpOnly; SameSite=Lax` and `Secure=true` in production.
The `Path=/api/auth` scope ensures they are only sent to authentication endpoints.


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
| adapter-rest | `cookie/CookieHelper.java` | Static utility for HttpOnly cookie management |
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
| `ms-launcher/resources/application.yml` | Added session/filter/cookie config properties, version 0.13.0 |
| `adapter-rest/dto/GuestLoginResponse.java` | Removed `refreshToken` and `guestCookieToken` (now HttpOnly cookies) |
| `adapter-rest/dto/RefreshTokenResponse.java` | Removed `refreshToken` (now HttpOnly cookie) |
| `adapter-rest/controller/auth/GuestAuthController.java` | Sets/reads HttpOnly cookies via CookieHelper |
| `adapter-rest/controller/auth/SessionController.java` | Reads refreshToken from cookie; deletes cookies on logout |


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

**HttpOnly cookie security model (applied in v0.13.0):**
- `refreshToken` → HttpOnly cookie set by the server — invisible to JavaScript
- `guestCookieToken` → HttpOnly cookie set by the server — invisible to JavaScript
- `accessToken` → kept in memory (not localStorage) for `Authorization: Bearer` headers
- All `fetch()` calls use `credentials: 'include'` so cookies are sent automatically
- On page reload, `POST /api/auth/guest/resume` is called with no body — cookie sent automatically

**Interactions demonstrated:**
- **Guest login** → `POST /api/auth/guest` (cookies set by server)
- **Refresh tokens** → `POST /api/auth/refresh` (no body, cookie sent automatically)
- **GET /me** → `GET /api/auth/me` (protected endpoint, Bearer header)
- **Try Admin** → `GET /api/admin/guests` (shows 403 for guests)
- **Logout** → `POST /api/auth/logout` (cookie sent, server deletes cookies)
- **Logout All** → `POST /api/auth/logout/all` (all sessions, server deletes cookies)
- Activity log showing all API interactions
- Medieval theme consistent with the project's design language

**Admin concept (v0.13.1-admin):** `code/website/concepts_v0/v0.13.1-admin/`
Same HttpOnly cookie model; demonstrates 403 for non-ADMIN users on admin endpoints.


## Version Control
- First version created with AI prompts:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step 13: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.13.0/ folder, write new md file inside documentation_v0 folder. don't look and don't change backend-python and backend-php. write or update openapi documentation. let's go  

    > I wanna change project and use "cookie HttpOnly" configuration, change backend and concepts (v0.13.0 and v0.13.1), move refreshToken in cookie HttpOnly and leave only accessToken in memory to remove "XSS blast radius" problem, update README.md into concept/v0.13.0 where you describe what did you do". please update openapi yaml files and Step13_SessionTokenManagement.md

- **Document Version**: 0.13.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.13.0 | Step 13: Implement session and token management | April 2, 2026 |
    | 0.13.1 | HttpOnly cookie migration: refreshToken + guestCookieToken moved to Set-Cookie headers | April 2, 2026 |
- **Last Updated**: April 2, 2026
- **Status**: ✅ Complete



# < Paths Games />
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website
