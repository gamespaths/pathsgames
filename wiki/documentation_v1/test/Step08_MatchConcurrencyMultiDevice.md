# Step 8 — Match concurrency on several devices: test list

**Status: tested (October 29, 2026), developed in 1.7.0, fixes in 1.8.0, 1.10.0 and 1.11.0.** Step file: [Step08_MatchConcurrencyMultiDevice.md](../Step08_MatchConcurrencyMultiDevice.md).
Moved here from the owner's old lists `1_07_TESTED_Google.md` (items 26-28), `1_10_TODO_TEST_1.10.0.md` and
`1_11_TODO_TEST.1.11.0.md`, translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. `If-Match` and `STALE_MATCH`**
  - Done: `matchVersion` on the 11 game writes; an old version gets 409.
  - Test: open the same match on two devices, move on A, then move on B without reloading.
  - Expected: B shows "Match is being updated", reloads the state and does not send the action again.
    (Since 1.8.0 the floating notice is replaced by a "Refreshing" card, see the step file.)
- [ DONE ] **2. Reload on return on Safari/iOS**
  - Done: refetch when going back to the page after at least 30 s, only on WebKit (configurable).
  - Test: on an iPhone leave the match for more than 30 s and come back.
  - Expected: the match reloads by itself.
- [ DONE ] **3. Chunked AWS writes**
  - Done: writes go in chunks of 100 items or 4 MB, with a serialization fix in 1.8.0.
  - Test: play a long match on AWS.
  - Expected: no 500 `WRITE_FAILED`.

---

## Fixes (1.10.0)

- [ DONE ] **4. AWS writes: stale instead of 500**
  - Done: if the version changes between the claim and the write, the answer is 409 `STALE_MATCH`, not 500 `WRITE_FAILED`.
  - Test: hard to cause by hand (it needs an admin action at the same instant). Play a long match on AWS test and
    meanwhile use react-admin on the same match (pause/resume, edit statistics).
  - Expected: no `MATCH_WRITE_FAILED` in CloudWatch; in the game at most the "Match is being updated" card.
- [ ROBOT ] **5. Robot `tests_v1/08_match_concurrency/match_concurrency_writes.robot`** (7 tests, own story `story_concurrency.json`)
  - Done: `STALE_MATCH` on execute-event, select-choice, movement, use-item, drop-item, use-exp, end.
  - Expected: for each one, with the old version 409 `STALE_MATCH` and the match unchanged (version, state, players,
    inventory); with the current one success and a new version. On every backend.
  - The existing suite 08 only had keywords moved to `concurrency_common.resource`: it must stay green as before.

---

## Fixes (1.11.0)

- [ UNIT ] **6. `STALE_MATCH` order on AWS** (aligned with Java and Python)
  - Done: with an old `If-Match`, a missing event, choice or item answers 409 `STALE_MATCH` (AWS answered 404
    before); a missing match or character stays 404. OpenAPI 1.7.0 fixed.
  - Test: covered by unit tests; no manual action needed.
- [ DONE ] **7. Weather and join for the owner only** (Java, Python, AWS)
  - Done: `GET /api/matches/{uuid}/weather` and `POST /api/matches/{uuid}/join` of a match created by another user
    answer 404 `MATCH_NOT_FOUND` (one human player per match until V4).
  - Test: play normally (weather visible, join at the first start); then with another guest try the two curls on
    the uuid of your match.
  - Expected: the game works as before; the other guest gets 404.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test lists moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
