# Environments

Where Paths Games actually runs today, how the shared TLS certificate and CSP allowlists are
managed, and the planned per-version staging model that will replace today's single
production + test setup.

## 1. Current environments

| Environment | Backend | Frontend/website | Notes |
|---|---|---|---|
| **Local dev** | Java/Python on public `8042`, admin `8044`; SQLite at `~/.paths.games/database.sqlite` | `npm run dev` (Vite) for react-admin/react-game | Default profile for every backend; see [Architecture §2-3](./Architecture.md) |
| **AWS `dev`** | SAM stack, `code/scripts/test/aws/aws_backend_deploy.sh dev` | — | Developer-owned scratch stack |
| **AWS `test`** | SAM stack, `code/scripts/test/aws/aws_backend_deploy.sh test`; custom domain `api-test.paths.games` | react-game synced to `test.paths.games` via `code/scripts/test/aws/deploy_frontend-game_on_aws.sh` | Robot Framework's AWS target (`run_robot_with_aws_serverless.sh`); also reachable at `https://<api-id>.execute-api.us-east-2.amazonaws.com/test/...` |
| **AWS `prod`** | `sam deploy --config-env prod` from `code/backend/aws/` | production website `paths.games` (bucket `pathsgames-com`), deployed via the `website-deploy` GitHub workflow | Live production |

`code/scripts/test/aws/aws_backend_remove.sh [dev|test]` tears down a non-prod stack;
`code/scripts/test/aws/aws_check_status.sh` reads the CloudFormation stack outputs.

## 2. Certificate and shared infrastructure (today)

From [code/website/terraform-aws/README.md](../code/website/terraform-aws/README.md):
one Terraform module, one state per website environment (`production`, `test`), applied
through `./tf.sh <env> <command>`.

- **ACM certificate** is issued **once**, owned by `production`: domain `paths.games` with
  SANs `*.paths.games`, `pathsgames.com`, `*.pathsgames.com` — the wildcard is why every
  `<env>.paths.games` subdomain works without its own certificate. Every non-production
  environment looks it up read-only (`data "aws_acm_certificate"`, most recent `ISSUED` cert
  for that domain) instead of requesting its own.
- **API certificates**: an API Gateway custom domain needs a certificate in the API's own
  region. The `test` API (us-east-2, `api-test.paths.games`) uses a certificate made by hand in
  the console, not in Terraform, passed as `AWS_DOMAIN_CERTIFICATE_ARN_TEST`; the stage APIs
  (`alpha-api`, `beta-api`, production, all us-east-1) are covered by the wildcard above.
- **CSP allowlists** live in 5 SSM `StringList` parameters under `/paths-games/csp/`
  (`script-src`, `style-src`, `font-src`, `img-src`, `connect-src`), created once by
  `production` and read by every other environment; an environment can extend them locally
  via `csp_extra_domains` in its `environments/<env>.tfvars` (e.g. `test` adds the
  `api-test*.paths.games` hosts and `challenges.cloudflare.com` for react-game). See
  [Security §7](./Security.md).
- **Route53 DNS records are not managed by Terraform** — they are created by hand, both for
  production aliases and for `test.paths.games`.
- Terraform state: `s3://pathsgames-production-iac` (us-east-1) and
  `s3://pathsgames-test-iac` (us-east-2), S3-native locking (`use_lockfile`, Terraform
  ≥ 1.10).

## 3. Stage per version (plan)

Every version launch (step 42 of that version, per `wiki/VersionTemplate.md`)
creates a **new stage** with its own AWS stack, bucket and site — not a reuse of `dev`/`test`.
Stages are named after the Greek alphabet, one per major version:

| Stage | Version |
|---|---|
| alpha | V0 |
| beta | V1 |
| gamma | V2 |
| delta | V3 |
| epsilon | V4 |
| zeta | V5 |
| eta | V6 |

Domains: `<stage>.paths.games` (frontend) and `<stage>-api.paths.games` (backend API). The
**admin API never gets a `paths.games` DNS name** — on AWS the admin API is reached through
its raw API Gateway URL; the other backends expose it however their own infrastructure
provides (e.g. a direct host:port, not a DNS alias). Older stages are kept running or shut
down entirely at the owner's discretion — there is no automatic retirement policy.

This plan is not yet implemented: today's `dev`/`test`/`prod` AWS environments (§1) predate
it and are not stage-named. The first stage this model actually produces will be `alpha`, at
V0's launch (step 0.42).

## 4. Environment variables

All configuration for local/CI use is collected in the root `.env.example` (copied to `.env`,
never committed with real secrets). Groups, by name only — see the file itself for defaults
and comments:

