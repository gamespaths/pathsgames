# Step 2 — Google SSO identity model: test list

**Status: tested (October 23, 2026), developed in 1.2.0.** Step file: [Step02_GoogleSsoIdentityModel.md](../Step02_GoogleSsoIdentityModel.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 1-4), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.2.0)

- [ DONE ] **1. Static policy pages**
  - Done: at build time `privacy.html`, `terms.html` and `cookies.html` are generated from the same i18n texts.
  - Test: open `https://paths.games/privacy.html`, `/terms.html` and `/cookies.html`.
  - Expected: they answer 200; every page has EN and IT with the `#en`/`#it` links and the "Open in the game" link.
- [ DONE ] **2. Google identity**
  - Done: new `users_identities` table; nickname taken from the email part before `@`, without `+tag`, with a `#2`
    suffix when already used; username `google_xxxxxxxx`.
  - Test: log in with a new Gmail account.
  - Expected: nickname equal to the part before `@`; the email is visible only in the react-admin user detail.
- [ DONE ] **3. Verified Gmail only**
  - Done: domains other than `gmail.com` (also `googlemail.com`) and unverified emails are refused.
  - Test: try the login with a Google Workspace or `googlemail.com` account.
  - Expected: error `EMAIL_DOMAIN_NOT_ALLOWED` ("we only accept Gmail") and no user created.
- [ DONE ] **4. Profile data in `/me`**
  - Done: `GET /api/auth/me` returns `displayName` and `pictureUrl`.
  - Test: after the login look at the navbar and the user card.
  - Expected: round Google picture at the top right (if it does not load the icon comes back), first and last name in the card.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
