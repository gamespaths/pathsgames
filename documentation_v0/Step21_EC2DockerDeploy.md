# Step 21 — EC2 Docker Deploy (Test Environment)

## Goal

Provide a reproducible, scriptable way to run the Java backend on a test EC2 instance
using a pre-built Docker image pulled from Docker Hub, without cloning the repo or running
Maven on the instance.

This step also covers three bug fixes delivered in the same session:

- **CORS varargs fix** in `WebConfig.java`
- **`env` field** in `/api/echo/status` (Java `test`/`prod` profiles + AWS Lambda)
- **Multi-language text import fix** in `StoryImportService`

---

## Scripts

All scripts live under `code/scripts/test/` (build) and
`code/scripts/test/aws_ec2_with_java_docker/` (lifecycle).

| Script | Purpose |
|--------|---------|
| `code/scripts/test/build_docker_test_and_push.sh` | Build the Java image locally for `linux/amd64` and push to Docker Hub with tag `:test` |
| `aws_ec2_with_java_docker/start.sh` | Create SG + launch EC2 instance; user-data pulls the image and starts two containers |
| `aws_ec2_with_java_docker/redeploy.sh` | On a running instance: update env-file, `docker pull`, restart only the backend container |
| `aws_ec2_with_java_docker/stop.sh` | Terminate instance, delete SG, delete Route53 record (and CloudFront distribution if present) |

---

## Configuration

All variables are read from the **project root `.env`** file (not a local `.env` inside the
scripts folder). Shared variables reused from other scripts keep their existing names; EC2-specific
variables carry the `_TEST_EC2` suffix.

Key variables:

| Variable | Description |
|----------|-------------|
| `DOCKERHUB_USERNAME_TEST` | Docker Hub account name |
| `DOCKERHUB_IMAGE_TEST` | Image repository name (default: `pathsgames-backend`) |
| `DOCKERHUB_IMAGE_TAG_TEST` | Image tag (default: `test`) |
| `DOCKERHUB_TOKEN_TEST` | Docker Hub access token — used only by `build_docker_test_and_push.sh` on the local machine |
| `EC2_KEY_NAME_TEST_EC2` | EC2 SSH key pair name |
| `EC2_INSTANCE_TYPE_TEST_EC2` | Instance type (default: `t3.small`) |
| `DB_PASSWORD_TEST_EC2` | PostgreSQL password injected into the backend env-file |
| `JWT_SECRET` | JWT secret shared with the SAM deploy |
| `AWS_REGION_TEST` | AWS region (reused) |
| `AWS_ENVIRONMENT_NAME_TEST` | Value passed as `ENVIRONMENT` to the container; appears in `/api/echo/status` as the `env` field (reused from SAM deploy) |
| `ROUTE53_RECORD_NAME_TEST_EC2` | DNS record name for the API (e.g. `api-test-server2.paths.games`) |
| `AWS_DOMAIN_HOSTED_ZONE_TEST` | Route53 hosted zone ID (reused; leave empty to skip DNS) |
| `ENABLE_CLOUDFRONT_TEST_EC2` | `true` to front the public API (8042) with CloudFront; default `false` |
| `CLOUDFRONT_DOMAIN_CERTIFICATE_ARN_TEST_EC2` | ACM cert ARN — **must be in `us-east-1`** |

---

## Build — `build_docker_test_and_push.sh`

Runs on the **developer's machine**, not on EC2.

1. Loads the root `.env`.
2. Uses `docker buildx` with `--platform linux/amd64` so the image runs on `t3` instances
   regardless of host architecture (e.g. Apple Silicon).
3. Reuses the existing multi-stage `Dockerfile` at `code/backend/java/Dockerfile` — Maven
   compiles inside the build container, producing a minimal JRE image.
4. Pushes the image to Docker Hub as `<DOCKERHUB_USERNAME>/<DOCKERHUB_IMAGE>:<IMAGE_TAG>`.
5. Docker Hub login uses `DOCKERHUB_TOKEN_TEST` (access token, not password).

```bash
# Build and push
cd <repo root>
code/scripts/test/build_docker_test_and_push.sh

# Preview only (no push)
code/scripts/test/build_docker_test_and_push.sh --dry-run
```

