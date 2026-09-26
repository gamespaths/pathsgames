# Paths Games - WebSite - AWS Infrastructure (Terraform)

This Terraform project provisions the complete AWS infrastructure to host the **Paths Games** static website on the `paths.games` and `pathsgames.com` domain.

The module is environment-parameterized: the same Terraform code manages an independent **production** and **test** deployment, each with its own remote state, applied through the `tf.sh` wrapper (see [Terraform State](#terraform-state) and [Deployment](#deployment)).

## Architecture Overview

```
production:
  User → Route 53 (paths.games, pathsgames.com) → CloudFront (CDN) → S3 Bucket (pathsgames-com)
                                                          ↑
                                                  WAF v2 (Firewall, opt-in)
                                                  ACM (SSL/TLS, owned here)
                                                  Security Headers (dynamic CSP)

test:
  User → Route 53 (test.paths.games) → CloudFront (CDN) → S3 Bucket (pathsgames-com-test)
                                              ↑
                                      WAF v2 (Firewall, opt-in)
                                      ACM (SSL/TLS, shared with production)
                                      Security Headers (dynamic CSP)
```

One module, one state per environment. The ACM certificate and the 5 CSP SSM parameters are created once by `production` (the certificate covers `*.paths.games`, so every `<env>.paths.games`) and looked up read-only by every other environment.

## Resources Created

### S3 Bucket (`s3.tf`) — one per environment
- **Bucket name:** from `var.bucket_name` — `pathsgames-com` in production, `pathsgames-com-test` in test
- **Public access:** Fully blocked — content is served exclusively through CloudFront
- **Encryption:** AES-256 server-side encryption at rest
- **Versioning:** Enabled for rollback safety
- **Bucket policy:** Allows access only from the CloudFront distribution via Origin Access Control (OAC)
- **Force destroy:** off by default; test sets `bucket_force_destroy = true` so `terraform destroy` can empty the bucket first (never enabled in production)

### CloudFront Distribution (`cloudfront.tf`) — one per environment
- **Origin Access Control (OAC):** named `<bucket_name>-oac`, secure connection between CloudFront and S3
- **HTTPS only:** HTTP requests are automatically redirected to HTTPS
- **TLS version:** Minimum TLS 1.2 (2021 policy)
- **HTTP/2 + HTTP/3:** Enabled for maximum performance
- **Price class:** `PriceClass_100` — edge locations in US and Europe
- **SPA support:** Custom error responses for 403/404 redirect to `index.html`
- **Compression:** Enabled (gzip/brotli)
- **Aliases:** from `var.aliases` — production: `paths.games`, `www.paths.games`, `pathsgames.com`, `www.pathsgames.com`; test: `test.paths.games`
- **WAF:** attached only when `enable_waf = true` for that environment

### ACM Certificate (`cloudfront.tf`) — shared, owned by production
- **Domain:** `paths.games` with SANs `*.paths.games`, `pathsgames.com`, `*.pathsgames.com`
- **Issued once:** `count = local.is_production ? 1 : 0` in production; every other environment reads it with `data "aws_acm_certificate"` (domain, `ISSUED`, most recent) instead of requesting its own
- **Validation:** DNS validation — add the CNAME records provided by ACM to your domain's DNS
- **Region:** `us-east-1` (required for CloudFront certificates)

### Security Headers (`cloudfront.tf`) — one per environment
CloudFront injects the following security headers on every response:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Content-Security-Policy` | Built dynamically from SSM (see below) | Restrict resource loading |

The response headers policy is named `paths-games-security-headers` in production and `paths-games-security-headers-<env>` in every other environment.

### Content Security Policy – Dynamic CSP via SSM (`ssm.tf`) — shared allowlists + per-environment extras

The CSP header is **not hardcoded**. Its behaviour is controlled by the `csp_mode` variable, set per environment in `environments/<env>.tfvars`:

| `csp_mode` | CSP applied | When to use |
|---|---|---|
| `open` *(default)* | `default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; ...` | Development / debugging — allows all origins |
| `restricted` | Built from SSM allowlists + `csp_extra_domains` (see below) | Production / test — strict per-directive allowlist |

When `csp_mode = "restricted"`, the base domain allowlists are stored in AWS SSM Parameter Store as `StringList` parameters, created once by production (`count = local.is_production ? 1 : 0`) and read by the other environments through `data "aws_ssm_parameter"`. At deploy time, Terraform reads them and builds the full CSP string automatically.

For each base domain (SSM lists + `csp_extra_domains`), Terraform expands it into two CSP origins:
```
google-analytics.com  →  https://google-analytics.com  +  https://*.google-analytics.com
```

**To add a domain shared by every environment**, edit the relevant list in `ssm.tf` and run `./tf.sh production apply` — no other file needs to change:

| SSM Parameter | CSP Directive | Current domains |
|---|---|---|
| `/paths-games/csp/script-src` | `script-src` | `jsdelivr.net`, `googletagmanager.com` |
| `/paths-games/csp/style-src` | `style-src` | `googleapis.com`, `jsdelivr.net`, `cloudflare.com` |
| `/paths-games/csp/font-src` | `font-src` | `gstatic.com`, `cloudflare.com` |
| `/paths-games/csp/img-src` | `img-src` | `googletagmanager.com`, `google-analytics.com` |
| `/paths-games/csp/connect-src` | `connect-src` | `google-analytics.com`, `analytics.google.com`, `g.doubleclick.net` |

**To add a domain for one environment only**, set `csp_extra_domains` in that environment's `environments/<env>.tfvars` (map of directive → base domains, merged into the lists above). For example `test.tfvars` adds the test API hosts on `connect` (`api-test.paths.games`, `api-test-server2.paths.games`, `api-test-server3.paths.games`) and `challenges.cloudflare.com` on `script`, both needed by react-game — only relevant when `csp_mode = "restricted"`.

> Special values (`'self'`, `'unsafe-inline'`, `data:`) are hardcoded in `cloudfront.tf` because they are not domains.

**Where to verify the active CSP:**
- AWS Console: `CloudFront → Policies → Response headers → paths-games-security-headers[-<env>]`
- AWS Console: `Systems Manager → Parameter Store → /paths-games/csp/`
- Live: `curl -sI https://paths.games | grep -i content-security-policy`

### WAF v2 – Web Application Firewall (`waf.tf`) — one per environment, opt-in
- **Rate limiting:** Blocks IPs sending more than 1,000 requests in 5 minutes
- **AWS Managed Rules – Common Rule Set:** Protects against OWASP Top 10 threats (SQL injection, XSS, etc.)
- **AWS Managed Rules – Known Bad Inputs:** Blocks requests with known malicious patterns
- **Bot Control:** Available but commented out (has additional AWS cost)
- **CloudWatch metrics:** Enabled for all rules
- **Naming:** `paths-games-waf` in production, `paths-games-waf-<env>` in every other environment
- **Disabled by default:** controlled by `enable_waf` in `environments/<env>.tfvars` (default: `false`) to avoid costs during development

## Tagging

Every resource is tagged through the provider's `default_tags` (`main.tf`), the same seven keys used by the SAM backend stacks (though `Project` here still reads `Paths.games`, not the SAM stacks' `Paths.games.aws.<env>.serverless`):

| Tag | Value |
|---|---|
| `CostCenter` | `Paths.games` |
| `Environment` | `var.environment` (`production` / `test`) |
| `ManagedBy` | `Terraform` |
| `Owner` | `AlNao` |
| `Project` | `Paths.games` |
| `version` | `VERSION` from the root `.env`, passed by `tf.sh` as `TF_VAR_project_version` |

`Name` is set per resource: resources with a meaningful name of their own reuse it (S3 bucket → bucket name, WAF → its `paths-games-waf[-<env>]` name, SSM parameters → parameter path). Everything else uses `pathsgames-<env>-<service>` (e.g. `pathsgames-production-Certificate`, `pathsgames-<env>-Distribution`). The CloudFront Origin Access Control and the response headers policy are not taggable in the AWS provider.

## Terraform State

One state per environment, each in its own state bucket:

| Environment | Bucket | Key | Region |
|---|---|---|---|
| `production` | `pathsgames-production-iac` | `production/website/terraform.tfstate` | `us-east-1` |
| `test` | `pathsgames-test-iac` | `test/website/terraform.tfstate` | `us-east-2` |

Both backends use `encrypt = true` and `use_lockfile = true` (S3 native state locking — no DynamoDB lock table), which requires **Terraform >= 1.10**. The backend is selected with `-backend-config=backend-<env>.hcl`, passed automatically by `tf.sh` (see [Deployment](#deployment)).

> **Note:** Both `-iac` buckets must already exist before running `./tf.sh <env> init`. Their region can differ from the resources region (`us-east-1`, required for CloudFront/ACM).

To add a new environment (e.g. `dev`), copy `backend-test.hcl` and `environments/test.tfvars`, adjust the bucket name / state key / aliases, and add the new name to the `environment` variable validation in `variables.tf`.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.10 installed (required for `use_lockfile`)
3. **Both remote-state buckets** already created: `pathsgames-production-iac` (us-east-1) and `pathsgames-test-iac` (us-east-2)
4. **`VERSION`** set in the root `.env` — read by `tf.sh` and applied as the `version` tag on every resource
5. **Domain** `paths.games` / `pathsgames.com` registered and accessible via Route 53 or external DNS

## Deployment

```bash
cd code/website/terraform-aws

# Initialize Terraform (downloads providers, configures the per-environment backend)
./tf.sh test init
./tf.sh production init

# Preview the changes
./tf.sh test plan
./tf.sh production plan

# Apply the infrastructure
./tf.sh test apply
./tf.sh production apply
```

`tf.sh <test|production> <terraform command> [args]` wraps every invocation: it sets `TF_DATA_DIR=.terraform-<env>` (provider + backend cache, one per environment, git-ignored), reads `VERSION` from the root `.env` into `TF_VAR_project_version`, and passes `-backend-config=backend-<env>.hcl` to `init` and `-var-file=environments/<env>.tfvars` to `plan`/`apply`/`destroy`/`import`/`refresh`/`console`. Any other command (`state`, `output`, …) passes straight through to `terraform`. Example: `./tf.sh test import aws_cloudfront_distribution.website E8WIS9RLXJVR9`.

There is no `terraform.tfvars` and no `import.sh` anymore — variables live in `environments/<env>.tfvars`, and one-off imports are run directly with `tf.sh <env> import ...`.

### Enable WAF

WAF is **disabled by default** to save costs during development. To enable it for an environment, edit `environments/<env>.tfvars`:

```hcl
enable_waf = true
```

```bash
./tf.sh <env> apply
```

When enabled, WAF adds ~$6/month base cost plus $1 per million requests.

### Switch CSP mode

The CSP is **open by default** (allows all origins). To switch an environment to the restricted SSM-driven allowlist, edit `environments/<env>.tfvars`:

```hcl
csp_mode = "restricted"
```

```bash
./tf.sh <env> apply
```

| Value | Behaviour |
|---|---|
| `open` *(default)* | `default-src *` — no restrictions, useful for dev/debug |
| `restricted` | Per-directive allowlist from SSM Parameter Store + `csp_extra_domains` |

### After `./tf.sh <env> apply`:

1. **Validate the ACM certificate** (production only, once): Terraform outputs the DNS CNAME records needed for certificate validation. Add them to your domain's DNS (Route 53 or your registrar's DNS panel).

2. **Configure DNS:** Point each environment's aliases to its CloudFront distribution domain name (shown in the outputs) — e.g. `paths.games`/`www.paths.games`/`pathsgames.com`/`www.pathsgames.com` for production, `test.paths.games` for test.

3. **Deploy website content** — this is *not* done by Terraform:
   - **production:** the GitHub workflow `.github/workflows/website-deploy.yml`, which runs `code/scripts/prod/deploy_website_on_aws.sh`
   - **test:** `code/scripts/test/aws/deploy_frontend-game_on_aws.sh`, which builds and syncs react-game to the bucket named by `AWS_S3_BUCKET_WEBSITE_TEST` in `.env`
   - either way, `POST /api/admin/stories/catalog` on that environment's admin API regenerates `data/stories-<lang>.json` under the bucket's `data/` prefix

4. **Invalidate CloudFront cache** (after updating content):
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <DISTRIBUTION_ID> \
     --paths "/*"
   ```

## Outputs

| Output | Description |
|--------|-------------|
| `environment` | Deployed environment (`production` / `test`) |
| `s3_bucket_name` | Name of the S3 bucket |
| `s3_bucket_arn` | ARN of the S3 bucket |
| `cloudfront_distribution_id` | CloudFront distribution ID (needed for cache invalidation) |
| `cloudfront_domain_name` | CloudFront domain name (e.g., `d1234abcdef.cloudfront.net`) |
| `acm_certificate_arn` | ARN of the SSL/TLS certificate (issued by production, looked up elsewhere) |
| `waf_web_acl_arn` | ARN of the WAF Web ACL |
| `website_url` | Full website URL (e.g. `https://paths.games`, `https://test.paths.games`) |

## File Structure

```
terraform-aws/
├── main.tf                       # Provider config, backend "s3" {} (partial), required versions, default_tags
├── locals.tf                     # is_production, name_prefix, shared-resource lookups (ACM, CSP SSM)
├── moved.tf                      # One-off address migration for the production state (v0.38.1, deletable after)
├── variables.tf                  # Input variables (environment, project_version, region, domain, bucket, aliases, csp_extra_domains, ...)
├── s3.tf                         # S3 bucket with security settings (one per environment)
├── cloudfront.tf                 # CloudFront distribution, ACM certificate (shared), security headers, dynamic CSP
├── ssm.tf                        # SSM Parameter Store – CSP domain allowlists, owned by production, read elsewhere
├── waf.tf                        # WAF v2 rules (rate limit, OWASP, bad inputs), one per environment
├── outputs.tf                    # Terraform outputs
├── tf.sh                         # Wrapper: picks backend/tfvars/data dir per environment, injects the version tag
├── backend-production.hcl        # Backend S3 configuration for production
├── backend-test.hcl              # Backend S3 configuration for test
├── environments/
│   ├── production.tfvars         # environment, bucket_name, aliases, enable_waf, csp_mode, ...
│   └── test.tfvars                # same, plus csp_extra_domains for react-game
└── README.md                     # This file
```

## Cost Estimate

| Service | Estimated Monthly Cost |
|---------|----------------------|
| S3 | ~$0.03 (minimal storage) |
| CloudFront | ~$1–5 (depends on traffic) |
| ACM | Free |
| WAF v2 | ~$6 (base) + $1 per million requests (disabled by default) |
| Route 53 | ~$0.50 per hosted zone |
| **Total (without WAF)** | **~$2–6/month** for a low-traffic site |
| **Total (with WAF)** | **~$8–12/month** for a low-traffic site |

> Enabling Bot Control adds ~$10/month. Figures are per environment; running both `production` and `test` roughly doubles them.

## Migration to per-environment state (v0.38.1)

The module used to manage `production` and `test` resources in a single shared state (`backend.hcl` / `s3-test.tf` / `cloudfront-test.tf`). As of v0.38.1 each environment has its own state, backend file and tfvars. This is a one-time, hand-run migration:

```bash
cd code/website/terraform-aws && mkdir -p backups
# 0. backup of the current (old-backend) state
aws s3 cp s3://pathsgames-production/PathsGamesWebsite/terraform.tfstate backups/website-prod-$(date +%Y%m%d).tfstate --region us-east-1
# 1. production: new backend, same state, drop the test resources from it (no destroy)
./tf.sh production init
./tf.sh production state push backups/website-prod-<date>.tfstate
./tf.sh production state list
./tf.sh production state rm aws_s3_bucket.website_test aws_s3_bucket_public_access_block.website_test aws_s3_bucket_server_side_encryption_configuration.website_test aws_s3_bucket_versioning.website_test aws_s3_bucket_policy.website_test aws_cloudfront_origin_access_control.website_test aws_cloudfront_distribution.website_test
./tf.sh production plan    # expected: 6 moved, tag-only in-place updates, 0 to add, 0 to destroy
./tf.sh production apply
# 2. test: fresh state, keep the existing distribution + OAC, create the new bucket
./tf.sh test init
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='pathsgames-test-oac'].Id" --output text)
./tf.sh test import aws_cloudfront_origin_access_control.website "$OAC_ID"
./tf.sh test import aws_cloudfront_distribution.website E8WIS9RLXJVR9
./tf.sh test plan          # expected: 6 to add (bucket pathsgames-com-test + 4 children, headers policy -test), 2 in-place updates (OAC name, distribution origin/policy/tags), 0 to destroy
./tf.sh test apply         # test.paths.games serves errors until the content is uploaded (step 3)
# 3. test content (outside Terraform): set AWS_S3_BUCKET_WEBSITE_TEST=pathsgames-com-test in .env, then
code/scripts/test/aws/aws_backend_deploy.sh test           # backend IAM now targets the new bucket
code/scripts/test/aws/deploy_frontend-game_on_aws.sh       # build + sync + CloudFront invalidation
# POST /api/admin/stories/catalog on the test admin API to regenerate data/stories-*.json
# 4. verify, then clean up
./tf.sh production plan && ./tf.sh test plan               # both: No changes
rm -rf .terraform                                          # old data dir (old backend)
# old website bucket (versioned): delete every version, then the bucket
aws s3api delete-objects --bucket pathsgames-test --delete "$(aws s3api list-object-versions --bucket pathsgames-test --output json --query '{Objects: [Versions[].{Key:Key,VersionId:VersionId}, DeleteMarkers[].{Key:Key,VersionId:VersionId}][]}')"
aws s3 rb s3://pathsgames-test
# old state bucket, once production plan is clean
aws s3 rm s3://pathsgames-production --recursive && aws s3 rb s3://pathsgames-production
```

`moved.tf` covers the address changes for the production state (the shared resources gained a `count`) and can be deleted once `./tf.sh production plan` reports no changes after the migration.




# Version Control
- First version created with AI prompts
- **Document Version**: 0.38.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.7.0 | Website creation and domains configuration | March 26, 2026 |
    | 0.10.13 | Added cookies policy and csp_mode on terraform | March 20, 2026 |
    | 0.20.3 | Removed `cdn-cookieyes.com` / `cookieyes.com` from CSP allowlists (self-hosted consent, same-origin) | May 28, 2026 |
    | 0.38.1 | One module, one state per environment (production/test); shared ACM + CSP SSM; `tf.sh` wrapper; standardized tags | September 18, 2026 |
- **Last Updated**: September 18, 2026
- **Status**: Complete ✅


# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
