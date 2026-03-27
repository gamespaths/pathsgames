# Step 12 — Implement Guest Login Method

This document describes the implementation of **Step 12: Implement Guest Login Method** from the [Roadmap](./Step00_Roadmap.md).

## Summary

| Item | Detail |
|------|--------|
| **Step** | 12 |
| **Goal** | Allow anonymous users to start playing without registration |
| **Pattern** | Hexagonal Architecture (Ports & Adapters) |
| **Auth mechanism** | JWT (access + refresh tokens) via JJWT library |
| **Guest identity** | Anonymous UUID, no email or password required |
| **Session lifetime** | 30 days (configurable) |
| **Cleanup** | Automatic scheduler every 6 hours |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 12.1 | Define guest identity model | `GuestSession` domain model with UUID, tokens, expiration |
| 12.2 | Create guest session endpoint | `POST /api/v1/auth/guest` to create, `POST /api/v1/auth/guest/resume` to resume |
| 12.3 | Issue JWT token for guest users | HMAC-SHA256 signed access (30min) and refresh (7 days) tokens |
| 12.4 | Store guest session in database | Uses existing `users` table (state=6) and `users_tokens` table |
| 12.5 | Handle guest session expiration and cleanup | Scheduled task every 6 hours + `guest_expires_at` field |


## Architecture

Following the project's **Hexagonal Architecture**:

```
┌──────────────────────────────────────────────────────────┐
│                      core module                         │
│  ┌─────────────────┐  ┌───────────────────────────────┐  │
│  │   GuestSession  │  │    GuestAuthService           │  │
│  │   (model)       │  │    implements GuestAuthPort   │  │
│  └─────────────────┘  └───────────────────────────────┘  │
│  ┌─────────────────┐  ┌───────────────────────────────┐  │
│  │  GuestAuthPort  │  │    JwtPort (out)              │  │
│  │  (port.in)      │  │    GuestPersistencePort (out) │  │
│  └─────────────────┘  └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          ▼                ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ adapter-rest │  │  adapter-auth   │  │   ms-launcher    │
│              │  │                 │  │                  │
│ GuestAuth    │  │ JwtTokenProvider│  │ CoreConfig       │
│ Controller   │  │ GuestPersist.   │  │ WebConfig        │
│ GuestLogin   │  │ Adapter         │  │ (wiring)         │
│ Response(DTO)│  │ CleanupScheduler│  │                  │
└──────────────┘  └─────────────────┘  └──────────────────┘
```


## API Endpoints

### POST `/api/v1/auth/guest` — Create Guest Session

Creates a new anonymous guest user and returns JWT tokens.

**Request:** No body required.

**Response (201 Created):**
```json
{
  "userUuid": "550e8400-e29b-41d4-a716-446655440000",
  "username": "guest_550e8400",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "accessTokenExpiresAt": 1711533600000,
  "refreshTokenExpiresAt": 1712138400000,
  "guestCookieToken": "a3b2c1d0-e5f6-7890-abcd-ef1234567890"
}
```

### POST `/api/v1/auth/guest/resume` — Resume Guest Session

Resumes an existing guest session using the cookie token.

