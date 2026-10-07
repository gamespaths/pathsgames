# Step 42 — Alpha launch

**Status: DEVELOPED (0.42.0, October 6, 2026); owner steps of §9 (Terraform apply, first deploys, Robot runs) pending.**
Roadmap line: *website infra, stack hardening, alpha scripts and workflows, react-game launch
polish, alpha story and catalog, docs, tests, launch* ([Roadmap](./Roadmap.md) step 42).
Developed on `develop` as `0.42.X` (the patch number may grow during the step; the owner bumps
versions, never an agent). Touches `code/website/terraform-aws`, `code/backend/aws/template.yaml`,
`code/scripts/`, `.github/workflows/`, react-game and docs. **No API, OpenAPI or schema change:
Java and Python backends are untouched.**

Hard rules for the developing agent: change no `.env` / `.env.test` (the owner adds the keys of
§6.9 by hand); never run `terraform`, `aws`, `sam`, `gh` or Robot commands (the owner does, §9);
never commit, push or bump the version.

## 1. Scope

| # | Sub-point | Tag | Summary |
|---|-----------|-----|---------|
| 1 | Website infra | infra | Landing retired; react-game at the bucket root; redirect function from the old domain; production CSP |
| 2 | Stack hardening | infra | `IsPublicStage` condition: PITR, deletion protection, API throttling, dashboard, alarms; budget; restore runbook |
| 3 | Alpha scripts, workflows, README | infra, scripts | `code/scripts/alpha/` (3 scripts), two GitHub workflows, `README.md` |
| 4 | react-game | frontend | `.env.alpha`, privacy text, i18n gaps, favicon, `robots.txt`, `?policy=` deep link, license check |
| 5 | Alpha story and catalog | content | The owner imports the story and publishes the catalog by hand |
| 6 | Docs | docs | `master` → `main`, `website-deploy` renames, "retired" notes, `Environments.md`, release notes |
| 7 | Tests | tests | Unit tests > 96% of new code; Robot green on dev/test; one AWS Robot run on the test stack |
| 8 | Launch | all | The eight-step first-deploy order of §9; rollback = redeploy the previous tag |

**Out of scope**: OIDC for GitHub (the dedicated IAM user with access keys stays); tag changes
(tags already exist); data migration (the owner adds stories by hand); sitemap; a Italian
react-admin (stays English only); Java and Python changes; the daily smoke test and the versioning
model (both V1 step 1, [V1 Roadmap](../documentation_v1/Roadmap.md)).

### Context (decisions, October 6, 2026)

- Current version `0.42.0-SNAPSHOT`. The owner cuts a release branch by hand and merges it to
  `main`. `main` = production; the branch `master` must not exist.
- The alpha backend is the SAM stage `alpha`: stack `pathsgames-alpha`, `us-east-1`,
  `api-alpha.paths.games`. The alpha website is the **production** site: bucket `pathsgames-com`,
  domain `paths.games`, CloudFront, also `us-east-1`. There is no `alpha.paths.games` site.
- The owner adds stories by hand: no data migration.
- Hotfixes after launch are incremental `0.42.z` (V0 `Hotfixes.md`).

## 2. Endpoint APIs, DTOs, roles, tables

None. No endpoint, DTO, role or table changes. The only data-model-adjacent facts documented are
the retention rules in the privacy text (§6.4): guests with at least one match are kept; guests
without a match are removed after 60 days of inactivity (Step 41 E); IP-keyed `RATELIMIT#` items
expire by DynamoDB TTL; CloudWatch Lambda logs last 14 days.

## 3. Components

### 3.1 Website infra (`code/website/terraform-aws`)

- **Retire the landing**: delete `code/website/html/` and
  `code/scripts/prod/deploy_website_on_aws.sh`. Keep `terraform-aws`. Remove the website block
  of `code/scripts/dev/bump-version.sh` l.84-89 (otherwise `set -e` fails on the missing path).
