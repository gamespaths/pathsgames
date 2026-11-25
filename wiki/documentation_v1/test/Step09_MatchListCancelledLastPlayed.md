# Step 9 — Match list, cancelled matches and last played: test list

**Status: tested (October 29, 2026), developed in 1.7.0, fixes in 1.11.0.** Step file: [Step09_MatchListCancelledLastPlayed.md](../Step09_MatchListCancelledLastPlayed.md).
Moved here from the owner's old lists `1_07_TESTED_Google.md` (items 29-32) and `1_11_TODO_TEST.1.11.0.md`,
translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Order and "played"**
  - Done: list in the `{items, nextCursor}` format, active matches first, then by last played.
  - Test: open the match list.
  - Expected: the active ones are on top and every row shows "played 2 hours ago".
    (The date line was removed in 1.8.0, see the step file.)
- [ DONE ] **2. Cancelled matches**
  - Done: `CANCELLED` and `BANNED` sit behind the "show cancelled" toggle.
  - Test: turn the toggle on and off.
  - Expected: without the toggle they are hidden; with it they show in grey and do not open.
    (The toggle was removed in 1.8.0: cancelled matches are always shown, see the step file.)
- [ DONE ] **3. Merge rule**
  - Done: the active match of the Google account always wins.
  - Test: as a guest start a story on which the Google account already has an active match, then log in.
  - Expected: the Google match stays; the guest's one becomes `CANCELLED`, highlighted once with the explanation.
- [ DONE ] **4. Hint before Play**
  - Done: guests see "Have an account? Sign in to continue".
  - Test: as a guest press Play.
  - Expected: the hint shows next to the login card.

---

## Fixes (1.11.0)

- [ DONE ] **5. `?limit=abc` the same everywhere**
  - Done: a non-numeric `limit` reads as absent (page of 50) on Java, Python and AWS, instead of 400/422.
  - Test: `curl -i "http://localhost:8042/api/matches?limit=abc" -H "Authorization: Bearer <token>"` on every backend.
  - Expected: 200 with `"limit": 50`.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test lists moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
