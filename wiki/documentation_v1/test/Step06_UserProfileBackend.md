# Step 6 — User profile backend: test list

**Status: tested (October 23, 2026), developed in 1.7.0.** Step file: [Step06_UserProfileBackend.md](../Step06_UserProfileBackend.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 18-21), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Play time**
  - Done: a single `ts_update` per request and `play_ms` growing by at most 5 minutes between two moves.
  - Test: make a move, wait more than 5 minutes, make another one.
  - Expected: the time in the profile grows by 5 minutes at most.
- [ DONE ] **2. Statistics in `/me`**
  - Done: played, completed, game over, time and clock.
  - Test: look at the profile after finished, game-over and cancelled matches.
  - Expected: correct counters; `CANCELLED` and `BANNED` matches are excluded.
- [ DONE ] **3. Preferences**
  - Done: `PATCH /api/auth/me` for language and theme, refused to guests.
  - Test: as a Google user change the language and open another device; then try as a guest.
  - Expected: for Google the language stays saved; for the guest answer 403 `GOOGLE_ACCOUNT_REQUIRED`, the language
    stays only in localStorage.
- [ DONE ] **4. Richer export**
  - Done: the export schema has `playMs` and the `CANCELLED`/`BANNED` states; with 1.8.0 the AWS checksum is fixed too.
  - Test: export a finished or cancelled match and import it again.
  - Expected: import succeeds, no `CHECKSUM_MISMATCH`, original state kept.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
