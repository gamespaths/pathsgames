# Step 5 — Google SSO privacy and E2E: test list

**Status: tested (October 23, 2026), developed in 1.4.0.** Step file: [Step05_GoogleSsoPrivacyE2E.md](../Step05_GoogleSsoPrivacyE2E.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 15-17), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.4.0)

- [ DONE ] **1. Account deletion**
  - Done: `DELETE /api/auth/me` answers 202, the user goes to state 7 and a chunked job deletes everything.
  - Test: delete the account (from the profile, see [Step 7](./Step07_UserProfileReactGame.md) item 2) and log in again at once.
  - Expected: `ACCOUNT_DELETION_IN_PROGRESS` until the job ends; afterwards the same account creates a new, empty user.
- [ DONE ] **2. Legal texts**
  - Done: privacy, terms and cookies updated (Google as a third party, minimum age 14 in Italy and 16 in the rest of
    the EU, GIS classified as necessary).
  - Test: open the policies in the game and look near the login button.
  - Expected: the age line is visible and the texts mention Google.
- [ DONE ] **3. Google user migration**
  - Done: the match export carries `users_identities` and the import recreates the user.
  - Test: export a match of a Google user and import it on another backend.
  - Expected: the Google user exists and can log in.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
