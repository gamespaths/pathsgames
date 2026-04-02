# Paths Games — Concept v0.13.0
## Session & Token Management Demo — HttpOnly Cookie Edition

This is a standalone browser demo for **Step 13** of the Paths Games backend —
session and token management with **JWT token rotation**, single/all-device logout,
and **persistent guest session resumption**.

### Security model — HttpOnly cookies

The **refreshToken** and **guestCookieToken** are transported as **HttpOnly cookies**
set by the server. JavaScript **cannot** read, modify, or delete them — the browser
sends them automatically on every request to `/api/auth/**` and the server
manages their lifecycle (creation, rotation, expiry, deletion on logout).

Only the short-lived **accessToken** (30 min) is kept in JavaScript memory /
`localStorage` so it can be attached as a `Bearer` header to protected endpoints.

> This eliminates the *XSS blast radius* for long-lived credentials: even if an
> attacker injects script into the page, they can steal only the access token
> (which expires in 30 minutes) but **never** the refresh or guest-cookie token.

---

## How the Session Persistence Works

### Cookie Details

The backend sets two HttpOnly cookies on successful auth operations:

| Cookie name | Value | HttpOnly | Secure | SameSite | Path | Max-Age |
|-------------|-------|----------|--------|----------|------|---------|
| `pathsgames.refreshToken` | JWT (7-day) | ✅ | `false` (dev) / `true` (prod) | `Lax` | `/api/auth` | 7 days |
| `pathsgames.guestcookie` | UUID (opaque) | ✅ | `false` (dev) / `true` (prod) | `Lax` | `/api/auth` | 30 days |

- **`Path=/api/auth`** — cookies are only sent for auth-related API calls, not for
  every request to the server.
- **`SameSite=Lax`** — cookies are sent on top-level navigations and same-origin
  requests, preventing CSRF from third-party sites.
- **`Secure=false`** in dev mode so `http://localhost` works; must be `true` in
  production (HTTPS only).

### Resumption Flow (step by step)

```
Browser opens / page loads
        │
        ▼
Is there a valid session in localStorage?
    ├── YES → restore accessToken, show session view
    └── NO  ─────────────────────────────────────────────┐
                                                         ▼
                                                POST /api/auth/guest/resume
                                                credentials: 'include'
                                                (browser sends HttpOnly cookie
                                                 automatically — no JS body)
                                                         │
                                         ┌────────────── ┤
                                         │               │
                                     200 OK          401 / no cookie
                                         │               │
                                  new accessToken    show login screen
                                  server rotates     (user creates new session)
                                  HttpOnly cookies
                                  save to localStorage
                                  show session view
```

### What Gets Saved Where

| Data | Storage | Managed by | Lifetime |
|------|---------|-----------|----------|
| `accessToken` (JWT) | `localStorage` + JS memory | **Frontend** | 30 minutes |
| `refreshToken` (JWT) | **HttpOnly cookie** | **Server** | 7 days |
| `guestCookieToken` (UUID) | **HttpOnly cookie** | **Server** | 30 days |
| Session metadata (uuid, username, expiry) | `localStorage` key `paths_session_v013` | **Frontend** | Until cleared |

> **Note:** In private/incognito mode, `localStorage` is cleared when the browser
> closes, but the HttpOnly cookies may also be cleared depending on the browser.
> The `SameSite=Lax` policy prevents cross-site cookie sending.

### On Logout

The server response to `/api/auth/logout` and `/api/auth/logout/all` includes
`Set-Cookie` headers that set both cookies to empty values with `Max-Age=0`,
effectively deleting them from the browser.

The frontend also clears the `paths_session_v013` key from `localStorage`.

This ensures the user cannot silently resume an intentionally terminated session.

### What Changed from the Previous (pre-HttpOnly) Version

