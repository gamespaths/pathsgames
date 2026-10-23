# Step 4 — Google SSO: react-game login

**Status: developed in 1.2.0 (October 20, 2026) — unit tests green, Robot suites written and not yet run, docs aligned.**
Roadmap line: *sign-in button and session handling* ([Roadmap](./Roadmap.md) step 4).
**Steps 2-5 are developed together** (intermediate releases get intermediate versions):
[Step 2](./Step02_GoogleSsoIdentityModel.md) · [Step 3](./Step03_GoogleSsoBackendFlow.md) ·
[Step 4](./Step04_GoogleSsoReactGameLogin.md) · [Step 5](./Step05_GoogleSsoPrivacyE2E.md).

## 1. Goal

A player signs in with Google from react-game; the current guest is linked to the Google user so
no progress is lost.

## 2. Decisions (owner, October 19, 2026)

Superseded in 1.7.0: the merge rule below (1.2.0 design, latest `ts_update` wins) by [Step 9](./Step09_MatchListCancelledLastPlayed.md): the Google user's active match always wins.

- Boot is unchanged: `GuestUserContext` creates or resumes a guest. The player then signs in with Google and the **current guest is LINKED to the Google user at login**.
- If that Google user already had another guest linked, the two guests are **merged**, from the first to the second, with the merge rules of [Step 3](./Step03_GoogleSsoBackendFlow.md) (moved from roadmap step 8): on the same story (1.2.0 rule, replaced in 1.7.0) the STARTED match with the latest `gaming_match.ts_update` won and the others became `CANCELLED`; ended and completed matches are all kept.
- Google logout: resume the previous guest if its cookie exists; otherwise show the home and create a guest only at the first "Play".
- GIS button in **popup mode**, no One Tap, no callback page. The GIS script is loaded **only when the player clicks "Sign in"**. Privacy, age and cookies: see the last point of [Step 5](./Step05_GoogleSsoPrivacyE2E.md).
- Button in `GuestUserModal` and in the header; GIS theme `filled_black`, shape `pill`; the nickname replaces `guest_xxx`.
- Login, error and consent strings in EN and IT with the existing react-game i18n (`src/i18n/context.jsx`); step 15 migrates to react-i18next.

## 3. Sub-points per component

### 3.1 react-game
- `GuestUserContext.jsx`: session state guest vs Google, `loginWithGoogle()`, `logout()` with guest resume, nonce generation in sessionStorage, client id from `GET /api/echo/status`.
- New `api/auth.js` call `POST /api/auth/google` `{idToken, nonce}`; the request carries the current guest session so the backend links it (see 3.2).
- Error messages EN/IT for `EMAIL_NOT_VERIFIED`, `EMAIL_DOMAIN_NOT_ALLOWED` ("we accept only Gmail accounts"), `IDENTITY_MISMATCH` ("contact support"), `SESSION_REVOKED`, `ACCOUNT_DELETION_IN_PROGRESS`.
- GIS loader (on click), button component, header entry, `GuestUserModal.jsx` shows the nickname and the button; error and cancel flows (popup closed, token refused, provider down).
- Privacy, age and cookies: see the last point of [Step 5](./Step05_GoogleSsoPrivacyE2E.md).
- EN/IT strings in the existing i18n files.
- Navbar: the Google profile picture (`pictureUrl`) top-right instead of the user icon: round 32px, opens the `GuestUserModal` as today; on load error it falls back to the current icon; guests keep the icon. The user card in `GuestUserModal` shows `displayName` instead of the username. CSP for Google (script, frame, img, connect) is in the website Terraform: see the release checklist of [Step 3](./Step03_GoogleSsoBackendFlow.md).
- Default language of a new Google user: guest preference (localStorage) > Google `locale` > browser language.
- The Sign in button is hidden when `GET /api/echo/status` reports `google-enabled` false (guests keep playing).
- **First 401 after the release** (old tokens without `iss`/`aud`): try a refresh, then the guest resume; a Google user is asked to sign in once more.
- Account deletion has **no UI in steps 2-5**: the button lives only in roadmap step 7; `DELETE /api/auth/me` of step 5 is reachable by API only until then.
- **Single refresher**: only one tab refreshes the access token (`navigator.locks` or `BroadcastChannel`); the other tabs wait and reuse the result (the same channel announces login and logout to the other tabs; backend grace of 30 s in [Step 3](./Step03_GoogleSsoBackendFlow.md)).
- `SESSION_REVOKED` on refresh: message "session closed from another device", then back to guest/home.
- `GuestUserModal` shows a line "sign in to keep your progress" for guests.
- Match list shows a plain "Cancelled" label for `CANCELLED` (OpenAPI enum added in steps 2-5); roadmap step 9 keeps the styling and the last-played date.
- Language and high contrast: when logged in the profile wins and localStorage is only a cache. The guest values stay in localStorage and are copied into the profile by roadmap step 7; until then the device keeps using localStorage.

### 3.2 Backends
The login endpoint of step 3 accepts the guest session (access token/guest cookie) and calls the linking/merge. The merge itself (including the `CANCELLED` status) is in [Step 3](./Step03_GoogleSsoBackendFlow.md). Frontend side: cancelled matches in the match list belong to roadmap step 9; the "Keep your guest progress" prompt is removed (linking is automatic).

### 3.3 Tests
Vitest for the context (guest → Google, merge response, logout with and without guest cookie), loader (not loaded before the click), button, error flows; coverage > 96%.

### 3.4 Docs
Privacy, age and cookies: see step 5 last point.

## 4. Open points

Multi-device rule: each device's guest merges into the Google account at the first login on that device; a device never logged in stays a separate guest.

1. (decided) Several tabs: the same `BroadcastChannel` used for the refresh tells the other tabs about login and logout; they reload the session.
2. Google logout when the previous guest was already merged (its cookie is invalid): falls back to "create at first Play".


# Version Control
- **Document Version**: 1.2.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.2.0 | Google login analysis, steps two to five | October 19, 2026 |

- **Last Updated**: October 19, 2026 (v1.2.0)

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
