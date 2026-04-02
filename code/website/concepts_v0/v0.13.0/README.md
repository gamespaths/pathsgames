# Paths Games — Concept v0.13.0
## Session & Token Management Demo

This is a standalone browser demo for **Step 13** of the Paths Games backend —
session and token management with **JWT token rotation**, single/all-device logout,
and **persistent guest session resumption via cookie**.

---

## How the Session Persistence Works

### The Problem

JWT access tokens are short-lived (30 minutes by default).  
Refresh tokens are longer-lived (7 days), but they are stored in `localStorage`,  
which is **cleared when the user closes the browser tab** in some environments,  
or simply lost if the user opens the page in a new tab.

### The Solution — `pathsgames.guestcookie`

When a guest session is created (or refreshed), the backend returns a
`guestCookieToken` — a separate, long-lived UUID stored in the `users` table
alongside the user record. This token is **not a JWT** and has no cryptographic
claims; it is simply an opaque resumption key.

The frontend saves it as a browser cookie named **`pathsgames.guestcookie`**:

```
pathsgames.guestcookie=<uuid>; expires=<30 days>; path=/; SameSite=Lax
```

Cookies **survive the browser being closed**, so this token is still available
the next time the user opens the page.

### Resumption Flow (step by step)

```
Browser opens / page loads
        │
        ▼
Is there a valid session in localStorage?
    ├── YES → restore tokens directly, show session view
    └── NO  ─────────────────────────────────────────────┐
                                                         ▼
                              Does cookie 'pathsgames.guestcookie' exist?
                                  ├── NO  → show login screen (new session)
                                  └── YES ───────────────┐
                                                         ▼
                                                POST /api/auth/guest/resume
                                                { guestCookieToken: "<uuid>" }
                                                         │
                                         ┌────────────── ┤
                                         │               │
                                     200 OK             401/expired
                                         │               │
                                  new JWT pair          delete cookie
                                  save to localStorage  show login screen
                                  refresh cookie expiry
                                  show session view
```

### What Gets Saved Where

| Data | Storage | Lifetime |
|------|---------|----------|
| `accessToken` (JWT) | `localStorage` only | 30 minutes |
| `refreshToken` (JWT) | `localStorage` only | 7 days |
| `guestCookieToken` (UUID) | **`pathsgames.guestcookie`** cookie | 30 days |
| Full session JSON | `localStorage` key `paths_session_v013` | Until cleared or browser data wiped |

> **Note:** `localStorage` is typically cleared when the user closes the browser
> in private/incognito mode. The cookie is still set but `SameSite=Lax` prevents
> it from being sent cross-site.

### On Logout

Both `clearSession()` calls (single logout and logout-all) remove:
- The `paths_session_v013` key from `localStorage`
- The `pathsgames.guestcookie` browser cookie

This ensures the user cannot silently resume an intentionally terminated session.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page — login card + session panel |
| `session-manager.js` | All JS logic: guest login, token refresh, resume, logout |
| `style.css` | Styles for the demo page |
| `variables.css` | CSS custom properties (design tokens) |
| `README.md` | This file |

---

## API Endpoints Used

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/guest` | — | Create a new guest session |
| `POST` | `/api/auth/guest/resume` | — | Resume session via cookie token |
| `POST` | `/api/auth/refresh` | — | Rotate tokens (old pair revoked) |
| `GET`  | `/api/auth/me` | Bearer | Get current user info |
| `POST` | `/api/auth/logout` | Bearer | Revoke a single refresh token |
| `POST` | `/api/auth/logout/all` | Bearer | Revoke all sessions for user |
| `GET`  | `/api/admin/guests` | Bearer (ADMIN) | Admin: list guests (403 for guests) |
| `GET`  | `/api/echo/status` | — | Server health check |

---

## Running the Demo

Start the Java backend:

```bash
cd code/backend
mvn spring-boot:run
# Server starts on http://localhost:8042
```

Then open `index.html` directly in a browser (via `file://`) or through a local
HTTP server. The dev CORS config already allows `"null"` origins for `file://` access.

---

## Related Documentation

- [Step 12 — Guest Login Method](../../../documentation_v0/Step12_GuestLoginMethod.md)
- [Step 13 — Session & Token Management](../../../documentation_v0/Step13_SessionTokenManagement.md)
- [OpenAPI — Guest Auth API](../../backend/adapter-rest/src/main/resources/openapi/v0.12.0-guest-auth-api.yaml)
- [OpenAPI — Session API](../../backend/adapter-rest/src/main/resources/openapi/v0.13.0-session-api.yaml)


---

- Come lo abbiamo gestito nel progetto nel `session-manager.js` / `index.html`. Scelta pratica per concept demo:
    - JWT (accessToken, refreshToken) sono salvati in localStorage (usati dalle chiamate fetch con Authorization: Bearer ...) — facilita demo e controllo JS.
    - Il campo guestCookieToken (UUID di resumption) viene salvato anche come cookie chiamato pathsgames.guestcookie (persistente 30 giorni). Questo permette il resume automatico quando l'utente riapre il browser.
- Motivo della scelta: vogliamo che la sessione guest sopravviva alla chiusura del browser senza richiesta di login; il cookie fornisce il "collegamento" al record DB. I JWT restano in localStorage per essere inviati dal codice frontend alle API.
    - Cosa succede al logout / scadenza:
        - clearSession() elimina sia il localStorage che il cookie pathsgames.guestcookie — impedisce resume.
    - Se la cookie esiste ma il server ha già scaduto o rimosso la sessione, la chiamata POST /api/auth/guest/resume ritorna 401 → frontend elimina il cookie e richiede nuova sessione.
- Mitigazioni:
    - Token rotation (Step 13): quando si usa refresh si revocano i token precedenti — riduce rischio da token rubati.
    - Non usare cookie HttpOnly per guestCookieToken nella demo perché il client deve leggerlo per mostrare lo stato; in produzione si potrebbe rendere la meccanica più sicura spostando più logica lato server (es. usare cookie HttpOnly per refresh).
- Se vuoi, posso:
    - Cambiare il design per usare cookie HttpOnly (richiede adattamenti backend: leggere cookie sul server e restituire user info senza che JS legga il cookie);
    - Spostare refreshToken in cookie HttpOnly e lasciare solo accessToken in memoria per ridurre XSS blast radius;
    - Aggiungere note nel README.md con le raccomandazioni di sicurezza per produzione.

--- 

procedi con 
- Cambiare il design per usare cookie HttpOnly (richiede adattamenti backend: leggere cookie sul server e restituire user info senza che JS legga il cookie);
- Spostare refreshToken in cookie HttpOnly e lasciare solo accessToken in memoria per ridurre XSS blast radius;
- Aggiungere note nel README.md con le raccomandazioni di sicurezza per produzione.