- **react-game at the bucket root**: `index.html` and assets at the root of `pathsgames-com`.
  `data/*` (the story catalog written by the Story Lambda) is never touched by any deploy.
- **CloudFront Function** (`cloudfront-js-2.0`, viewer request, default behaviour): 301 from
  `pathsgames.com` and `www.pathsgames.com` to `https://paths.games` keeping path and query.
  Driven by a Terraform variable (the target host) that is empty on test: empty = no function
  associated. The JS is its own file under `terraform-aws/functions/` with a small Node test
  (`node --test`) covering: apex, `www`, path and query kept, `paths.games` untouched, other hosts
  untouched.
- **CSP** in `environments/production.tfvars`: `connect-src` += `api-alpha.paths.games`;
  `script-src` and `frame-src` += `challenges.cloudflare.com` (Turnstile); verify whether
  `game-icons.net` needs adding to `img-src` (grep the react-game card/icon usage; add only if
  used).
- **No OIDC. No tag changes.**
- The owner runs `code/scripts/prod/aws_terraform_deploy.sh production apply` (§9 step 1). The agent runs `terraform fmt`-style
  checks by reading only; never `terraform` itself.

### 3.2 Stack hardening (`code/backend/aws/template.yaml` + nested `template/monitoring.yaml`)

Dashboard, SNS alarms and budget live in the nested stack `template/monitoring.yaml` (module
`MonitoringModule`, created only when `IsPublicStage`); every taggable resource carries the 7 project tags.

New **condition `IsPublicStage`** (true for `alpha`, `beta`, `prod`; false for `dev`, `test`).
It drives:

| Resource | Behaviour when `IsPublicStage` |
|----------|-------------------------------|
| DynamoDB table | `PointInTimeRecoverySpecification` on; `DeletionProtectionEnabled: true` |
| API throttling | `DefaultRouteSettings` rate/burst on **both** API stages (public and admin), values from stack parameters: public 50 rate / 100 burst, admin 5 / 10. Never on `dev` / `test` |
| CloudWatch Dashboard `pathsgames-${Environment}` | Lambda Invocations, Errors, Throttles, Duration p95, ConcurrentExecutions; API Gateway v2 Count, 4xx, 5xx, Latency for public and admin; DynamoDB RCU, WCU, Throttles, SystemErrors |
| Alarms | SNS topic plus email subscription; email is a parameter; topic, subscription and alarms are created only when the email is non-empty. Alarms: metric-math SUM of Errors over the 8 functions, metric-math SUM of Throttles over the 8 functions, 5xx per API (public, admin), DynamoDB throttles |

- New parameters: `ApiThrottleRate`, `ApiThrottleBurst`, `AdminApiThrottleRate`,
  `AdminApiThrottleBurst` (defaults 50/100/5/10), `AlarmEmail` (default empty).
- `UpdateReplacePolicy: Retain` on the table may stay unconditional.
- **Budget**: `AWS::Budgets::Budget` behind a `CreateBudget` parameter (`true` only for alpha,
  `false` default). Parameters: `BudgetLimit` (USD per month) and `BudgetEmail`. The cost filter
  is the `Project` tag: `user:Project$Paths.games.aws.alpha.serverless` OR
  `user:Project$Paths.games.aws.websites`. The owner activates `Project` as a cost-allocation tag
  by hand in the Billing console; data shows only after activation (README one-time step).
- **Restore runbook** (in the alpha README): PITR restore creates a NEW table, while
  `PathsGamesBackend-alpha` is a fixed name. Runbook: restore to a new table → verify →
  decide between (a) pointing the stack to the restored table through a parameter/redeploy or
  (b) exporting the data back; document the exact commands and the deletion-protection step.
  The agent writes the runbook text; the owner runs it only in an emergency.
