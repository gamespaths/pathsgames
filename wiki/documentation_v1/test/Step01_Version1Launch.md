# Step 1 — Version 1 launch: test list

**Status: alpha release 1.12.0 done (October 29, 2026); phase D (permissions boundary) and E (after the release) still open.**
Step file: [Step01_Version1Launch.md](../Step01_Version1Launch.md). Moved here from the owner's old lists
`1_12_TODO_ALPHA_1.12.0.md` and `1_07_TESTED_Google.md` (item 48), translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Fixes (1.8.0)

- [ DONE ] **1. Alpha backup and restore**
  - Done: `backup_data.sh` and `restore_data.sh` plus the runbook in the alpha README.
  - Test: run `backup_data.sh`, then `restore_data.sh --list` and `--backup latest --dry-run`.
  - Expected: backup in S3 with a manifest, a correct restore plan and a warning when the version differs.

---

## Alpha release 1.12.0 — from 1.1.0 to 1.12.0

Written on October 29, 2026. Alpha (`pathsgames-alpha`, us-east-1, `paths.games` + `api-alpha.paths.games`) was
still on **v1.1.0** (`origin/main`); develop was on **1.12.0**. Everything green in test.
For each point: **What** = what to do, **Expected** = the expected result. AWS, Terraform and Git commands are run
by the owner with **their own credentials** (user with IAM permissions), not with the CI ones.

### 0. To know before starting

- **The stack is recreated, not updated.** From 1.7.0 the GSI1 and GSI2 projections change (`summary`,
  `ts_update`, `playMs`, …). CloudFormation cannot change them in place: an update from 1.1.0 fails and rolls
  back. Official procedure: `code/scripts/alpha/README.md` §10 (backup → delete → deploy → restore).
- **Users, guests, matches and sessions are lost** (decision already taken in Step06, no backfill). Only stories
  and statistics are kept (`STORY#`, `KPI#`). Every tester starts again from zero, with Google login or as a guest.
- **Downtime** of about 20-30 minutes, from the stack delete to the website deploy. Warn the testers.
- **Order: first the recreation, then the merge to main.** A push to main touching `code/backend/aws/**` or
  `code/frontend/react-game/**` starts the deploys. Done before the recreation, the backend deploy fails while the
  new website goes online against the old API.
- **No rollback to 1.1.0.** The table layout changed: if 1.12.0 has a problem it is fixed forward. Going back
  would mean another recreation with the `v1.1.0` tag.
- **The boundary comes later** (phase D). Done separately, if the smoke test fails you know whether the cause is
  the 1.12.0 code or the boundary. The recreated stack works fine without it.

### A. Preparation (alpha is not touched)

- [ DONE ] **1. Commit of the 1.12.0 bump on develop**
  - What: commit the 23 files changed by the bump (pom, package.json, `template.yaml`, `.env.example`, footer).
    Without the commit, the template's default `Version` stays 1.11.0 on the branch going to main.
  - Expected: `git status` clean; `grep -m1 '<version>' code/backend/java/pom.xml` = 1.12.0.
- [ DONE ] **2. `.env` check**
  - What: the alpha keys are all there. Only check that `AWS_ALPHA_LAMBDA_BANNED_SUBJECT_PEPPER` has its own final
    value (it must **never** change: it is the key of the ban hashes). `AWS_ALPHA_LAMBDA_COOKIE_SAME_SITE` must be
    `Lax` (website and API are the same site). `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` stays **absent or empty**
    until phase D.
  - Optional: `AWS_ALPHA_S3_BUCKET_BACKUP`, a private bucket for backups. The default is the IaC bucket.
- [ DONE ] **3. GitHub → Settings → Environments → `alpha`**
  - What: add the keys new since 1.2.0:
    - **Secret** `AWS_ALPHA_LAMBDA_BANNED_SUBJECT_PEPPER`: **the same value as in `.env`**. With different values,
      bans saved by a local deploy would no longer be recognised after a CI deploy, and vice versa.
    - **Variable** `AWS_ALPHA_LAMBDA_GOOGLE_CLIENT_ID`: the same value as in `.env` (mandatory: without it the deploy stops).
    - Optional **Variables**: `AWS_ALPHA_LAMBDA_COOKIE_SAME_SITE=Lax`, `AWS_ALPHA_LAMBDA_MAX_SESSIONS_PER_USER`,
      `AWS_ALPHA_LAMBDA_RATE_LIMIT_GOOGLE_PER_IP`. Empty = template defaults (Lax, 12, 30).
    - `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN`: **not yet** (phase D).
  - Check: `gh secret list --env alpha` and `gh variable list --env alpha`.
  - Expected: the names above are listed, together with the ones already used at 0.42 (README §5).
