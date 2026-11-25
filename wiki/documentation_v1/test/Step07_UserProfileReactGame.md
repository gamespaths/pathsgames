# Step 7 — User profile react-game page: test list

**Status: tested (October 23, 2026), developed in 1.7.0.** Step file: [Step07_UserProfileReactGame.md](../Step07_UserProfileReactGame.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 22-25), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Profile page**
  - Done: profile in the user book with statistics and preferences.
  - Test: open it as a guest and as a Google user.
  - Expected: the guest sees the statistics and the login invitation, but not "Log out of all devices" nor the deletion.
- [ DONE ] **2. First login and deletion**
  - Done: at the first login the device preferences are copied into the profile; the deletion asks for a new Google popup.
  - Test: as a guest choose IT, log in with a new account, then delete the account.
  - Expected: the profile starts in IT; the deletion asks for the Google confirmation, then logs out with a final message.
- [ DONE ] **3. Log out of all devices**
  - Done: `POST /api/auth/logout/all` plus the announcement to the other tabs.
  - Test: log in on two browsers and click the button in one.
  - Expected: the other one is closed within about 60 s with "session closed by another device".
- [ DONE ] **4. Reload on return**
  - Done: when the page becomes visible again `/me` is read again.
  - Test: change the language on device A and go back to the tab on device B.
  - Expected: B applies the new language.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