- **Pytest** in `code/backend/aws/tests/` (e.g. `test_step42_template_hardening.py`): parses
  `template.yaml` (CloudFormation tags tolerated, as in existing template tests) and checks that
  the condition `IsPublicStage` exists with the right stages and that PITR, deletion protection,
  both throttles, the dashboard, the alarms and the budget carry the expected condition; that
  `dev` and `test` get none of them.
- `sam validate --lint` is run by the owner (cloud-adjacent); the agent reports it as a command.

### 3.3 Alpha scripts, workflows, README

New folder `code/scripts/alpha/`:

- **(a) Backend deploy wrapper** (e.g. `deploy_backend.sh`): calls
  `../prod/aws_backend_deploy_stage.sh alpha`.
- **(b) react-game deploy** (e.g. `deploy_website.sh`):
  - builds with `--mode alpha`; **refuses to build** if any `VITE_*` key listed in
    `code/frontend/react-game/.env.example` is missing from `.env.alpha` (Vite loads `.env`
    first, so dev values would leak into the alpha bundle);
  - two-pass `aws s3 sync`: pass 1 assets with `Cache-Control: public, max-age=31536000,
    immutable` (excluding `index.html`), pass 2 `index.html` with `no-cache`; both exclude
    `data/*`; the first deploy removes landing files with `--delete` limited by the `data/*`
    exclusion;
  - invalidates `/index.html` and `/` on the distribution.
- **(c) Set-admin-IP** (e.g. `set_admin_ip.sh`): REPLACES the alpha admin allow-list with the
  caller's `IP/32`. Runs `aws cloudformation update-stack --use-previous-template` with every
  parameter `UsePreviousValue=true` except `AdminIpWhitelist`, waits for `stack-update-complete`
  and prints the IP. The authorizer has no cache, so access is immediate.

`code/scripts/prod/aws_backend_deploy_stage.sh`:
- in CI it must NOT pass `AdminIpWhitelist`, so `sam deploy` keeps the previous value (verify at
  the first deploy); locally it keeps the current behaviour (optional `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST`);
- the allow-list starts EMPTY with `AdminIpEmptyMeans=nobody` (admin closed to everybody until
  script (c) runs);
- CI always uses `--auto-confirm` (no prompt);
- passes the new parameters: throttles, `AlarmEmail` (`AWS_ALPHA_SNS_ALARM_EMAIL`), `CreateBudget`
  (`true` for alpha only), `BudgetLimit` (`AWS_ALPHA_BUDGETS_LIMIT`), `BudgetEmail`;
- version handling stays (strips `-SNAPSHOT`, l.80; the alignment is V1 step 1).

**GitHub workflows** (`.github/workflows/`): delete `website-deploy.yml`; add two:

| Workflow | Triggers | Gate | Deploy |
|----------|----------|------|--------|
| `alpha-deploy-website.yml` | push on `main`, paths `code/frontend/react-game/**`; `workflow_dispatch` | Node, `npm ci`, `npx vitest run` | writes `.env.alpha` from GitHub variables, then script (b) logic |
| `alpha-deploy-backend-aws.yml` | push on `main`, paths `code/backend/aws/**`; `workflow_dispatch` | Python 3.13 + `aws-actions/setup-sam`, pytest | script (a) logic with `--auto-confirm` |