- [ DONE ] **4. Google Cloud (prod project) → alpha OAuth client**
  - What: the Web client with the id of `AWS_ALPHA_LAMBDA_GOOGLE_CLIENT_ID` must have as *Authorized JavaScript
    origins* `https://paths.games` and `https://www.paths.games`. No redirect URI nor client secret (GIS ID-token
    flow). The consent screen must be **In production**, or the testers must be added as test users.
  - Expected: in the console, client and origins correct; privacy and terms point to the `paths.games` pages.
- [ DONE ] **5. Terraform production (CSP for Google)**
  - What: `code/scripts/prod/aws_terraform_deploy.sh production plan`, then `apply`.
  - Expected: the plan changes **only** the CSPs: `accounts.google.com` in script, style, connect and frame, and
    `googleusercontent.com` in img (`ssm.tf`, `environments/production.tfvars`). If the plan proposes anything else,
    stop. Harmless for the old website, so it can be done days before. Without this apply, the CSP blocks Google login.
- [ DONE ] **6. Local checks** (no cloud)
  - `cd code/backend/aws && sam validate --lint`
  - `code/scripts/alpha/deploy_website.sh --check-only` (`.env.alpha` complete, no `CHANGE_ME`)
  - Expected: `--check-only` OK. `--lint` ends with "Linting failed" but lists only **W3005** warnings (redundant
    `DependsOn`: already in v1.1.0, deployed without problems). They do not block the deploy, which does not run
    the lint. Stop only if an **E** rule (error) shows up.

### B. Deploy policy and "prepare" boundary (alpha does not change yet)

- [ DONE ] **7. Update the `paths-games-deployer` policy and create the boundary, without attaching it**
  - What: `code/scripts/prod/aws_create_policy_github_actions.sh --dry-run --boundary prepare` (read the two JSON
    again), then `code/scripts/prod/aws_create_policy_github_actions.sh --boundary prepare`.
  - Why now: the CI policy is still the 1.1.0 one. From here on it denies `UpdateAssumeRolePolicy` and
    `DeleteRolePermissionsBoundary`, and allows attaching the boundary. The merge to main (phase C) proves at once
    that the CI deploys 1.12.0 with this policy.
  - Expected: `Created arn:aws:iam::<ACCOUNT>:policy/paths-games-alpha-lambda-boundary`, `Updated …paths-games-deployer`,
    and the line `Next: set AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN=…`. **Copy the ARN, but do not put it anywhere yet.**

### C. Stack recreation and release (the downtime starts here)

- [ DONE ] **8. Backup**
  - `code/scripts/alpha/backup_data.sh`
  - `code/scripts/alpha/restore_data.sh --list`
  - Expected: the new folder with the item count and version `1.1.0`. The backup holds personal data (emails).
- [ DONE ] **9. Remove the deletion protection**
  - `aws dynamodb update-table --region us-east-1 --table-name PathsGamesBackend-alpha --no-deletion-protection-enabled`
- [ DONE ] **10. Delete the stack**
  - `aws cloudformation delete-stack --stack-name pathsgames-alpha --region us-east-1`
  - `aws cloudformation wait stack-delete-complete --stack-name pathsgames-alpha --region us-east-1`
  - Check: `aws logs describe-log-groups --region us-east-1 --log-group-name-prefix /aws/lambda/pathsgames-alpha --query 'logGroups[].logGroupName'`
  - Expected: empty list. If a Lambda was invoked during the delete it may have recreated its log group: delete it
    (`aws logs delete-log-group --log-group-name …`), otherwise the deploy fails with "already exists".
    ACM certificate, CloudFront, the S3 buckets (`data/*` included) and the backup stay up.
