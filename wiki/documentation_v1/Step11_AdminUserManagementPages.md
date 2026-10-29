# Step 11 — Admin tool: user management pages

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/11_admin_user_pages` green on Java, Python and AWS (1.10.0 run). Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *the react-admin side* ([Roadmap](./Roadmap.md) step 11). Backend: [Step 10](./Step10_AdminUserManagementBackend.md).

## 1. Goal

The admin finds users, reads a user's profile and match history and runs ban, suspend, unblock and mismatch actions from react-admin, always with a reason.

## 2. Decisions (owner, October 21, 2026)

- As in the roadmap: users list with search, filters and pagination; user detail page with match history and actions; confirmation dialogs with a reason field; unit tests; Robot checks.
- The suspend dialog has the `until` date and the reason ([Step 10](./Step10_AdminUserManagementBackend.md): mandatory, at most 90 days).
- **Reasons:** one of the standard reasons (spam, abuse, cheating, security, support request, other) plus mandatory free text of 10 to 500 characters (the UI warns "no personal data").
- **Search:** one box; a value with "@" is an exact email search, anything else is a nickname prefix.
- **Email** is shown only in the detail page, never in the list.

## 3. Sub-points per component

### 3.1 react-admin (`code/frontend/react-admin/`)
- `api/userApi.js` (exists with `getAdminUser`): add `listAdminUsers({limit, cursor, email, nickname, state})`, `banUser`, `suspendUser`, `unblockUser`, `relinkSubject`.
- `pages/UsersPage.jsx` (route `/users`, entry in the sidebar; the section layout of roadmap step 13 comes later): table like `MatchesPage` (cursor and a load-more button; `GuestsPage` is the other paged list), the single search box (an "@" sends `email`, else `nickname`), filter by state (default active users), no email column.
- `pages/UserDetailPage.jsx` (route `/users/:uuid`): profile with the email, identities, state with `suspendedUntil`, statistics, number of sessions; match history from the existing `GET /api/admin/matches?userUuid=` with the same cursor paging and a link to the match detail page; `BANNED` and `CANCELLED` matches shown with their status (add `BANNED` to the status lists of `MatchesPage.jsx` and `matchDetailShared.jsx`).
- Actions by state (ban and suspend only for Google users and never for an ADMIN, unblock for blocked and banned users): a reason dialog built on the `ConfirmModal` pattern with a select of the six standard reasons and a mandatory free-text field of 10 to 500 characters (the current component has no input); the suspend dialog adds a date picker limited to today plus 90 days; the `IDENTITY_MISMATCH` panel with "arm re-link of the Google subject" and "delete the old user".
- Error handling for the codes of step 10 (`GUEST_NOT_BANNABLE`, `ADMIN_NOT_BANNABLE`, `SUSPEND_UNTIL_INVALID`, `INVALID_STATE_TRANSITION`); react-admin stays in English only.

### 3.2 Backends
- None; the endpoints are in [Step 10](./Step10_AdminUserManagementBackend.md).

### 3.3 Tests
- Vitest (coverage > 96%): list, search routing ("@" or not), cursor, detail with email, each dialog (reason length, date limit), action refresh, error codes, `BANNED` status shown.
- Robot checks: there is no browser suite, so they are API-level checks of the exact calls the pages make (filter combinations, cursor, action errors); the page behaviour is covered by Vitest.

### 3.4 Docs (when developed)
- react-admin README (new pages).

## 4. Open points

1. (decided) The suspend dialog carries `until` and the reason.
2. (decided) Standard reasons list plus mandatory free text, 10 to 500 characters.
3. (decided) One search box: "@" means exact email, else nickname prefix. A nickname never contains "@" (it is the email local part, `+tag` removed), so the rule is unambiguous.
4. (decided) The email appears only in the detail page.
5. (decided) Standard reasons: spam, abuse, cheating, security, support request, other; the free text is mandatory (10 to 500 characters). The list is a react-admin constant; the backend stores the final text only.

## Implementation notes (1.7.0)

- react-admin: `UsersPage.jsx` (route `/users`, one search box: "@" = exact email, else nickname prefix; state filter; cursor paging; no email column) and `UserDetailPage.jsx` (route `/users/:uuid`: profile with the email, identities, statistics, sessions, match history, actions ban, suspend, unblock, re-link, deletion). Sidebar section "Users".
- `components/user/ReasonModal.jsx` (standard reason plus free text, 10-500 characters, composed as "<label>: <text>"; suspend adds the `until` date, max 90 days), `UserPicker.jsx`, `UserStateBadge.jsx`; constants in `constants/userAdmin.js`.
- `api/client.js` now keeps the API error code and HTTP status on the rejected error (`err.code`, `err.status`) so dialogs show the step 10 codes.

# Version Control
- **Document Version**: 1.11.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Admin user pages analysed | October 21, 2026 |
  | 1.7.0 | Developed and released | October 23, 2026 |
  | 1.11.0 | Status updated: automatic tests run and green | October 29, 2026 |

- **Last Updated**: October 29, 2026 (v1.11.0)


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
