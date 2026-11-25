# Step 4 — Google SSO react-game login: test list

**Status: tested (October 23, 2026), developed in 1.4.0.** Step file: [Step04_GoogleSsoReactGameLogin.md](../Step04_GoogleSsoReactGameLogin.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 11-14), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.4.0)

- [ DONE ] **1. Google button**
  - Done: GIS popup in the header and in the guest modal; the Google script is loaded only on click.
  - Test: open DevTools → Network and click "Sign in".
  - Expected: the `accounts.google.com` script shows up only after the click and the nickname replaces `guest_xxx`.
- [ DONE ] **2. Guest → Google linking**
  - Done: at login the current guest is merged into the Google account.
  - Test: play as a guest, then log in.
  - Expected: the guest's matches are found in the Google account.
- [ DONE ] **3. Logout**
  - Done: after the logout the previous guest is resumed, if its cookie exists.
  - Test: log out.
  - Expected: back to the previous guest, or to the Home if the cookie is missing.
- [ DONE ] **4. Several tabs**
  - Done: only one tab renews the token and login/logout are announced to the other tabs.
  - Test: open two tabs and log in or out in one.
  - Expected: the other one updates too, with no false `SESSION_REVOKED` errors.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