---

## Start — `start.sh`

**Idempotent**: if an instance tagged with `INSTANCE_NAME` already exists (in any
non-terminated state), the script prints its ID and IP and **exits immediately** (no-op).
Image updates on a running instance are handled by `redeploy.sh`.

### What start.sh does (first run)

1. Detects the caller's public IP (used for SSH and admin port rules).
2. Creates (or reuses) a security group with:
   - TCP 22 → caller IP only (SSH)
   - TCP 8042 → `0.0.0.0/0` (public API — open to all)
   - TCP 8044 → caller IP only (admin API — owner-locked)
3. Finds the latest Ubuntu 24.04 LTS AMI in the target region.
4. Generates a **user-data** script that runs on first boot:
   - Installs Docker (official repo, no Compose plugin needed).
   - Creates a Docker bridge network `pathsgames-net`.
   - Runs `postgres:16-alpine` as container `pathsgames-postgres`.
   - Writes `/opt/pathsgames/backend.env` with DB credentials, JWT secret, and port config.
   - Runs `docker pull <BACKEND_IMAGE>` (public Docker Hub repo — no login required on EC2).
   - Runs the backend container, publishing ports 8042 (public) and 8044 (admin).
5. Launches the EC2 instance and saves state to `.state`.
6. Optionally creates a Route53 record (see DNS/CloudFront below).

```bash
cd code/scripts/test/aws_ec2_with_java_docker
./start.sh           # launch (no-op if already running)
./start.sh --dry-run # print user-data only
```

---

## Redeploy — `redeploy.sh`

Used to roll a new image onto an **already-running** instance without touching PostgreSQL.

1. Loads root `.env` + `.state` (for the instance IP).
2. Resolves the live public IP via AWS API (robust to elastic IP changes).
3. Writes a fresh `/opt/pathsgames/backend.env` over SSH (secrets sent via stdin, never on
   the command line).
4. On the instance: `docker pull` → `docker rm -f pathsgames-backend` → `docker run`.
   PostgreSQL container `pathsgames-postgres` is left untouched — data persists.
5. Prompts for confirmation unless `--force` is passed.

```bash
./redeploy.sh          # with confirmation prompt
./redeploy.sh --force  # skip prompt
```

**Typical workflow:**

```
build_docker_test_and_push.sh   # 1. build + push new image locally
aws_ec2_with_java_docker/redeploy.sh  # 2. roll it onto the running EC2
```

---

## Stop — `stop.sh`

Destroys all resources created by `start.sh`, reading state from `.state`:

1. If `CLOUDFRONT_DIST_ID` is set: deletes the Route53 alias, disables the distribution,
   waits for propagation (~15 min), then deletes the distribution.
2. Otherwise, deletes the direct Route53 A record (if present).
3. Terminates the EC2 instance (waits for `terminated` state).
4. Deletes the security group (retries up to 10 times if still attached).
5. Removes `.state`.

---

## DNS and CloudFront

`ROUTE53_RECORD_NAME_TEST_EC2` is the single user-facing hostname. Its type depends on
`ENABLE_CLOUDFRONT_TEST_EC2`:

| `ENABLE_CLOUDFRONT` | Route53 record type | Target |
|---------------------|--------------------|--------|
| `false` (default) | A (direct) | EC2 public IP |
| `true` | A alias | CloudFront distribution domain |

When CloudFront is enabled:

- The distribution origin is the EC2 **public DNS name** (not the IP), connecting on port
  8042 via HTTP. This avoids DNS loop issues.
- The ACM certificate **must be in `us-east-1`** regardless of the EC2 region.
- CloudFront fronts **only the public API** (port 8042). The admin port 8044 stays
  SG-locked to the owner IP and is reached via SSH tunnel:

```bash
ssh -i ~/.ssh/<key>.pem -L 8044:localhost:8044 ubuntu@<EC2-IP>
# then: curl http://localhost:8044/api/admin/matches
```

- CloudFront takes approximately 5-15 minutes to deploy globally before HTTPS becomes
  available. The `start.sh` output notes this.

---

## Spring Profile `test` and env-file

