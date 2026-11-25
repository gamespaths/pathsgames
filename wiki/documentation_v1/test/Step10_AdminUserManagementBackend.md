# Step 10 — Admin user management backend: test list

**Status: tested (October 29, 2026), developed in 1.7.0, fixes in 1.10.0 and 1.11.0.** Step file: [Step10_AdminUserManagementBackend.md](../Step10_AdminUserManagementBackend.md).
Moved here from the owner's old lists `1_07_TESTED_Google.md` (items 35-37, 39), `1_10_TODO_TEST_1.10.0.md` and
`1_11_TODO_TEST.1.11.0.md`, translated (November 25, 2026). The admin pages (list, detail, reason dialog) are in the
[Step 11 test list](./Step11_AdminUserManagementPages.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Ban**
  - Done: state 4, active matches `BANNED`, HMAC hash of `sub` and email, a row in the intervention log.
  - Test: ban a user with an active match, then log in as that user.
  - Expected: login refused and match `BANNED`; on an admin or a guest the action is refused
    (`ADMIN_NOT_BANNABLE` / `GUEST_NOT_BANNABLE`).
- [ DONE ] **2. Suspension**
  - Done: `until` date mandatory, at most 90 days.
  - Test: suspend a user and log in; then try a date beyond 90 days.
  - Expected: `ACCOUNT_DISABLED` with `suspendedUntil`; the date beyond 90 days is refused; after the expiry the
    login works again by itself.
- [ DONE ] **3. Unblock**
  - Done: the unblock removes the ban hashes.
  - Test: unblock the banned user and log in again.
  - Expected: the login works; the matches stay `BANNED`.
- [ DONE ] **4. `IDENTITY_MISMATCH`**
  - Done: subject re-link armable once, or deletion of the old user.
  - Test: only with the Robot suite and the fake provider.
  - Expected: the next login replaces the subject.

---

## Fixes (1.10.0)

- [ ROBOT ] **5. Automatic unblock at the end of a suspension**
  - Done: new dev endpoint `POST /api/dev/users/{uuid}/expire-suspension` (admin port, dev/test only).
  - Test: from react-admin suspend a user until tomorrow; try the login (refused); then
    `curl -X POST http://localhost:8044/api/dev/users/<uuid>/expire-suspension`; log in again.
  - Expected: the login works; in react-admin the user is active again (state 2) with the UNBLOCK row by SYSTEM.
- [ DONE ] **6. Ban of a user who is playing**
  - Test: Google user in a match on react-game; ban them from react-admin; in the game make a move and reload.
  - Expected: `ACCOUNT_DISABLED`, warning in the navbar, the match is `BANNED` behind the toggle; the refresh does
    not bring them back in.
- [ DONE ] **7. Encoded admin path (Java, critical)**
  - Done: `PathGuardFilter` (400 `INVALID_PATH`), filters on the decoded path, ADMIN interceptor on the admin controllers.
  - Test (local Java, guest token):
    `curl -i --path-as-is http://localhost:8042/api/%61dmin/users -H "Authorization: Bearer <guest token>"`,
    then the same with `/api;x/admin/users` and `-X POST http://localhost:8042/api/%64ev/admin-token`.
  - Expected: 400 `INVALID_PATH`, never the users list nor an admin token.
  - Non-regression test: in react-admin search a user **by email** and open their detail (the path contains `%40`).
  - Expected: it works as before.
- [ ROBOT ] **8. Robot `tests_v1/10_admin_users/admin_path_guard.robot`** (2 tests)
  - On the public URL, `/api/%61dmin/users`, `/api;x/admin/users`, `//api//admin`, `..` and `/api/%64ev/admin-token`
    answer 400, 403 or 404 and never a token.
  - Expected: Java 400 `INVALID_PATH`, Python and AWS 404.

---

## Fixes (1.11.0)

- [ DONE ] **9. Pepper hidden in the stage deploy**
  - Test: the next alpha deploy (`code/scripts/alpha/deploy_backend.sh`).
  - Expected: the parameter list shows `BannedSubjectPepper=****`.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test lists moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
