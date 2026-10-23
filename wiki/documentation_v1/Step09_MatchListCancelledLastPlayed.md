# Step 9 — Match list: cancelled matches, last played and merge rule

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/09_match_list` written, not yet run. Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *match list after the merge* ([Roadmap](./Roadmap.md) step 9).
Multi-device chain: [Step 6](./Step06_UserProfileBackend.md) · [Step 7](./Step07_UserProfileReactGame.md) · [Step 8](./Step08_MatchConcurrencyMultiDevice.md) · [Step 9](./Step09_MatchListCancelledLastPlayed.md) · [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md). "Last played" is reliable thanks to the stamp on every write of step 6.

## 1. Goal

When a guest signs in, the account's match always survives; the player's match list shows what is active, when each match was last played, and keeps cancelled matches out of the way, so a player coming back on any device finds the right match.

## 2. Decisions (owner, October 21, 2026)

Superseded in 1.8.0: the "last played" line and the "show cancelled" toggle below were removed (cancelled and banned matches are always listed), see "Changes (1.8.0)" below.

- As in the roadmap: styling of cancelled matches (a plain label already exists from steps 2-5); "last played" date from the match `ts_update`, returned by all backends, AWS included; Robot suite "guest plays, logs in, finds the merged matches"; unit tests.
- **Order:** active matches (`CREATED`, `RUNNING`, `PAUSED`) first, then by last played, sorted in memory. The list always uses the envelope `{items, nextCursor, limit}`, page size 50; `nextCursor` is `null` up to 50 matches; beyond 50 the cursor is a position in the in-memory sorted list and a shift between pages is accepted.
- **Cancelled matches** (and the `BANNED` ones of [Step 10](./Step10_AdminUserManagementBackend.md)) are hidden behind a "show cancelled" toggle and never physically deleted.
- The Google login answer adds `cancelledMatchUuids`; the list highlights those matches once.
- **Merge rule moved here from step 12:** the Google user's active match ALWAYS wins over the guest's match of the same story. Before Play a guest sees "Have an account? Sign in to continue". The `pathsgames.knownAccount` flag stays in [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md). [Game Rules](../GameRules.md) carries the rule from 1.7.0.

## 3. Sub-points per component

### 3.1 Java / Python / AWS
- Add `tsUpdate` (ISO-8601 UTC) to the match summary of `GET /api/matches` on the 3 backends. Today the summary has only `tsInsert`: Java `MatchSummary` and `MatchSummaryResponse`, Python `core/models/match/match_models.py` (the match dict already holds `ts_update`), AWS `_summary_from_item`. The same DTO is the `match` object of `/info` and of the admin list, so the field appears there too (harmless).
- Format: Java and Python store ISO strings, AWS stores epoch milliseconds: AWS converts to ISO in `_summary_from_item`, so the contract is one format. `matchVersion` of [Step 8](./Step08_MatchConcurrencyMultiDevice.md) stays opaque and separate. On AWS the list reads GSI1, which projects `tsUpdate`, `currentClock` and `playMs` next to the match `summary` map ([Step 6](./Step06_UserProfileBackend.md)).
- List: `GET /api/matches` answers the envelope `{items, nextCursor, limit}` of [API Conventions](../ApiConventions.md) section 6 instead of the plain array (the v0.28.1 admin list is the precedent); sorted in memory (active first, then `tsUpdate` descending); `limit` default 50, `nextCursor: null` up to 50, beyond 50 a position in the sorted list. Callers move to `items` in the same release: react-game `api/matches.js`, the Robot resources and suites that read the plain array. Release order: backend first, react-game deployed right after it, CloudFront invalidated as usual.
- Merge rule: `GuestMergeService.matchesToCancel` (Java), `guest_merge_service.py`, `sso.matches_to_cancel` (AWS) receive the two sides apart (the code already loads the target's and the guest's matches separately). Per story: if the Google user has an active match, every active guest match of that story becomes `CANCELLED`; otherwise the guest's active match survives. Ended and completed matches are all kept. Inside one side the latest `ts_update` stays only as an internal safety net (the duplicate guard of v0.32.1 already allows one active match per story and side).
- The merge is always one guest into a Google user (the login creates the Google user first, then merges), so there is no guest-to-guest case.
- The login answer (`POST /api/auth/google`) adds `cancelledMatchUuids`; `mergedGuest` and the count `cancelledMatches` stay.
- OpenAPI (the one file `v1.7.0-multi-device-api.yaml`): `tsUpdate` in `MatchSummary`, `cancelledMatchUuids`, the list envelope (breaking change of `GET /api/matches`).

### 3.2 react-game
- `api/matches.js` `listMatches` reads `items`. Match list (`features/guest-user/UserMatchesList.jsx`, `features/matches/MatchCard.jsx`, `MatchStatusBadge.jsx`, `utils/matchStatus.js`): active matches first, "last played" line with a relative time ("2 hours ago") from `tsUpdate`; `CANCELLED` (and `BANNED`) matches in a muted style with the existing label, hidden until the "show cancelled" toggle is on, never opened; a cancelled one explains "the match of your Google account for this story was kept".
- Matches named in `cancelledMatchUuids` of the last login are highlighted once.
- `features/start-match/StartMatchFlow.jsx`: for a guest with Google sign-in on, the hint "Have an account? Sign in to continue" before Play, next to the login card (EN and IT strings).
- Dates use the browser locale until step 16 formats dates and numbers by locale.

### 3.3 Tests
- Unit on the 3 backends: `tsUpdate` present and ISO and moving with a write; sort order; envelope with `nextCursor` null up to 50 and a cursor beyond 50; merge matrix (Google active vs guest active of the same story, no Google match, different stories, ended kept, a newer guest match still loses); `cancelledMatchUuids` content. Vitest for the card (relative time, toggle, cancelled style, no open on click, highlight once) and the hint. Coverage > 96%.
- Robot `tests_v1/09_match_list/`: a guest plays, signs in with the fake provider, finds the merged matches (kept, cancelled loser, `tsUpdate` set, `cancelledMatchUuids`); a guest match newer than the Google match still loses.

### 3.4 Docs (when developed)
- [Game Rules](../GameRules.md) already holds the rule (from 1.7.0). [Step 3](./Step03_GoogleSsoBackendFlow.md) and [Step 4](./Step04_GoogleSsoReactGameLogin.md) keep the 1.2.0 text, marked as superseded.

## 4. Open points

Superseded in 1.8.0: points 1 and 3 (last-played line, "show cancelled" toggle), see "Changes (1.8.0)" below.

1. (decided) Last played from `ts_update`, cancelled style, Robot suite as in the roadmap.
2. (decided) Order: active first, then last played, sorted in memory; always the envelope, page size 50, `nextCursor: null` up to 50, a shift between pages beyond 50 accepted.
3. (decided) Cancelled and banned matches behind a "show cancelled" toggle, never deleted.
4. (decided) The last-played value also moves with admin actions and restores ([Step 6](./Step06_UserProfileBackend.md)): accepted.
5. (decided) `cancelledMatchUuids` in the login answer, highlighted once.
6. (decided) Merge rule and the "Have an account?" hint moved here from step 12.
7. (decided) The envelope change of `GET /api/matches`: backend, react-game and Robot change in the same release; react-game is deployed right after the backend and CloudFront is invalidated as usual.

## Implementation notes (1.7.0)

- `GET /api/matches` is now the envelope `{items, nextCursor, limit}` (breaking change, page size 50, max 200): active matches first, then `tsUpdate` descending, sorted in memory (`MatchListOrder` / `match_list_order.py`; AWS `common/match_summary.py`). `MatchSummary.tsUpdate` is ISO-8601 UTC on all backends.
- Merge rule: the Google user's active match always wins, every active guest match of that story becomes `CANCELLED` (even a newer one); with no Google match the guest's survives. The Google login answer adds `cancelledMatchUuids`. [Game Rules](../GameRules.md) holds the rule; Steps 3 and 4 keep the 1.2.0 text marked as superseded.
- react-game: `MatchCard` last-played time and cancelled styling, "show cancelled" toggle (cancelled and banned hidden by default), just-cancelled matches highlighted once, hint "Have an account? Sign in to continue" before Play for guests.

## Changes (1.8.0)

- react-game (`MatchCard.jsx`, `UserMatchesList.jsx`): the "Last played ..." line is removed (the order is unchanged: active first, then last played); the "show cancelled" toggle is removed (supersedes the 1.7.0 notes above): `CANCELLED` and `BANNED` matches are always listed, in full colour, still never opened, with the cancelled note.
- The list now starts with the user statistics card ([Step 7](./Step07_UserProfileReactGame.md)).

# Version Control
- **Document Version**: 1.8.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Match list and merge rule analysed | October 21, 2026 |
  | 1.7.0 | Developed and released | October 23, 2026 |
  | 1.8.0 | Match list toggle and date line removed | October 23, 2026 |

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