Each has its own `concurrency` group (no cancel of an in-flight deploy), uses the GitHub
Environment `alpha`, and the order between them does not matter. Credentials: the existing
dedicated IAM user (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`); one single `AWS_REGION`
(`us-east-1`), no new region variables. Bucket and distribution are the secrets
`AWS_ALPHA_S3_BUCKET_WEBSITE` and `AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID`, the same names the scripts read.

**README** `code/scripts/alpha/README.md` (written during development; **this section is its
full content specification; the Step 42 file links to it and does not duplicate it**):
1. Purpose and the two-site picture (alpha backend stage, production website).
2. Prerequisites (AWS CLI, SAM CLI, Node, Python 3.13, the IAM user, hosted zone, ACM certificate
   in `us-east-1`).
3. Local `.env` keys (§6.9) and `.env.alpha` VITE keys (§3.4), which are not versioned.
4. IAM configuration: the inline policy of §6.10 and the optional Deny policy.
5. GitHub Environment `alpha`: the ADD / REMOVE list of §6.11.
6. The three scripts (usage, parameters, what each does and prints) and the two workflows.
7. One-time manual steps: `terraform apply` by the owner, Route53 records (api-alpha alias, apex
   and `www` to CloudFront), Turnstile hostname `paths.games` in the Cloudflare dashboard,
   activation of the `Project` cost-allocation tag, SNS email confirmation click.
8. The first-deploy order (§9).
9. Restore runbook (PITR, §3.2) and rollback (redeploy the previous tag, backend and website).

### 3.4 react-game

- **`.env.alpha`**: created by the dev, NOT versioned (already ignored in the root `.gitignore`
  l.51), must set EVERY `VITE_*` key of `.env.example`. `VITE_ENV_BADGE=alpha` (badge visible).
  Values as the GitHub variables of §6.11.
- **Privacy text** `modals.privacy.retentionBody` (`en.json` l.618 and `it.json`): guests with at
  least one match are kept; CloudWatch logs last 14 days; IP-keyed `RATELIMIT#` items expire by
  TTL; guests without a match are removed after 60 days (Step 41 E). Plain words, no technical
  names in the visible text where possible.
- **Cookie consent**: restore the English "Reject all" in `consent/cookieConsent.js` l.15 (the
  Italian already has it, l.62).
- **i18n**: add to `it.json` the 9 keys missing: `book.bonuses`, `book.multiplayerDesc`,
  `book.statistics`, `book.stats.statisticsDesc`, `game.endGameCard.title`,
  `game.endGameCard.description`, `game.endGameComplete`, `game.endGameShort`,
  `game.movement.notNeighbor`. An EN/IT key-parity vitest (or script check) must pass.
- **Favicon and `robots.txt`** in `public/` (allow all; no sitemap).
- **Deep link** `?policy=privacy` (also `cookies`, `terms`) opens the matching policy modal on
  load; unknown values are ignored; the parameter is removed from the URL when the modal closes.
  Vitest at > 96% coverage of the new code.
- **License check per story**: the CC BY-NC-ND 4.0 notice is already shown; verify it appears on
  the story card/detail and end card for every story, and fix any gap.
- react-admin stays English only (no change).

### 3.5 Alpha story and catalog (owner)

The owner imports the complete story through the raw admin URL (admin port/host with the
allow-listed IP, §9 steps 3-4) and publishes the catalog with
`POST /api/admin/stories/catalog` (writes `data/*` in the website bucket through the Story
Lambda). The story is validated and played from start to end; blocking bugs found are fixed as
patches. The agent only documents; it does not import.

### 3.6 Docs (through /doc-update) — development tasks

- **`master` → `main`** at: `Step02_CreateTheRepository.md` l.14/28/30, `Roadmap.md` l.28,
  `Step06_NamingConventions.md` l.569, `Step08_ConfigureMinimalCI.md` l.134/163/210/248/260/264.
  Redraw `Step02_CreateTheRepository_git.webp` with `main` (owner or design task; the agent lists
  it if it cannot produce images).
- **Rename the `website-deploy` references** to the two new workflows: root `README.md` l.91,
  `code/website/terraform-aws/README.md` l.215, `wiki/Architecture.md` l.156,
  `wiki/Environments.md` l.14, `Step08` l.126/167/239 (badge URL)/326, `Step41` l.245.
  (The root `README.md` is edited only for this task, which is explicitly requested here.)
- **"Retired in 0.42" notes** for the landing: Step07 l.259, Step08 l.126/179, Step20
  l.99-107/134/197, Step41 l.118.
- **`Environments.md` §1 and §3**: alpha uses the production site; the landing is retired.
- **Known minor items**:
  - `samconfig.toml` alpha `tags` still carry `version=0.38.1` (overridden by the script); the
    script's error message wrongly says `samconfig.toml` is git-ignored: fix the message.
  - `Environments.md` §1 still calls the AWS `prod` stack "Live production"; the owner checks in
    the console whether it is deployed, then the text is corrected.
- **Release notes**: a wiki file (name decided in development, linked from `wiki/INDEX.md`)
  with features, known limitations and the social link used for feedback, mirrored in the
  in-game roadmap book (Step 40).
- Keep every Version Control table to one row per version, at the bottom.

## 4. Roles and authentication

Unchanged. The admin API stays on its own API Gateway with the allow-list authorizer; the allow-list
starts empty (`nobody`) and is opened only by script (c). Turnstile hostname `paths.games` is
added in the Cloudflare dashboard (owner).

## 5. Database tables

None changed. DynamoDB gains PITR and deletion protection on public stages only.

## 6. Reference lists

### 6.9 Local `.env` keys (the owner adds them by hand; the dev agent only updates `.env.example`)

`AWS_ALPHA_SNS_ALARM_EMAIL`, `AWS_ALPHA_BUDGETS_LIMIT`, `AWS_ALPHA_APIGW_THROTTLE_RATE`,
`AWS_ALPHA_APIGW_THROTTLE_BURST`, `AWS_ALPHA_APIGW_ADMIN_THROTTLE_RATE`,
`AWS_ALPHA_APIGW_ADMIN_THROTTLE_BURST`. `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST` stays an optional local key
for the manual script only. The existing stage keys (Step 41 §6.9: `AWS_ALPHA_LAMBDA_JWT_SECRET`,
`AWS_ALPHA_LAMBDA_TURNSTILE_SECRET_KEY`, `AWS_ALPHA_APIGW_CUSTOM_DOMAIN`, `AWS_ALPHA_ACM_DOMAIN_CERTIFICATE_ARN`,
`AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE`, `AWS_ALPHA_APIGW_CORS_ORIGINS`) stay. At the end of each patch the dev
agent gives the owner an explicit "add to `.env`: KEY=value — why" list.

### 6.10 IAM (document in the README; replace `ACCOUNT_ID` and `HOSTED_ZONE_ID`)

The existing deploy user keeps `AmazonS3FullAccess` and `CloudFrontFullAccess`. **Add** the inline
policy `pathsgames-alpha-sam-deploy`:

```json
{"Version":"2012-10-17","Statement":[
{"Sid":"CloudFormation","Effect":"Allow","Action":"cloudformation:*","Resource":"arn:aws:cloudformation:us-east-1:ACCOUNT_ID:stack/pathsgames-alpha*/*"},
{"Sid":"SamTransform","Effect":"Allow","Action":"cloudformation:CreateChangeSet","Resource":"arn:aws:cloudformation:us-east-1:aws:transform/Serverless-2016-10-31"},
{"Sid":"CfnRead","Effect":"Allow","Action":["cloudformation:ValidateTemplate","cloudformation:GetTemplateSummary","cloudformation:ListStacks"],"Resource":"*"},
{"Sid":"Lambda","Effect":"Allow","Action":"lambda:*","Resource":"arn:aws:lambda:us-east-1:ACCOUNT_ID:function:pathsgames-alpha-*"},
{"Sid":"ApiGateway","Effect":"Allow","Action":["apigateway:GET","apigateway:POST","apigateway:PUT","apigateway:PATCH","apigateway:DELETE","apigateway:TagResource"],"Resource":"arn:aws:apigateway:us-east-1::/*"},
{"Sid":"DynamoDB","Effect":"Allow","Action":"dynamodb:*","Resource":"arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/PathsGamesBackend-alpha*"},
{"Sid":"IamRoles","Effect":"Allow","Action":["iam:CreateRole","iam:DeleteRole","iam:GetRole","iam:UpdateRole","iam:TagRole","iam:UntagRole","iam:PutRolePolicy","iam:DeleteRolePolicy","iam:GetRolePolicy","iam:AttachRolePolicy","iam:DetachRolePolicy","iam:UpdateAssumeRolePolicy"],"Resource":"arn:aws:iam::ACCOUNT_ID:role/pathsgames-alpha-*"},
{"Sid":"PassRoleToLambda","Effect":"Allow","Action":"iam:PassRole","Resource":"arn:aws:iam::ACCOUNT_ID:role/pathsgames-alpha-*","Condition":{"StringEquals":{"iam:PassedToService":"lambda.amazonaws.com"}}},
{"Sid":"Logs","Effect":"Allow","Action":"logs:*","Resource":"arn:aws:logs:us-east-1:ACCOUNT_ID:log-group:/aws/lambda/pathsgames-alpha-*"},
{"Sid":"EventBridge","Effect":"Allow","Action":"events:*","Resource":"arn:aws:events:us-east-1:ACCOUNT_ID:rule/pathsgames-alpha-*"},
{"Sid":"CloudWatch","Effect":"Allow","Action":["cloudwatch:PutDashboard","cloudwatch:GetDashboard","cloudwatch:DeleteDashboards","cloudwatch:PutMetricAlarm","cloudwatch:DeleteAlarms","cloudwatch:DescribeAlarms","cloudwatch:TagResource"],"Resource":"*"},
{"Sid":"Sns","Effect":"Allow","Action":"sns:*","Resource":"arn:aws:sns:us-east-1:ACCOUNT_ID:pathsgames-alpha-*"},
{"Sid":"Budgets","Effect":"Allow","Action":["budgets:ViewBudget","budgets:ModifyBudget","budgets:TagResource","budgets:UntagResource","budgets:ListTagsForResource"],"Resource":"arn:aws:budgets::ACCOUNT_ID:budget/pathsgames-alpha*"},
{"Sid":"Route53","Effect":"Allow","Action":["route53:ChangeResourceRecordSets","route53:ListResourceRecordSets"],"Resource":"arn:aws:route53:::hostedzone/HOSTED_ZONE_ID"},
{"Sid":"Route53Read","Effect":"Allow","Action":["route53:GetChange","acm:DescribeCertificate"],"Resource":"*"}]}
```

If the first deploy fails on a missing action, CloudFormation names it and the owner adds it.
Budget and alarm resource names must therefore start with `pathsgames-alpha` to match the policy.

**Recommended, optional (not required for launch)**: the Deny policy `pathsgames-protect-data`
on the same user (the Story Lambda writes the catalog with its own role, so it is unaffected):

```json
{"Version":"2012-10-17","Statement":[
{"Sid":"ProtectCatalog","Effect":"Deny","Action":["s3:DeleteObject","s3:PutObject"],"Resource":"arn:aws:s3:::pathsgames-com/data/*"},
{"Sid":"ProtectTfState","Effect":"Deny","Action":["s3:DeleteBucket","s3:DeleteObject"],"Resource":["arn:aws:s3:::pathsgames-production-iac/production/website/*","arn:aws:s3:::pathsgames-production-iac","arn:aws:s3:::pathsgames-test-iac"]}]}
```

### 6.11 GitHub Environment `alpha` (the owner creates it by hand)

**ADD secrets**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (existing IAM user)
- `AWS_ALPHA_LAMBDA_JWT_SECRET` (`openssl rand -base64 48`)
- `AWS_ALPHA_LAMBDA_TURNSTILE_SECRET_KEY`
- `AWS_ALPHA_SNS_ALARM_EMAIL`
- `AWS_ALPHA_S3_BUCKET_WEBSITE` (`pathsgames-com`)
- `AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID` (production distribution)

**ADD variables**
- `AWS_REGION=us-east-1`
- `AWS_ALPHA_APIGW_CORS_ORIGINS=https://paths.games,https://www.paths.games`
- `AWS_ALPHA_APIGW_CUSTOM_DOMAIN=api-alpha.paths.games`
- `AWS_ALPHA_ACM_DOMAIN_CERTIFICATE_ARN`, `AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE`
- `AWS_ALPHA_BUDGETS_LIMIT`
- `AWS_ALPHA_APIGW_THROTTLE_RATE=50`, `AWS_ALPHA_APIGW_THROTTLE_BURST=100`,
  `AWS_ALPHA_APIGW_ADMIN_THROTTLE_RATE=5`, `AWS_ALPHA_APIGW_ADMIN_THROTTLE_BURST=10`
- `VITE_API_URL=https://api-alpha.paths.games`
- `VITE_DEFAULT_SERVERS=[{"label":"Alpha","url":"https://api-alpha.paths.games"}]`
- `VITE_CF_TURNSTILE_KEY`, `VITE_GTM_ID`, `VITE_ENV_BADGE=alpha`
- `VITE_MATCH_START_DELAY`, `VITE_TURNSTILE_DELAY_BEFORE_START`, `VITE_TURNSTILE_PASS_TTL_MINUTES`
- `VITE_TURNSTILE_APPEARANCE_HOME`, `VITE_TURNSTILE_APPEARANCE_START`, `VITE_TURNSTILE_APPEARANCE_GUEST`
- `VITE_RESUME_WITHOUT_MODAL`, `VITE_ADD_COMING_SOON_STORIES`, `VITE_HIDE_STORIES`, `VITE_TUTORIAL_CATEGORY`

**REMOVE / do NOT create**
- `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST` in GitHub (it stays only as an optional local `.env` key for the manual script);
- no `AWS_REGION_WEBSITE` / `AWS_REGION_ALPHA`;
- the old repository-level secrets `S3_BUCKET_WEBSITE` and `CLOUDFRONT_DISTRIBUTION_ID` (replaced by the `AWS_ALPHA_*` ones);
- the old repo-level `AWS_REGION` secret becomes the environment variable above (remove the old one after the first successful run);
- `website-deploy.yml` is deleted.

## 7. Tests

- **AWS** (pytest): template test of §3.2; existing AWS unit tests stay green.
- **Scripts**: shell syntax check (`bash -n`) on the new scripts; the `.env.alpha` guard is
  verified with a dry run listing the missing keys (no build, no cloud).
- **Terraform function**: Node test of the redirect function (§3.1); no `terraform` command.
- **react-game** (vitest, > 96% of new code): `?policy=` deep link (valid, invalid, closing),
  EN/IT key parity, privacy retention text, cookie consent label.
- **Workflows**: YAML read-checked; first real run is the owner's (§9 step 6).
- **Robot**: stays green on dev/test across the three backends (no API change); one AWS Robot run
  on the test stack after the template change, where every new condition is off (owner runs it).
- **Alpha smoke test**: manual for the launch (§9 step 7); the daily automatic one is V1 step 1.

## 8. Doubts

All CLOSED (owner, October 6, 2026); listed as decisions.

1. **Alpha shape**: backend = stage `alpha` (`pathsgames-alpha`, `us-east-1`, `api-alpha.paths.games`); website = the production site `paths.games` (bucket `pathsgames-com`).
2. **Landing**: retired; `code/website/html` and `deploy_website_on_aws.sh` deleted; `terraform-aws` kept; `bump-version.sh` website block removed.
3. **Website layout**: react-game at the bucket root; `data/*` never touched by deploys.
4. **Old domain**: CloudFront Function 301 `pathsgames.com`/`www.*` → `https://paths.games`, variable empty on test, own JS file with a Node test.
5. **CSP**: connect += `api-alpha.paths.games`; script and frame += `challenges.cloudflare.com`; check `game-icons.net`.
6. **No OIDC, no tag changes.**
7. **Hardening scope**: one `IsPublicStage` condition (alpha/beta/prod) for PITR, deletion protection, throttling, dashboard and alarms; never on dev/test.
8. **Throttling**: both API stages; public 50/100 and admin 5/10 as modifiable stack parameters.
9. **Alarms**: SNS plus email parameter, created only when the email is non-empty; SUM of errors and throttles over the 8 functions, 5xx per API, DynamoDB throttles.
10. **Retain**: `UpdateReplacePolicy: Retain` may stay unconditional.
11. **Budget**: `CreateBudget` parameter true only for alpha; limit and email are parameters; filter on the `Project` tag (stack and websites values); the owner activates the tag by hand.
12. **Restore**: PITR restore makes a new table, the table name is fixed: runbook in the README.
13. **Template test**: a pytest parses `template.yaml` and checks the condition and its uses.
14. **Scripts**: `code/scripts/alpha/` with backend wrapper, react-game deploy (guard on `.env.alpha`, two-pass sync, invalidation) and set-admin-IP (replaces the list; `update-stack --use-previous-template`).
15. **Deploy script in CI**: no `AdminIpWhitelist` passed (previous value kept, verified at the first deploy); allow-list starts empty with `nobody`; `--auto-confirm` always.
16. **Workflows**: `website-deploy.yml` replaced by `alpha-deploy-website.yml` and `alpha-deploy-backend-aws.yml`; push on `main` with path filters plus `workflow_dispatch`; own concurrency group; Environment `alpha`; tests gate the deploy; order between them irrelevant.
17. **Credentials**: the existing IAM user with access keys; one `AWS_REGION`; the inline policy of §6.10 added; the Deny policy optional.
18. **README**: `code/scripts/alpha/README.md` with the content of §3.3; this file links to it.
19. **react-game**: `.env.alpha` not versioned and complete; badge `alpha`; privacy retention text; "Reject all" restored; 9 `it.json` keys; favicon and `robots.txt`, no sitemap; `?policy=` deep link; license check per story; react-admin English only.
20. **Story and catalog**: imported by the owner via the raw admin URL; catalog published with `POST /api/admin/stories/catalog`; no data migration.
21. **Docs**: `master` → `main`, `website-deploy` renames, "retired" notes, `Environments.md`, release notes: development tasks of §3.6, not done at analysis time.
22. **Tests**: unit > 96%; Robot green on dev/test; one AWS Robot run on test; alpha smoke test manual.
23. **Versions**: developed on `develop` as `0.42.X`; the owner cuts the release branch and merges to `main`; `master` must not exist; rollback = redeploy the previous tag; hotfixes incremental.
24. **Moved to V1 step 1**: daily alpha smoke test and the versioning model (`-SNAPSHOT` / `-RC` / none), see [V1 Roadmap](../documentation_v1/Roadmap.md).

### 8.1 Open points

None.

## 9. First-deploy order (launch)

1. The owner runs `code/scripts/prod/aws_terraform_deploy.sh production apply` (landing gone, CSP, redirect function).
2. The owner runs the manual alpha backend script (`code/scripts/alpha/`) and confirms the SNS
   subscription email.
3. The owner runs the set-admin-IP script (admin API opens for the caller IP only).
4. Story import and catalog publish (§3.5).
5. The owner runs the manual frontend deploy (removes the landing files, keeps `data/*`).
6. Enable and verify the two GitHub workflows (Environment `alpha` complete; first run succeeds;
   then remove the old repo-level `AWS_REGION` secret).
7. Manual smoke test: guest login, story choice, match creation, full gameplay cycle; plus
   `?policy=privacy`, the redirect from `pathsgames.com`, dashboard and alarms visible.
8. Announce.

**Rollback**: redeploy the previous tag (backend with script (a), website with script (b)).
Data recovery: restore runbook of §3.2.

# Version Control
- **Document Version**: 0.42.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.42.0 | Alpha launch analysed, all doubts closed; developed | October 6, 2026 |

- **Last Updated**: October 6, 2026 (v0.42.0)
- **Status**: developed; owner launch steps pending

# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website

## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