- [ DONE ] **11. Backend 1.12.0 deploy (local)**
  - What: `code/scripts/alpha/deploy_backend.sh`, from develop with the bump committed. Review the changeset, then confirm.
  - The parameter list must show `Version=1.12.0`, `BannedSubjectPepper=****`, `GoogleClientId=…apps.googleusercontent.com`
    and `CookieSameSite=Lax`. It must **not** show `PermissionsBoundaryArn=arn:…`.
  - Expected: stack `CREATE_COMPLETE`. **The final smoke test fails** with `no story in GET /api/stories`, because
    the table is empty, and the script exits with an error. That is normal: the stack is created anyway. Check with
    `aws cloudformation describe-stacks --stack-name pathsgames-alpha --region us-east-1 --query 'Stacks[0].StackStatus'`.
  - Then: confirm the "AWS Notification - Subscription Confirmation" mail (the SNS topic is new).
- [ DONE ] **12. Admin access**
  - `code/scripts/alpha/set_admin_ip.sh` (the new stack starts with the "nobody" allow-list)
  - `code/scripts/prod/aws_create_admin.sh alpha <nickname>` → keep `ADMIN_TOKEN` (it is never written to a file)
  - `ADMIN=$(aws cloudformation describe-stacks --stack-name pathsgames-alpha --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='AdminApiUrl'].OutputValue" --output text)`
  - Expected: `curl -s "${ADMIN}api/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN"` answers 200.
    The `AdminApiUrl` is **new**: update the react-admin configuration for alpha too.
  - The old `JWT_SECRET=… mint_admin_token.sh` method of 0.42 is no longer needed: since 1.2.0 tokens carry iss/aud.
- [ DONE ] **13. Stories and catalog**
  - Restore of the stories only (recommended, it keeps the statistics too):
    `code/scripts/alpha/restore_data.sh --backup latest --include "STORY#,KPI#" --dry-run`, then without `--dry-run`.
    Alternatively import the files again: `curl -sS -X POST "${ADMIN}api/admin/stories/import" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" --data @stories/tutorial_story.json`
    (and the same with `stories/infinite_paths.json`).
  - Do **not** run a full restore without `--include`: the old rows (users, matches, tokens) break lists and sessions.
  - Then `curl -sS -X POST "${ADMIN}api/admin/cache/flush" -H "Authorization: Bearer $ADMIN_TOKEN"` and
    `curl -sS -X POST "${ADMIN}api/admin/stories/catalog" -H "Authorization: Bearer $ADMIN_TOKEN"`.
  - Expected: the catalog answers `WRITTEN`; `curl -s 'https://api-alpha.paths.games/api/stories?lang=en'` lists the 2 stories.
- [ DONE ] **14. Automatic smoke test, run by hand**
  - `aws lambda invoke --region us-east-1 --function-name pathsgames-alpha-SmokeTestFunction --invocation-type RequestResponse --cli-read-timeout 300 --cli-binary-format raw-in-base64-out --payload '{"trigger":"deploy"}' /tmp/smoke.json && cat /tmp/smoke.json`
  - Expected: all OK (at most `WARNING`). The `pathsgames-alpha-smoke-failed` alarm, raised at point 11, goes back
    to OK after the next good day.
- [ DONE ] **15. Website 1.12.0 deploy (at once, local)**
  - What: `code/scripts/alpha/deploy_website.sh`. The 1.1.0 website does not understand the new API answers
    (`GET /api/matches` returns `{items, nextCursor, limit}`), so do not wait for the merge.
  - Expected: `https://paths.games` shows 1.12.0 in the footer. **End of the downtime.**
- [ DONE ] **16. Manual smoke test**
  - `curl https://api-alpha.paths.games/api/echo/status`: version 1.12.0 and Google enabled.
  - Guest login → story choice → match → one full game cycle (movement, event, sleep).
  - **Google login** (new on alpha): login, reload (you stay in), logout, "log out of all devices".
  - DevTools → Cookies: a single `pathsgames.refreshToken`, with Path `/api/auth`, HttpOnly, Secure and SameSite=Lax.
    No CSP error in the console.
  - `https://paths.games/?policy=privacy`, `?policy=terms`, `?policy=roadmap`; `https://pathsgames.com/x?y=1` must answer 301.
  - react-admin on alpha: users list and stories list, paginated.
  - CloudWatch: `pathsgames-alpha` dashboard present, alarms OK or INSUFFICIENT_DATA (except smoke-failed, see 14).
