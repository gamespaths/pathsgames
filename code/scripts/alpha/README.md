# Alpha stage — scripts, workflows and runbooks

Everything needed to deploy, open, watch and recover the **alpha** release of Paths Games (V0,
step 42). Design and decisions: [Step 42](../../../wiki/documentation_v0/Step42_AlphaLaunch.md).

## 1. Purpose: two sites, one alpha

| Piece | Where | Name |
|-------|-------|------|
| Backend | SAM stage `alpha`, region `us-east-1` | stack `pathsgames-alpha`, table `PathsGamesBackend-alpha`, public API `https://alpha-api.paths.games`, admin API on its raw `execute-api` URL (IP allow-list) |
| Website | the **production** site, CloudFront + S3 in `us-east-1` | bucket `pathsgames-com`, domain `https://paths.games` (also `www.paths.games`); `pathsgames.com` and `www.pathsgames.com` answer 301 to `https://paths.games` |

There is no `alpha.paths.games` site. The old landing (`code/website/html`) is retired in 0.42:
react-game sits at the bucket root. The bucket prefix `data/*` holds the story catalog written by the
Story Lambda (`POST /api/admin/stories/catalog`): no deploy ever touches it.

## 2. Prerequisites

- AWS CLI v2 and AWS SAM CLI; Node.js 20+ and npm; Python 3.13 (3.11+ for the deploy script).
- The existing dedicated IAM deploy user (access keys) with the policies of §4.
- The Route 53 hosted zone of `paths.games` and an **issued ACM certificate in `us-east-1`**
  covering `alpha-api.paths.games` (the production certificate covers `*.paths.games`).
- The website infrastructure applied with Terraform (`code/website/terraform-aws`, §7).

## 3. Local configuration (not versioned)

**Root `.env`** — the stage keys read by `code/scripts/prod/aws_backend_deploy_stage.sh`
(empty = keep the samconfig / template / previous stack value):

| Key | Purpose |
|-----|---------|
| `AWS_ALPHA_LAMBDA_JWT_SECRET` | Required, own value (`openssl rand -base64 48`), never a committed default |
| `AWS_ALPHA_LAMBDA_TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret of `paths.games` |
| `AWS_ALPHA_APIGW_CUSTOM_DOMAIN` | `alpha-api.paths.games` |
| `AWS_ALPHA_ACM_DOMAIN_CERTIFICATE_ARN`, `AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE` | ACM certificate (us-east-1) and hosted zone id |
| `AWS_ALPHA_APIGW_CORS_ORIGINS` | `https://paths.games,https://www.paths.games` |
| `AWS_ALPHA_S3_BUCKET_WEBSITE`, `AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID` | `pathsgames-com` and its distribution id (catalog export + website deploy) |
| `AWS_ALPHA_SNS_ALARM_EMAIL` | Email of the alarm topic **and** of the budget warnings; empty = no alarms |
| `AWS_ALPHA_BUDGETS_LIMIT` | Monthly budget in USD (template default 10) |
| `AWS_ALPHA_APIGW_THROTTLE_RATE`, `AWS_ALPHA_APIGW_THROTTLE_BURST` | Public API throttling (50 / 100) |
| `AWS_ALPHA_APIGW_ADMIN_THROTTLE_RATE`, `AWS_ALPHA_APIGW_ADMIN_THROTTLE_BURST` | Admin API throttling (5 / 10) |
| `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST` | Optional, manual deploys only: extra IPs merged with the caller IP |

**`code/frontend/react-game/.env.alpha`** — git-ignored; it must set **every** `VITE_*` key of
`code/frontend/react-game/.env.example`, because Vite loads `.env` first and any missing key would
ship its dev value. `deploy_website.sh` refuses to build when a key is missing or still `CHANGE_ME`.
Alpha values: `VITE_API_URL=https://alpha-api.paths.games`,
`VITE_DEFAULT_SERVERS='[{"label":"Alpha","url":"https://alpha-api.paths.games"}]'`,
`VITE_ENV_BADGE=alpha` (the header badge), the production `VITE_CF_TURNSTILE_KEY` and `VITE_GTM_ID`,
and the game options (`VITE_MATCH_START_DELAY`, `VITE_TURNSTILE_*`, `VITE_RESUME_WITHOUT_MODAL`,
`VITE_ADD_COMING_SOON_STORIES`, `VITE_HIDE_STORIES`, `VITE_TUTORIAL_CATEGORY`).

## 4. IAM configuration