The backend container runs with `SPRING_PROFILES_ACTIVE=test`, loading
`application-test.yml` (PostgreSQL dialect + CORS origins including
`https://test.paths.games` and `https://test2.paths.games`).

`/opt/pathsgames/backend.env` contents (injected by `start.sh` / `redeploy.sh`):

```
SPRING_PROFILES_ACTIVE=test
ENVIRONMENT=<AWS_ENVIRONMENT_NAME_TEST>
DB_HOST=pathsgames-postgres
DB_PORT=5432
DB_NAME=<DB_NAME_TEST_EC2>
DB_USERNAME=<DB_USERNAME_TEST_EC2>
DB_PASSWORD=<DB_PASSWORD_TEST_EC2>
JWT_SECRET=<JWT_SECRET>
ADMIN_PORT=8044
```

---

## Related fixes delivered in this step

### CORS fix — `WebConfig.java`

**File:** `code/backend/java/ms-launcher/src/main/java/games/paths/launcher/config/WebConfig.java`

**Problem:** `allowedOriginPatterns()` was called with a single string containing
comma-separated origins. Spring interprets this as one literal pattern, so no origin
matched and the `Access-Control-Allow-Origin` header was never emitted.

**Fix:** the list is now spread with `allowedOrigins.toArray(new String[0])` so each
origin is a separate argument:

```java
.allowedOriginPatterns(allowedOrigins.toArray(new String[0]))
```

The allowed origins are configured per Spring profile:
- `application-test.yml`: `https://test.paths.games`, `https://test2.paths.games`, and
  local development origins (`localhost:3000`, `localhost:5172`, etc.)
- `application-prod.yml`: `https://paths.games`, `https://www.paths.games`,
  `https://pathsgames.com`

---

### Echo `env` field

`GET /api/echo/status` returns a `properties.env` field so callers can identify the
deployment environment without needing to inspect headers or configuration.

**Java** (`application-test.yml` / `application-prod.yml`):

```yaml
game:
  server:
    env: ${ENVIRONMENT:test}      # test profile default
    env: ${ENVIRONMENT:production} # prod profile default
```

The value is overridden by the `ENVIRONMENT` environment variable, which `start.sh` /
`redeploy.sh` derive from `AWS_ENVIRONMENT_NAME_TEST` — the same variable used by the
SAM deploy as its `Environment` parameter, keeping both environments in sync.

**AWS Lambda** (`code/backend/aws/lambda/echo/handler.py`):

```python
"env": os.environ.get("ENV", "dev"),
```

The `ENV` variable is injected by `template/echo.yaml` as `!Ref Environment`.

---

### Multi-language text import fix — `StoryImportService`

**File:** `code/backend/java/core/src/main/java/games/paths/core/service/story/StoryImportService.java`
**Method:** `importTexts`

**Problem:** Story JSON files use the same surrogate `id` for all language variants of
the same logical text (same `idText`, different `lang`). The PK on `list_texts` is
`(id, id_story)`, so reusing the same surrogate id for two rows with the same `id_story`
caused a `NonUniqueObjectException` on PostgreSQL (duplicate PK constraint violation).

**Fix:** a two-pass algorithm de-collides surrogate ids before persisting:

1. First pass: resolve all surrogate ids and find `maxId`.
2. Second pass: if a surrogate id is `null` or already used, assign `++maxId`.

The **business key** `(idText, lang)` — which has a unique constraint in the DB and is
what all FKs reference — is preserved unchanged. No FK references the surrogate PK,
so reassigning it is safe.

---

## Verification

```bash
# After start.sh or redeploy.sh (give ~40s for Spring boot):
curl http://<EC2-IP>:8042/api/echo/status
# Expected: {"status":"UP","properties":{"env":"test",...}}

curl http://<EC2-IP>:8042/api/echo/status | python3 -m json.tool

# Admin endpoint (via SSH tunnel or from owner IP):
curl http://localhost:8044/api/admin/matches
# Expected: 401 (up, requires admin token)
```

---

## Document Version

| Version | Description | Date |
|---------|-------------|------|
| 0.21.0 | Initial version | June 5, 2026 |
