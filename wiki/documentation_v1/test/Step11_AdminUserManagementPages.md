# Step 11 — Admin user management pages: test list

**Status: tested (October 23, 2026), developed in 1.7.0.** Step file: [Step11_AdminUserManagementPages.md](../Step11_AdminUserManagementPages.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 33, 34, 38), translated (November 25, 2026).
Ban, suspension, unblock and re-link are in the [Step 10 test list](./Step10_AdminUserManagementBackend.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Users list**
  - Done: `/users` page in react-admin; a text with "@" searches the exact email, otherwise the nickname prefix;
    filter by state.
  - Test: search by email, by prefix, and filter.
  - Expected: right results, no email column, paging with "load more".
- [ DONE ] **2. User detail**
  - Done: `/users/:uuid` page.
  - Test: open a Google user.
  - Expected: email, identities, statistics, sessions and match history with a link to the match.
- [ DONE ] **3. Reason dialog**
  - Done: standard reason plus free text of 10–500 characters.
  - Test: write fewer than 10 characters.
  - Expected: the confirmation is not possible.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