**Request:**
```json
{
  "guestCookieToken": "a3b2c1d0-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200 OK):** Same structure as create.

**Response (401 Unauthorized):**
```json
{
  "error": "SESSION_EXPIRED_OR_NOT_FOUND",
  "message": "Guest session expired or not found. Please create a new session."
}
```

**Response (400 Bad Request):**
```json
{
  "error": "MISSING_COOKIE_TOKEN",
  "message": "guestCookieToken is required"
}
```


## JWT Token Structure

### Access Token Claims
| Claim | Description |
|-------|-------------|
| `sub` | User UUID |
| `username` | Guest username (e.g., `guest_550e8400`) |
| `role` | Always `PLAYER` for guests |
| `type` | `access` |
| `iat` | Issued at timestamp |
| `exp` | Expiration (30 minutes default) |
| `jti` | Unique token ID |

### Refresh Token Claims
| Claim | Description |
|-------|-------------|
| `sub` | User UUID |
| `type` | `refresh` |
| `iat` | Issued at timestamp |
| `exp` | Expiration (7 days default) |
| `jti` | Unique token ID |


## Database Usage

Uses the existing schema from V0.10.1 migration:

### `users` table — Guest user record
| Column | Value |
|--------|-------|
| `uuid` | Auto-generated UUID |
| `username` | `guest_` + first 8 chars of UUID |
| `state` | `6` (guest) |
| `role` | `PLAYER` |
| `guest_cookie_token` | UUID for session resumption |
| `guest_expires_at` | NOW + 30 days |

### `users_tokens` table — Refresh token storage
| Column | Value |
|--------|-------|
| `id_user` | FK to users.id |
| `refresh_token` | JWT refresh token string |
| `expires_at` | Token expiration timestamp |


## Configuration

Properties in `application.yml`:

```yaml
game:
  auth:
    jwt:
      secret: ${JWT_SECRET:PathsGamesDevSecret2026_MustBeAtLeast32Chars!}
      access-token-minutes: 30
      refresh-token-days: 7
    cors:
      allowed-origins: http://localhost:3000
```

> ⚠️ In production, always set `JWT_SECRET` as an environment variable with a strong random key.


## Files Created / Modified

### New files
| Module | File | Purpose |
|--------|------|---------|
| core | `model/GuestSession.java` | Domain model with builder pattern |
| core | `port/in/GuestAuthPort.java` | Inbound port interface |
| core | `port/out/GuestPersistencePort.java` | Outbound port for DB operations |
| core | `port/out/JwtPort.java` | Outbound port for JWT operations |
| core | `service/GuestAuthService.java` | Domain service (pure Java, no Spring) |
| adapter-auth | `jwt/JwtTokenProvider.java` | JWT adapter using JJWT library |
| adapter-auth | `persistence/GuestPersistenceAdapter.java` | DB adapter using JdbcTemplate |
| adapter-auth | `scheduler/GuestSessionCleanupScheduler.java` | Scheduled cleanup task |
| adapter-rest | `controller/GuestAuthController.java` | REST endpoints |
| adapter-rest | `dto/GuestLoginResponse.java` | Response DTO |
| adapter-rest | `dto/GuestResumeRequest.java` | Request DTO |
| ms-launcher | `config/WebConfig.java` | CORS configuration |

### Modified files
| File | Change |
|------|--------|
| `adapter-auth/pom.xml` | Added JJWT, Spring JDBC, Spring Boot dependencies |
| `ms-launcher/pom.xml` | Added `adapter-auth` dependency |
| `ms-launcher/config/CoreConfig.java` | Added `@EnableScheduling`, `GuestAuthPort` bean |
| `application.yml` | Added `game.auth.jwt.*` properties |
| `application-dev.yml` | Added CORS allowed origins |
| `application-prod.yml` | Added CORS allowed origins |


## Tests

| Module | Test Class | Tests | Description |
|--------|-----------|-------|-------------|
| core | `GuestAuthServiceTest` | 12 | Full domain service coverage with fake adapters |
| adapter-rest | `GuestAuthControllerTest` | 6 | MockMvc-based endpoint tests |

All **28 tests** pass (18 core + 10 adapter-rest).


## Frontend Concept (v0.12.0)

A standalone JavaScript frontend demo is available at:
`code/website/concepts_v0/v0.12.0/`

Features:
- Guest login button → calls `POST /api/v1/auth/guest`
- Session view with tokens, UUID, expiration times
- Resume session → calls `POST /api/v1/auth/guest/resume`
- Logout (clears localStorage)
- Server status indicator (calls `/api/echo/status`)
- Medieval theme consistent with the project's design language


## Version Control
- First version created with AI prompts:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step 12: write backennd code into code/backend project and create a simple web example inside new code/website/concepts_v0/v0.12.0/ folder  

    > i wanna to use jpa and don't use jdbc  

    > now create the admin sections: admin backend code to manage all guest users and v0.12.0-admin example pages  

- **Document Version**: 0.12.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.12.0 | Step 12: Implement guest login method | March 27, 2026 |
- **Last Updated**: March 27, 2026
- **Status**: ✅ Complete



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
