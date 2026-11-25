# Step 40 — Security and hardening check: test list

**Status: early security review done in 1.10.0–1.11.0 and tested (October 29, 2026); the alpha rollout of the
permissions boundary is still open. The step itself (recurring) is not analysed yet:** see [Roadmap](../Roadmap.md) step 40
and [Security §10](../../Security.md). Moved here from the owner's old lists `1_10_TODO_TEST_1.10.0.md` and
`1_11_TODO_TEST.1.11.0.md`, translated (November 25, 2026). Review fixes tied to a step are in that step's list:
encoded admin path in [Step 10](./Step10_AdminUserManagementBackend.md), logout-all and cookies in
[Step 12](./Step12_PaginationAndMultiDeviceContinuity.md), stale writes and owner-only join in
[Step 8](./Step08_MatchConcurrencyMultiDevice.md), `?limit=` in [Step 9](./Step09_MatchListCancelledLastPlayed.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Security review 1.10.0

### 0. Environment variables

A rule for every row below: **Python** reads the root `.env` by itself (pydantic). **Java** only sees the variables
really exported: the `start_*` and `run_robot_*` scripts run `. .env` but export only some variables (JWT_SECRET,
rate limit). For the AWS scripts (`aws_backend_deploy.sh`, `aws_backend_deploy_stage.sh`,
`aws_create_policy_github_actions.sh`) the `.env` is enough; the alpha CI needs the repository's **GitHub Variables**.

| Variable | Where | Read by | Value | When needed |
|---|---|---|---|---|
| `TRUSTED_PROXIES` | `.env` (Python); exported variable (Java) | per-IP rate limit of Java and Python | **empty** (default) | Only if a Java/Python backend sits behind a proxy (nginx, ALB, Cloudflare): the proxy CIDR, e.g. `10.0.0.0/8,172.16.0.0/12`. Empty = `X-Forwarded-For` ignored and the real connection IP counts. Locally and on today's EC2 it stays empty |
| `AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS` | `.env` | `code/scripts/test/aws/aws_backend_deploy.sh` | **`false`** (default) | `true` only on a private test stack with `AWS_TEST_LAMBDA_GOOGLE_ENABLED=false`, otherwise the script stops with an error. It was always `true` before |
| `AWS_TEST_APIGW_CORS_ORIGINS` | `.env` (already there) | SAM test and, since 1.10.0, the EC2 Python scripts (`start.sh`, `redeploy.sh`) | comma-separated list, e.g. `http://localhost:5174,https://test.paths.games` | It must hold **every origin** from which the game calls the EC2 Python, otherwise the browser blocks the refresh. If empty, the EC2s use `*` **without credentials**: cookies do not work |
| `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` | `.env` **and** GitHub Variable with the same name | `aws_backend_deploy_stage.sh` → SAM parameter `PermissionsBoundaryArn` | `arn:aws:iam::<ACCOUNT_ID>:policy/paths-games-alpha-lambda-boundary` | Only during the boundary rollout (manual test 4). Empty = no boundary, everything as before |

Nothing else is needed to start anything: with the defaults (all empty or `false`) dev, test and alpha work.

Two existing variables made the Robot runs on AWS test fail (run of October 27):

| Variable | Problem | What to do |
|---|---|---|
| `AWS_TEST_LAMBDA_TURNSTILE_SECRET_KEY` | holds the Cloudflare test key `1x0000…AA` that **always accepts**: every token passes and the 2 Turnstile tests expect 400 | use the real key of the test widget, or `2x0000000000000000000000000000000AA` (always refuses: only the Robot bypass token passes, but the website can no longer create a match), then redeploy test |
| `AWS_TEST_LAMBDA_MAX_SESSIONS_PER_USER` | holds `3`; the 13-logins test assumed 12 | nothing: since 1.10.0 `run_robot_with_aws_serverless.sh` passes the value to Robot, see [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md) |

> Python Docker note: the image now starts with `ENV=production`. The test EC2s already pass `ENV=test` and a real
> `JWT_SECRET`, so nothing changes. If the image is started by hand, pass `-e ENV=development -e JWT_SECRET=...`,
> otherwise it starts in production mode (PostgreSQL, mandatory secrets).

### 1. Steps, in order

- [ DONE ] **1. `.env`**: compare with `.env.example` the 3 new lines (`TRUSTED_PROXIES`,
  `AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS`, `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN`). Leave them empty or `false`.
  Check that `AWS_TEST_APIGW_CORS_ORIGINS` holds the origins of the test game.
- [ DONE ] **2. Unit tests** (green; run again only after a change):
  - `cd code/backend/java && mvn test`
  - `source .venv/bin/activate && cd code/backend/python && pytest`
  - `source .venv/bin/activate && cd code/backend/aws && pytest`
  - `cd code/frontend/react-game && npx vitest run`
- [ DONE ] **3. Local Robot**, one at a time (the new suites start by themselves, the scripts run `tests_v*/`):
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - `code/scripts/dev/run_robots/run_robot_with_aws_local.sh`
  - `ROBOT_RATE_LIMITS=1 code/scripts/dev/run_robots/run_robot_with_local_java.sh` (rate limit: it now counts the real IP)
- [ DONE ] **4. AWS test stack deploy**: `code/scripts/test/aws/aws_backend_deploy.sh`.
  From here on the test stack uses real JWTs instead of the `MOCK_ACCESS_` tokens.
- [ DONE ] **5. Robot on AWS test**: `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh`.
  The aws-local report of October 23 came before the 1.8.0 fix: this is the first real run of 08, 09 and 12.
- [ DONE ] **6. Test EC2 Python** (if used): `code/scripts/test/build_docker_python_test_and_push.sh`,
  then `code/scripts/test/aws_ec2_with_python_docker/redeploy.sh`.
- [ DONE ] **7. Manual tests** of section 2 and of the step lists linked above.
- [ ] **8. Permissions boundary rollout** (manual test 4 below): only when 1-7 are green.
- [ DONE ] **9. Documentation**: `/doc-update` ("Fixes (1.10.0)" sections of Steps 8, 10 and 12, `Security.md`,
  `.claude/docs/robot-suites.md`, `Environments.md` for the new variables).
- [ DONE ] **10. Robot again after 1.11.0**
  - Done: weather and join only for the match creator, non-numeric `?limit=` = default, Python cookie on `/api/auth`.
  - Test: `code/scripts/dev/aws/run_robot_ec2_spot/run_all.sh` (or `run_robot_everywhere.sh` on the PC).
  - Expected: all green as in the 1.10.0 run.

### 2. Manual tests

- [ DONE ] **1. Mock tokens off on AWS test** (after step 4)
  - Test: `curl -i https://<api-test>/api/auth/me -H "Authorization: Bearer MOCK_ACCESS_00000000-0000-0000-0000-000000000001"`
  - Expected: 401. Google login and the game work normally.
- [ DONE ] **2. Python: CORS without credentials and safe image** (only with the EC2 Python, after step 6)
  - Test: `curl -i -X OPTIONS http://<ec2>:8042/api/auth/refresh -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST"`
  - Expected: no `access-control-allow-origin: https://evil.example` together with
    `access-control-allow-credentials: true`; from the origins of `AWS_TEST_APIGW_CORS_ORIGINS` login and refresh work.
- [ ROBOT ] **3. `X-Forwarded-For` cannot be forged** (local Java or Python)
  - Test: `ROBOT_RATE_LIMITS=1 code/scripts/dev/run_robots/run_robot_with_local_java.sh` (guest limit 10 per IP).
  - Expected: rate-limit suite green. Sending by hand 11 `curl -X POST .../api/auth/guest`, each with a different
    `X-Forwarded-For`, the 11th still answers 429.
- [ ] **4. CI IAM permissions boundary** (3-phase rollout; the AWS commands are run by the owner)
  - Done: optional boundary on all 15 Lambda/scheduler roles; `UpdateAssumeRolePolicy` always denied.
  - Step a: `code/scripts/prod/aws_create_policy_github_actions.sh --dry-run --boundary prepare` (check), then without
    `--dry-run`: it creates `paths-games-alpha-lambda-boundary` and prints the ARN.
  - Step b: the ARN in `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` (`.env` and GitHub Variable), then an alpha deploy.
  - Step c: `code/scripts/prod/aws_create_policy_github_actions.sh --boundary enforce`, then another alpha deploy.
  - Expected: green deploys; in the IAM console every `pathsgames-alpha-*` role shows the boundary; alpha smoke test OK.
  - If step b fails: empty the variable and redeploy (back as before).
  - Not done: restricting `apigateway:*` to the alpha APIs only (to be tried with a real deploy).
  - Status: the 1.11.0 list marked it done, but the later alpha release list leaves phases 2 and 3 open: step a was
    done in the alpha release (item 7), steps b and c are items 18-19 of the [Step 1 test list](./Step01_Version1Launch.md).

## Security review 1.11.0

- [ UNIT ] **5. AWS tokens without `exp` refused**
  - Test: covered by unit tests; no manual action needed.
- [ DONE ] **6. Safe credit links** (react-game)
  - Done: the copyright links of the credits open only if `http`/`https`.
  - Test: open the PolicyBook (credits) and the copyright link of a card.
  - Expected: they open as before.
- [ DONE ] **7. Updated dependencies** (react-game `dompurify` 3.4.17 and `axios` 1.21.0, react-admin `axios` 1.21.0)
  - Test: build and a quick tour of game and admin.
  - Expected: no visible difference. Left: `follow-redirects` (Node only) and `react-router` (move to v7, later).

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old security review test lists moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