| Group | Example variable names |
|---|---|
| Project | `VERSION` |
| Admin / JWT | `ADMIN_IP_WHITELIST`, `JWT_SECRET`, `ROBOT_VAR_ADMIN_TOKEN` |
| SonarQube | `SONAR_LOGIN_TOKEN_JAVA`, `SONAR_LOGIN_TOKEN` |
| Website deploy (AWS) | `AWS_S3_BUCKET_WEBSITE*`, `AWS_CLOUDFRONT_DISTRIBUTION_ID*` |
| AWS backend stack (test) | `AWS_ENVIRONMENT_NAME_TEST`, `AWS_STACK_NAME_TEST`, `AWS_REGION_TEST`, `AWS_REGION_PROD`, `AWS_CUSTOM_DOMAIN_TEST`, `AWS_DOMAIN_CERTIFICATE_ARN_TEST`, `AWS_DOMAIN_HOSTED_ZONE_TEST`, `AWS_CORS_ORIGINS_TEST` |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_BYPASS_TOKEN_TEST`, `TURNSTILE_BYPASS_TOKEN_ROBOT` |
| Rate limit / CSRF (v0.37.7; per-IP/per-guest defaults raised in v0.41.0) | `RATE_LIMIT_GUEST_PER_IP`, `RATE_LIMIT_MATCH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MATCH_PER_GUEST`, `RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS`, `CSRF_ENFORCED` (+ `AWS_*_TEST` mirrors) |
| Guest idle cleanup (v0.41.0) | `GUEST_CLEANUP_ENABLED`, `GUEST_CLEANUP_AGE_DAYS`, `GUEST_CLEANUP_MAX_PER_RUN`, `GUEST_CLEANUP_HOUR`, `GUEST_CLEANUP_MINUTE` (+ `AWS_*_TEST` mirrors) |
| Logging & snapshots (v0.41.1) | `LOG_WARN_ROWS` (default 5000), AWS `LOG_WARN_METADATA_KB` (default 300) — WARN-only size check; `SNAPSHOT_KEEP_PER_MATCH` (default 10, 0 = off) |
| Match export/import (v0.41.4) | `MATCH_EXPORT_MAX_BYTES` (default 5000000; Java `game.match.export.max-bytes`, AWS in `template/match.yaml` with `APP_VERSION`) |
| AWS admin allow-list (v0.41.0) | `ADMIN_IP_WHITELIST`, `AWS_ADMIN_IP_EMPTY_MEANS_TEST`, `AWS_ADMIN_API_URL_TEST` |
| Test-data lifecycle | `AWS_ROBOT_TEST_DATA_TTL_HOURS_TEST` |
| Docker Hub | `DOCKERHUB_USERNAME_TEST`, `DOCKERHUB_IMAGE_TEST`, `DOCKERHUB_IMAGE_TAG_TEST`, `DOCKERHUB_TOKEN_TEST` |
| EC2 test servers (Java, Python) | `EC2_KEY_NAME_TEST_EC2*`, `DB_NAME_TEST_EC2*`, `PUBLIC_PORT_TEST_EC2*`, `ADMIN_PORT_TEST_EC2*`, `ROUTE53_RECORD_NAME_TEST_EC2*`, `ENABLE_CLOUDFRONT_TEST_EC2*`, and their `_PY` counterparts |
| Stage deploy (v0.41.0, alpha/beta/prod) | `AWS_JWT_SECRET_<S>`, `AWS_TURNSTILE_SECRET_KEY_<S>`, `AWS_CUSTOM_DOMAIN_<S>`, `AWS_DOMAIN_CERTIFICATE_ARN_<S>`, `AWS_DOMAIN_HOSTED_ZONE_<S>`, `AWS_CORS_ORIGINS_<S>`, `AWS_ADMIN_IP_WHITELIST_<S>` — `<S>` = `ALPHA`/`BETA`/`PROD`, read by `aws_backend_deploy_stage.sh` |

**Rule:** every parameter has a code default (Spring `${VAR:default}` placeholders in
`application.yml`, equivalent defaults in Python `config.py` and the AWS Lambda `os.environ`
helpers) — `.env`/`.env.example` files are optional convenience for local/CI runs, never a
requirement for the code to start.

**Env rule (v0.41.0, all backends):** only `dev`, `development` and `test` count as
dev/test — anything else (`prod`, `production`, `alpha`, `beta`, unset) is treated as
production, gating the Turnstile bypass, the committed JWT default and (Python) the CORS
default and `/docs`/`/redoc`/`/openapi.json`. Java reads `game.server.env` (set by the Spring
profile), not the former `game.env`/`APP_ENV`.

**Moving a match between servers (v0.41.4).** On the source server S an admin exports the match
from its latest time-end snapshot (the match is paused, restored, resumed around the export). On
the target T the admin imports the file (dry-run first). The story is bundled: absent on T it is
imported, identical it is reused, different it is refused (`STORY_DIFFERS`) unless `storyMode` is
`KEEP` or `REPLACE`. The environments may use different backends (Java, Python, AWS).

## 5. Test ACM certificate — moved to V1 step 41

Certificates stay as described in §2: the websites and the stage APIs share the wildcard
owned by the production website state, the test API uses its hand-made us-east-2 certificate.
Known limit: the shared certificate's life is tied to the production website state. Whether
every stage keeps sharing one wildcard or gets its own certificate is decided in V1 step 41.

## 6. Environment variables refactor — planned in V1

The `.env.example` groups in §4 have grown organically (per-environment `_TEST` suffixes,
per-server `_EC2`/`_EC2_PY` suffixes) and are due a naming/structure pass once V1 introduces
its own environment needs (SSO credentials, additional backends). Deferred, not scoped yet.

# Version Control
- **Document Version**: 0.41.4

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared map of where each version runs | September 25, 2026 |
  | 0.41.0 | Documented today's certificates; the harder decision waits for V1; new security/guest keys | September 28, 2026 |
  | 0.41.1 | New logging and snapshot size keys | September 29, 2026 |
  | 0.41.4 | Match move between servers, export size key | October 1, 2026 |

- **Last Updated**: October 1, 2026 (v0.41.4)

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