| Before (body-based) | After (HttpOnly cookies) |
|---------------------|--------------------------|
| `refreshToken` returned in JSON body | `refreshToken` set as HttpOnly cookie by server |
| `guestCookieToken` returned in JSON body, saved as JS-accessible cookie | `guestCookieToken` set as HttpOnly cookie by server |
| `POST /api/auth/refresh` sends `{ refreshToken: "..." }` in body | `POST /api/auth/refresh` sends no body — cookie is automatic |
| `POST /api/auth/guest/resume` sends `{ guestCookieToken: "..." }` in body | `POST /api/auth/guest/resume` sends no body — cookie is automatic |
| `POST /api/auth/logout` sends `{ refreshToken: "..." }` in body | `POST /api/auth/logout` sends no body — cookie is automatic |
| JS cookie helpers (`setCookie`/`getCookie`/`deleteCookie`) needed | No JS cookie helpers — server manages everything |
| XSS can steal refreshToken from localStorage/memory | XSS **cannot** access refreshToken (HttpOnly) |

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page — login card + session panel |
| `session-manager.js` | All JS logic: guest login, token refresh, resume, logout (HttpOnly edition) |
| `style.css` | Styles for the demo page |
| `variables.css` | CSS custom properties (design tokens) |
| `README.md` | This file |

---

## API Endpoints Used

All `fetch()` calls use **`credentials: 'include'`** so the browser automatically
sends and receives HttpOnly cookies.

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/auth/guest` | — | — | Create guest session (sets cookies) |
| `POST` | `/api/auth/guest/resume` | — | — | Resume session via HttpOnly cookie |
| `POST` | `/api/auth/refresh` | — | — | Rotate tokens via HttpOnly cookie |
| `GET`  | `/api/auth/me` | Bearer | — | Get current user info |
| `POST` | `/api/auth/logout` | Bearer | — | Revoke refresh token (clears cookies) |
| `POST` | `/api/auth/logout/all` | Bearer | — | Revoke all sessions (clears cookies) |
| `GET`  | `/api/admin/guests` | Bearer (ADMIN) | — | Admin: list guests (403 for guests) |
| `GET`  | `/api/echo/status` | — | — | Server health check |

### Response JSON (guest login / resume / refresh)

```json
{
  "userUuid": "...",
  "username": "guest_abc123",
  "accessToken": "<JWT>",
  "accessTokenExpiresAt": 1719000000000,
  "refreshTokenExpiresAt": 1719500000000
}
```

> **Note:** `refreshToken` and `guestCookieToken` are **not** in the JSON body —
> they are in `Set-Cookie` response headers (HttpOnly).

---

## Backend Changes (CookieHelper)

A new utility class `CookieHelper` in `adapter-rest` manages all cookie operations:

```
games.paths.adapters.rest.cookie.CookieHelper
```

Key constants:
- `REFRESH_TOKEN_COOKIE = "pathsgames.refreshToken"`
- `GUEST_COOKIE_TOKEN = "pathsgames.guestcookie"`
- `COOKIE_PATH = "/api/auth"`

The `application.yml` now includes:

```yaml
game:
  auth:
    cookie:
      secure: false      # set to true in production
      same-site: Lax
```

---

## Running the Demo

Start the Java backend:

```bash
cd code/backend
mvn spring-boot:run
# Server starts on http://localhost:8042
```

Then open `index.html` directly in a browser (via `file://`) or through a local
HTTP server. The dev CORS config already allows `"null"` origins for `file://` access
and has `allowCredentials: true` for cookie support.

> **Important:** `credentials: 'include'` requires the server's CORS config to
> specify explicit allowed origins (not `*`) and `allowCredentials: true`.
> The backend's `WebConfig.java` is already configured for this.

---

## Related Documentation

- [Step 12 — Guest Login Method](../../../documentation_v0/Step12_GuestLoginMethod.md)
- [Step 13 — Session & Token Management](../../../documentation_v0/Step13_SessionTokenManagement.md)
- [OpenAPI — Guest Auth API](../../backend/adapter-rest/src/main/resources/openapi/v0.12.0-guest-auth-api.yaml)
- [OpenAPI — Session API](../../backend/adapter-rest/src/main/resources/openapi/v0.13.0-session-api.yaml)