- [ DONE ] **17. Merge develop → release → main and push**
  - What: the merge starts `alpha-deploy-backend-aws.yml` and `alpha-deploy-website.yml`.
  - Expected: both **green**. The backend makes an almost empty update plus the smoke test. It proves that the CI
    deploys 1.12.0 with the new policy of point 7. If it fails with `AccessDenied`, send the error: alpha stays on
    what was deployed by hand.
  - Optional: tag `v1.12.0` on main (the last tag is `v1.1.0`).

### D. Permissions boundary (after C is green, also another day)

What it is for: it limits the damage if someone steals the CI's AWS keys. With the boundary, those keys can no
longer create a Lambda role with admin permissions. Origin: the 1.10.0 security review, see
[Step 40 test list](./Step40_SecurityAndHardeningCheck.md).

- [ ] **18. Phase 2: deploy with the boundary**
  - What: put the ARN of point 7 in `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` in **two** places: `.env` and the GitHub
    Variable of the `alpha` environment. Then GitHub → Actions → `alpha-deploy-backend-aws` → *Run workflow* on main.
    Better from the CI than locally: it proves that the "prepare" policy allows attaching the boundary.
  - Expected: the parameter log shows `PermissionsBoundaryArn=arn:…`; job green, smoke test included.
  - Check:
    `aws iam list-roles --query "Roles[?starts_with(RoleName,'pathsgames-alpha')].[RoleName,PermissionsBoundary.PermissionsBoundaryArn]" --output table`
  - Expected: **15 roles** (11 Lambda + 4 schedules), all with the ARN and no empty row. Then play one more round.
- [ ] **19. Phase 3: enforce**
  - `code/scripts/prod/aws_create_policy_github_actions.sh --boundary enforce`
  - Then another *Run workflow* of `alpha-deploy-backend-aws` from the CI.
    `deploy_backend.sh` run locally is **not** enough: it runs with the owner's credentials and does not test the strict rules.
  - Expected: job green.
- [ ] **If something goes wrong**
  - **Phase 2 fails before touching the roles** (CloudFormation rollback): empty the variable in `.env` and on GitHub, then redeploy.
  - **Phase 2 succeeds but a Lambda gets `AccessDenied` at runtime** (smoke test red): empty the variable in `.env`
    and on GitHub, then redeploy **locally** with `deploy_backend.sh`. It does not work from the CI: removing the
    boundary needs `iam:DeleteRolePermissionsBoundary`, which the CI policy now denies. Send the error.
  - **After phase 3 the CI is refused with `AccessDenied` on `iam:…`**: run the script again with `--boundary prepare`
    (it loosens the rules) and send the error.
  - **Warning**: the script run without `--boundary` is not neutral. It removes the permission to attach the boundary
    and, after phase 3, also the enforce. Always run it again with `--boundary enforce`.

### E. After the release

- [ ] **20. Cleanup**
  - When no longer needed, delete the backup of point 8: `aws s3 rm --recursive s3://<bucket>/alpha/backup/<ts>/`
    and the local copy in `~/.paths.games/backups/alpha/<ts>/`.
  - If not already done at 1.1.0: remove the old repository secrets `AWS_REGION`, `S3_BUCKET_WEBSITE` and
    `CLOUDFRONT_DISTRIBUTION_ID`; then `aws_create_policy_github_actions.sh --boundary enforce --attach-user <user> --detach-full`
    (always with `--boundary enforce`, see above).
- [ ] **21. Manual tests still open** of the 1.10.0–1.11.0 round: the boundary (points 18-19) and the masked pepper
  are closed by this procedure ([Step 40](./Step40_SecurityAndHardeningCheck.md), [Step 10](./Step10_AdminUserManagementBackend.md)).
  The others can be repeated on alpha.
- [ ] **22. Announcement** to the testers: accounts and matches reset, Google login available.
- [ ] **23. Documentation**: the alpha README §3 and §5 do not list the pepper, sessions, SameSite and boundary keys
  yet, and a Hotfix/note on the 1.12.0 alpha release is missing. To do with `/doc-update`.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old alpha release checklist moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
