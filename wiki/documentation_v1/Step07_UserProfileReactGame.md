# Step 7 — User profile: react-game page

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/07_user_profile_page` written, not yet run. Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *profile page in the user's book* ([Roadmap](./Roadmap.md) step 7).
Multi-device chain (same Google account, same game state on every device): [Step 6](./Step06_UserProfileBackend.md) · [Step 7](./Step07_UserProfileReactGame.md) · [Step 8](./Step08_MatchConcurrencyMultiDevice.md) · [Step 9](./Step09_MatchListCancelledLastPlayed.md) · [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md).

## 1. Goal

From the user's book a player sees who they are and their statistics, edits the preferences, and a Google user can log out of all devices and delete the account.

## 2. Decisions (owner, October 21, 2026)

Superseded in 1.8.0: the "profile page" below was replaced by a stats card in the user book, see "Changes (1.8.0)" below.

- Page content as in the roadmap: user info and statistics (including play time and clocks of [Step 6](./Step06_UserProfileBackend.md)); preferences editor; links to the privacy pages; responsive book layout; unit tests.
- Guest values kept in localStorage are copied into the profile at the first Google login; when logged in the profile wins and localStorage is only a cache.
- **Guests** get the same profile page with their statistics and an invitation to sign in. For guests there is NO "Log out of all devices" and NO account deletion. Guest preferences stay in localStorage only (roadmap steps 15 and 17): `PATCH /me` refuses guests with 403 `GOOGLE_ACCOUNT_REQUIRED` ([Step 6](./Step06_UserProfileBackend.md)).
- **High contrast:** the toggle stays hidden until step 17; the API (`PATCH /me`) and the localStorage key `pathsgames.highContrast` are ready in this step. Roadmap step 17 gets a sub-point "show the high-contrast toggle prepared in step 7".
- **First-login copy:** `PATCH /me` right after the login when `newUser` is true; the login contract is unchanged (the language already travels in the login body).
- **Page-return hook** created here with code constants; it re-reads `GET /api/auth/me` when the page becomes visible again. [Step 8](./Step08_MatchConcurrencyMultiDevice.md) adds the backend parameters and reuses the hook for the match.
- **Account deletion:** the full UI is in this step, confirmed with a freshly issued Google token (younger than 5 minutes).
- A language changed on another device is applied live when `/me` is re-read, never while a request is in flight.

## 3. Sub-points per component

### 3.1 react-game (`code/frontend/react-game/`)

Superseded in 1.8.0: the profile page, its button and the profile-page logout/deletion buttons; see "Changes (1.8.0)" below.
- `api/auth.js`: add `updateMe` (`PATCH /api/auth/me` with `X-CSRF-TOKEN`), `logoutAll`, `deleteMe` (`DELETE /api/auth/me` with `{idToken, nonce}`); `getMe` exists.
- Profile in the user's book (beside `features/guest-user/UserAccountPanel.jsx`): nickname, display name, picture, account type; statistics (played, completed, game over, play time as hours and minutes, clocks). A guest sees the same statistics and a "Sign in with Google" invitation.
- Preferences editor: language (reuse `UserLanguageSelector.jsx`; the options are the `supportedLanguages` of `GET /api/echo/status` that also have a translation bundle; Google user: `PATCH`, then the i18n context and the `pathsgames.lang` cache; guest: localStorage only, no call). The high-contrast control is not rendered; the `PATCH` field and the `pathsgames.highContrast` key are wired and unit tested.
- First Google login (`newUser: true`): one `PATCH /me` with the device values of `pathsgames.lang` and `pathsgames.highContrast`. An existing Google user keeps its profile: the device values are overwritten by the profile.
- "Log out of all devices" (Google users only): confirmation, `POST /api/auth/logout/all`, local logout, notice to the other tabs through the session channel (`auth/sessionSync.js`), then the same flow as a normal logout. [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md) adds the number of active sessions next to the button.
- Account deletion flow (Google users only; the only deletion UI, see [Step 5](./Step05_GoogleSsoPrivacyE2E.md)): text on what is deleted, a fresh Google popup (reuse of the GIS loader and the nonce), `DELETE /api/auth/me`, 202, logout and a closing message; errors `FRESH_TOKEN_REQUIRED` and provider errors.
- Links to the static pages `privacy.html`, `terms.html`, `cookies.html` (built by [Step 2](./Step02_GoogleSsoIdentityModel.md)).
- Page-return hook `usePageReturn` (events `visibilitychange` to visible, `pageshow` with `persisted`, `online`) re-reads `/me`, with code constants; a changed language is applied only when no request is in flight.
- Layout: the existing book components, two pages on desktop and one on mobile; EN and IT strings in the current i18n files.

### 3.2 Backends
- None.

### 3.3 Tests
- Vitest: page for guest and Google user (guest without logout-all and deletion), statistics formatting, `PATCH` flows, profile wins over localStorage, first-login copy only when `newUser`, logout all, deletion flow with a mocked fresh popup, hook triggers, live language change; coverage > 96%.

### 3.4 Docs (when developed)
- [Security](../Security.md) (deletion UI and fresh token), the react-game README.

## 4. Open points

1. (decided) Page content, profile wins, re-read on page return.
2. (decided) High-contrast toggle hidden until step 17; key `pathsgames.highContrast`; sub-point added to roadmap step 17.
3. (decided) First-login copy through `PATCH /me` when `newUser` is true.
4. (decided) Hook created here with code constants; backend parameters come in step 8.
5. (decided) Guests: same page, statistics, invitation; no logout-all, no deletion.
6. (decided) Full deletion UI here, confirmed with a freshly issued Google token.
7. (decided) Language changed elsewhere is applied live when `/me` is re-read, never during a request.
8. (decided) `PATCH /me` refuses guests with 403 `GOOGLE_ACCOUNT_REQUIRED`; guest preferences live only in localStorage.
9. (decided) The language list comes from `supportedLanguages` of the echo status, filtered by the bundles react-game really has.

## Implementation notes (1.7.0)

Superseded in 1.8.0: the profile page and its buttons (see "Changes (1.8.0)" below).

- Page `UserProfilePage.jsx` (statistics, preferences editor, "Log out of all devices", account deletion with a freshly issued Google token, both behind a confirmation); `UserLanguageSelector` lists only languages that have a bundle (`i18n/bundles.js`).
- `auth/devicePreferences.js` keeps the device values in localStorage; guests use them alone, after the first Google login (`newUser`) one `PATCH /me` copies them; for an existing Google user the profile language overrides the device language.
- The high-contrast toggle is not shown (its API and the `pathsgames.highContrast` key are ready). `hooks/usePageReturn.js` re-reads the profile when the page becomes visible again (reused by step 8).
- Texts in `en.json` / `it.json` (`profile.*`).

## Changes (1.8.0)

- **Profile page removed** (supersedes the page of the 1.7.0 notes above): `UserProfilePage.jsx` and the "My profile" button are gone. The right page of the user book opens with `UserStatsCard.jsx`, the first card of the matches grid in `UserMatchesList.jsx`: user name and 4 badges Matches / Complete / Gameover / Time, read from `GET /api/auth/me` at every open. The text "No matches yet. Start an adventure!" is gone; the language selector stays on the left card; the policy links stay in the footer only.
- **Play time format** (`utils/profileStats.js` `formatPlayTime`): under 1 hour "X mins", under 24 hours "X H", otherwise "Z days" (IT "X min" / "X H" / "Z giorni"); keys `profile.stats.playTimeMinutes/Hours/Days` replace `playTimeValue`.
- **Logout menu** (`UserAccountPanel.jsx`, `LogoutMenu`): for a Google user the "Log out" button hides and 3 centred buttons appear: log out of this device, log out of all devices (confirmation), delete my account (confirmation with a fresh Google popup). The active-sessions count and profile errors show there; after a deletion the left card shows the closing message.

# Version Control
- **Document Version**: 1.8.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Profile page analysed | October 21, 2026 |
  | 1.7.0 | Developed and released | October 23, 2026 |
  | 1.8.0 | Profile page replaced by a small card | October 23, 2026 |

- **Last Updated**: October 23, 2026 (v1.8.0)


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