The deploy user keeps `AmazonS3FullAccess` and `CloudFrontFullAccess`. **Add** the inline policy
`pathsgames-alpha-sam-deploy` (replace `ACCOUNT_ID` and `HOSTED_ZONE_ID`):

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
{"Sid":"Budgets","Effect":"Allow","Action":["budgets:ViewBudget","budgets:ModifyBudget"],"Resource":"arn:aws:budgets::ACCOUNT_ID:budget/pathsgames-alpha*"},
{"Sid":"Route53","Effect":"Allow","Action":["route53:ChangeResourceRecordSets","route53:ListResourceRecordSets"],"Resource":"arn:aws:route53:::hostedzone/HOSTED_ZONE_ID"},
{"Sid":"Route53Read","Effect":"Allow","Action":["route53:GetChange","acm:DescribeCertificate"],"Resource":"*"}]}
```

Every resource the template creates on a public stage is named `pathsgames-<stage>…` (dashboard
`pathsgames-alpha`, topic `pathsgames-alpha-alarms`, alarms `pathsgames-alpha-*`, budget
`pathsgames-alpha-monthly`) so it matches this policy. If the first deploy fails on a missing
action, CloudFormation names it in the stack events: add it and redeploy.

**Recommended, optional** — the Deny policy `pathsgames-protect-data` on the same user (the Story
Lambda writes the catalog with its own role, so it is unaffected):

```json
{"Version":"2012-10-17","Statement":[
{"Sid":"ProtectCatalog","Effect":"Deny","Action":["s3:DeleteObject","s3:PutObject"],"Resource":"arn:aws:s3:::pathsgames-com/data/*"},
{"Sid":"ProtectTfState","Effect":"Deny","Action":["s3:DeleteBucket","s3:DeleteObject"],"Resource":["arn:aws:s3:::pathsgames-production-iac/production/website/*","arn:aws:s3:::pathsgames-production-iac","arn:aws:s3:::pathsgames-test-iac"]}]}
```

## 5. GitHub Environment `alpha` (created by hand: Settings → Environments)

**ADD secrets**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (the existing IAM user)
- `AWS_ALPHA_LAMBDA_JWT_SECRET` (`openssl rand -base64 48`), `AWS_ALPHA_LAMBDA_TURNSTILE_SECRET_KEY`, `AWS_ALPHA_SNS_ALARM_EMAIL`
- `AWS_ALPHA_S3_BUCKET_WEBSITE` (`pathsgames-com`)
- `AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID` (production distribution)

**ADD variables**
- `AWS_REGION=us-east-1`
- `AWS_ALPHA_APIGW_CORS_ORIGINS=https://paths.games,https://www.paths.games`
- `AWS_ALPHA_APIGW_CUSTOM_DOMAIN=alpha-api.paths.games`, `AWS_ALPHA_ACM_DOMAIN_CERTIFICATE_ARN`, `AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE`
- `AWS_ALPHA_BUDGETS_LIMIT`
- `AWS_ALPHA_APIGW_THROTTLE_RATE=50`, `AWS_ALPHA_APIGW_THROTTLE_BURST=100`, `AWS_ALPHA_APIGW_ADMIN_THROTTLE_RATE=5`, `AWS_ALPHA_APIGW_ADMIN_THROTTLE_BURST=10`
- `VITE_API_URL=https://alpha-api.paths.games`
- `VITE_DEFAULT_SERVERS=[{"label":"Alpha","url":"https://alpha-api.paths.games"}]`
- `VITE_CF_TURNSTILE_KEY`, `VITE_GTM_ID`, `VITE_ENV_BADGE=alpha`
- `VITE_MATCH_START_DELAY`, `VITE_TURNSTILE_DELAY_BEFORE_START`, `VITE_TURNSTILE_PASS_TTL_MINUTES`
- `VITE_TURNSTILE_APPEARANCE_HOME`, `VITE_TURNSTILE_APPEARANCE_START`, `VITE_TURNSTILE_APPEARANCE_GUEST`
- `VITE_RESUME_WITHOUT_MODAL`, `VITE_ADD_COMING_SOON_STORIES`, `VITE_HIDE_STORIES`, `VITE_TUTORIAL_CATEGORY`

Every `VITE_*` variable must be **non-empty**: the website workflow writes only the non-empty ones
to `.env.alpha` and the deploy script then refuses to build if one is missing.

**REMOVE / do NOT create**
- `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST` in GitHub (only an optional local `.env` key for manual deploys);
- no `AWS_REGION_WEBSITE` / `AWS_REGION_ALPHA`;
- the old repository-level secrets `S3_BUCKET_WEBSITE` and `CLOUDFRONT_DISTRIBUTION_ID` (replaced by the `AWS_ALPHA_*` ones);
- the old repository-level `AWS_REGION` secret: remove it after the first successful run of both workflows;
- `website-deploy.yml` is deleted (replaced by the two workflows below).

## 6. Scripts and workflows

| Script | Usage | What it does |
|--------|-------|--------------|
| `deploy_backend.sh` | `deploy_backend.sh [--auto-confirm]` | Runs `code/scripts/prod/aws_backend_deploy_stage.sh alpha`: `sam build` + `sam deploy --config-env alpha` with the samconfig overrides, the `.env` stage keys, the throttles, `AlarmEmail`/`BudgetEmail` (= `AWS_ALPHA_SNS_ALARM_EMAIL`), `BudgetLimit`, `CreateBudget=true` (alpha only), `AllowMockAccess=false`, `AdminIpEmptyMeans=nobody`. Locally it detects the caller IP and passes `AdminIpWhitelist` (caller IP + `AWS_ALPHA_APIGW_ADMIN_IP_WHITELIST`); in CI (`CI=true`) it never passes `AdminIpWhitelist` (the stack keeps the previous list) and never prompts. Prints the parameters (secrets masked). |
| `deploy_website.sh` | `deploy_website.sh [--check-only]` | Checks `.env.alpha` (every `VITE_*` key of `.env.example`, no `CHANGE_ME`; `--check-only` stops here, no build, no cloud), builds with `npm run build -- --mode alpha`, then syncs in two passes: (1) the hashed `assets/` with `Cache-Control: public, max-age=31536000, immutable`; (2) `index.html` and the other root files (`robots.txt`, `favicon.svg`, `consent-defaults.js`) with `no-cache`. Both passes use `--delete` (the first deploy removes the landing files) and never touch `data/*`. Finally it invalidates `/index.html` and `/`. Needs `AWS_ALPHA_S3_BUCKET_WEBSITE` and `AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID`. |
| `set_admin_ip.sh` | `set_admin_ip.sh [--ip A.B.C.D] [--stack pathsgames-alpha] [--region us-east-1] [--dry-run]` | **Replaces** the admin allow-list with this machine's public IP (one `/32` host, written as the bare IP because the authorizer compares plain addresses): `aws cloudformation update-stack --use-previous-template` with every other parameter `UsePreviousValue=true`, waits for `stack-update-complete` and prints the IP. The authorizer has no cache: access is immediate. |

| Workflow | Triggers | Gate | Deploy |
|----------|----------|------|--------|
| `.github/workflows/alpha-deploy-website.yml` | push on `main` touching `code/frontend/react-game/**`; manual `workflow_dispatch` | `npm ci`, `npx vitest run` | writes `.env.alpha` from the variables, runs `deploy_website.sh` |
| `.github/workflows/alpha-deploy-backend-aws.yml` | push on `main` touching `code/backend/aws/**`; manual `workflow_dispatch` | Python 3.13, `pytest tests/` | `setup-sam`, runs `deploy_backend.sh --auto-confirm` |

Both use the Environment `alpha`, one `concurrency` group each (an in-flight deploy is never
cancelled) and the IAM user's access keys with the single `AWS_REGION` variable. Their order does
not matter.

## 7. One-time manual steps

1. `cd code/website/terraform-aws && ./tf.sh production plan` then `./tf.sh production apply`:
   production CSP (alpha API, Turnstile), the `pathsgames.com` redirect function.
2. Route 53: `alpha-api.paths.games` alias is created by the stack (custom domain + hosted zone);
   `paths.games`, `www.paths.games`, `pathsgames.com`, `www.pathsgames.com` must be aliases of the
   CloudFront distribution (`terraform output`).
3. Cloudflare dashboard → Turnstile → the alpha widget: add the hostname `paths.games`.
4. Billing console → Cost allocation tags: activate the user tag `Project` (data appears ~24 h later;
   the budget filter `user:Project$Paths.games.aws.alpha.serverless` / `…websites` needs it).
5. After the first backend deploy: confirm the SNS subscription email ("AWS Notification - Subscription Confirmation").

## 8. First-deploy order

1. Terraform production apply (§7.1): landing gone from the plan, CSP, redirect function.
2. `code/scripts/alpha/deploy_backend.sh`; confirm the SNS subscription email.
3. `code/scripts/alpha/set_admin_ip.sh` (admin API opens for the caller IP only).
4. Import the alpha story through the raw admin URL and publish the catalog with
   `POST /api/admin/stories/catalog` (writes `data/*` in `pathsgames-com`).
5. `code/scripts/alpha/deploy_website.sh` (removes the landing files, keeps `data/*`).
6. Complete the GitHub Environment `alpha` (§5), run both workflows once with `workflow_dispatch`,
   then remove the old repository-level `AWS_REGION` secret.
7. Manual smoke test: guest login, story choice, match creation, a full gameplay cycle;
   `https://paths.games/?policy=privacy`, the redirect from `https://pathsgames.com/x?y=1`,
   the CloudWatch dashboard `pathsgames-alpha` and the alarms in `OK` / `INSUFFICIENT_DATA`.
8. Announce.

## 9. Restore runbook (PITR) and rollback

Point-in-time recovery is on for `PathsGamesBackend-alpha` (35 days). A restore always creates a
**new** table, while the stack uses the fixed name `PathsGamesBackend-alpha`. Run only in an emergency.

```bash
R=us-east-1; T=PathsGamesBackend-alpha; N=PathsGamesBackend-alpha-restore-$(date +%Y%m%d%H%M)
aws dynamodb describe-continuous-backups --region $R --table-name $T   # EarliestRestorableDateTime / LatestRestorableDateTime
# 1. restore to a NEW table (pick a UTC time before the incident, or --use-latest-restorable-time)
aws dynamodb restore-table-to-point-in-time --region $R --source-table-name $T --target-table-name $N \
  --restore-date-time 2026-10-20T10:00:00Z
aws dynamodb wait table-exists --region $R --table-name $N
# 2. verify: status ACTIVE, item count, a few known items
aws dynamodb describe-table --region $R --table-name $N --query 'Table.[TableStatus,ItemCount]'
aws dynamodb scan --region $R --table-name $N --select COUNT
aws dynamodb get-item --region $R --table-name $N --key '{"PK":{"S":"STORY#<uuid>"},"SK":{"S":"METADATA"}}'
```

3. Decide:
   - **(a) point the stack to the restored table** — not possible with a parameter or a redeploy:
     the template fixes `TableName`, and a changed name makes CloudFormation create a new table, it
     never adopts an existing one. It would need a template hotfix plus a CloudFormation resource
     import: do not use it for the alpha.
   - **(b) export the data back (recommended)** — copy the restored items into the live table; the
     stack, its name, PITR, TTL and deletion protection stay as they are. Items written after the
     restore time are kept unless they are deleted first.

     ```bash
     python3 - <<'PY'
     import boto3
     ddb = boto3.resource("dynamodb", region_name="us-east-1")
     src, dst = ddb.Table("PathsGamesBackend-alpha-restore-YYYYMMDDHHMM"), ddb.Table("PathsGamesBackend-alpha")
     kwargs, copied = {}, 0
     with dst.batch_writer() as batch:
         while True:
             page = src.scan(**kwargs)
             for item in page["Items"]:
                 batch.put_item(Item=item); copied += 1
             if "LastEvaluatedKey" not in page:
                 break
             kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
     print("copied", copied)
     PY
     ```
   - **(b′) full replace (only if the live table is unusable)** — deletion protection must be
     switched off first; deleting a table with PITR keeps a system backup for 35 days.

     ```bash
     B=$(aws dynamodb create-backup --region $R --table-name $N --backup-name $N --query 'BackupDetails.BackupArn' --output text)
     aws dynamodb update-table --region $R --table-name $T --no-deletion-protection-enabled
     aws dynamodb delete-table --region $R --table-name $T && aws dynamodb wait table-not-exists --region $R --table-name $T
     aws dynamodb restore-table-from-backup --region $R --target-table-name $T --backup-arn "$B"
     aws dynamodb wait table-exists --region $R --table-name $T
     aws dynamodb update-continuous-backups --region $R --table-name $T --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
     aws dynamodb update-time-to-live --region $R --table-name $T --time-to-live-specification Enabled=true,AttributeName=ttl
     aws dynamodb update-table --region $R --table-name $T --deletion-protection-enabled
     ```
     A restore does not copy PITR, TTL, tags or deletion protection: the commands above set them
     back; then redeploy the backend (`deploy_backend.sh`) so the stack is aligned again.
4. Clean up: `aws dynamodb delete-table --region $R --table-name $N` (a CLI-restored table has no
   deletion protection) once the live table is verified.

**Rollback** of a bad release: check out the previous tag (`git checkout v0.42.<z-1>`) and run
`deploy_backend.sh` and `deploy_website.sh` from it, or start both workflows with
`workflow_dispatch` on that tag. Data recovery is the runbook above.
