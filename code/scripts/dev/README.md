# Paths Games — Dev & Test Scripts

Helper scripts that build, run, and test Paths Games components without going through the
full CI pipeline. This file documents two things:

1. **Part 1** — the Docker test-image build scripts, which live in `code/scripts/test/`
   (not in `dev/`), and the buildx/BuildKit disk-usage fix applied to them.
2. **Part 2** — every script and folder under `code/scripts/dev/` itself.

`code/scripts/` also has a `prod/` sibling (`deploy_website_on_aws.sh`, production website
deploy — not covered here) and the rest of `test/` (AWS SAM deploy, EC2 lifecycle — covered
briefly in Part 1, in depth in `.claude/docs/commands.md`).

## Part 1 — Docker test-image builds (`code/scripts/test/`)

These two scripts are **not** in `code/scripts/dev/` — they live in `code/scripts/test/`
because they build and push the images used by the shared **TEST** environment (the EC2
instances under `code/scripts/test/aws_ec2_with_*_docker/`).

| Script | Pushes | Dockerfile / build context |
|---|---|---|
| `build_docker_java_test_and_push.sh` | `${DOCKERHUB_USERNAME_TEST}/${DOCKERHUB_IMAGE_TEST}:${DOCKERHUB_IMAGE_TAG_TEST:-test}` | `code/backend/java/Dockerfile`, context `code/backend/java/` |
| `build_docker_python_test_and_push.sh` | `${DOCKERHUB_USERNAME_TEST}/${DOCKERHUB_IMAGE_TEST}:${DOCKERHUB_IMAGE_TAG_PYTHON_TEST:-test-python}` | `code/backend/python/Dockerfile`, context `code/backend/python/` |

On this project's root `.env`, that resolves to `pathsgames/pathsgames:test` (Java) and
`pathsgames/pathsgames:test-python` (Python); the script's own fallback, if
`DOCKERHUB_IMAGE_TEST` is unset, is `pathsgames-backend`.

Both scripts:
- Load the root `.env`, then `docker buildx build --platform linux/amd64 … --push` — always
  `linux/amd64` (`BUILD_PLATFORM`) because the EC2 `t3` test instances are amd64, regardless
  of the host building the image (e.g. Apple Silicon).
- Log in to Docker Hub with `DOCKERHUB_TOKEN_TEST` (user `DOCKERHUB_USERNAME_TEST`).
- Accept `--dry-run`, which prints the exact `docker login` / `buildx` commands without
  running them.
- Read `BUILDX_BUILDER`, `BUILDKITD_CONFIG`, `BACKEND_IMAGE` and the `DOCKERHUB_*` vars from
  the root `.env` / environment (defaults in the script).

```bash
code/scripts/test/build_docker_java_test_and_push.sh   [--dry-run]
code/scripts/test/build_docker_python_test_and_push.sh [--dry-run]
```

After pushing: `aws_ec2_with_java_docker/redeploy.sh` (or `_python_docker/redeploy.sh`) rolls
the image onto a running instance; `start.sh` launches a fresh one.

### The buildx builder, and why disk usage was growing

Both scripts build with `docker buildx create --use --name pathsgames-builder
--buildkitd-config buildkitd.toml` — the **`docker-container` driver**. Unlike the default
driver (which reuses the host's Docker engine), this starts a *separate* BuildKit daemon
**inside a container** (`buildx_buildkit_pathsgames-builder0`, image
`moby/buildkit:buildx-stable-1`), with its own layer cache in the Docker volume
`buildx_buildkit_pathsgames-builder0_state`. That cache is invisible to `docker images`,
`docker system df` and `docker system prune` — none of them look inside buildx's own
volumes — so without GC configuration it silently grew to ~22 GB on the dev machine.

### Fix applied

1. **`code/scripts/test/buildkitd.toml`** — BuildKit daemon config, passed at builder
   creation (`docker buildx create --buildkitd-config`). Enables GC with
   `reservedSpace=2GB`, `maxUsedSpace=6GB`, `minFreeSpace=10GB`, `keepDuration=168h`.
   It only takes effect **when the builder is created** — not on an already-running one.
2. **`trap cleanup_builder EXIT`** — both scripts register this right after creating the
   builder. `docker buildx rm --force "$BUILDX_BUILDER"` then runs on every exit path
   (success, failure, Ctrl-C), removing the builder, its container **and** its `_state`
   cache volume. Only `kill -9` skips the trap; `buildkitd.toml`'s GC is the safety net for
   that case. Trade-off: every run recreates the builder from scratch (re-pulls base images,
   re-runs `mvn dependency:go-offline`) — about 1–3 minutes slower, but disk stays clean.
3. **`.dockerignore`** added in `code/backend/java/` and `code/backend/python/` to keep the
   buildx context small: java excludes `**/target/`, `.agents/`, `code/`, `database.sqlite*`,
   `README.md`…; python excludes `.venv/`, `__pycache__/`, `.pytest_cache/`, `.scannerwork/`,
   `tests/`, `.env*`, the local DB and coverage files.
4. **Manual one-off cleanup** of an old builder (if one is still lying around from before
   this fix):
   ```bash
   docker buildx rm pathsgames-builder
   docker buildx ls               # verify it's gone
   docker volume ls | grep buildx # verify the _state volume is gone
   ```

### Other content of `code/scripts/test/`

| Path | What it is |
|---|---|
| `aws/` | `aws_backend_deploy.sh` / `aws_backend_remove.sh` (SAM/CloudFormation deploy & teardown, `dev`/`test`), `aws_check_status.sh` (stack + API Gateway health check), `deploy_frontend-game_on_aws.sh` (react-game → S3 + CloudFront invalidation, test bucket). |
| `aws_ec2_with_java_docker/` | `start.sh` (launch EC2 + Postgres + Java container), `redeploy.sh` (pull latest `:test` image onto the running instance), `stop.sh` (destroy instance/SG/DNS), `run_stress_ec2.sh` (runs `code/tests/stress/run_stress.sh` against it). |
| `aws_ec2_with_python_docker/` | Python twin of the above (server3): `start.sh`, `redeploy.sh` (`:test-python`), `stop.sh`, `run_stress_ec2.sh`. |
| `aws_tags.txt` | Tag template (`Key=Value` per line, `${NAME}`/`${ENV_TAG}`/`${LANGUAGE}`/`${PROJECT_SUFFIX}` placeholders) applied to every taggable resource the two `start.sh` scripts create; `Project` resolves to `Paths.games.aws.<env>.ec2.docker.java` / `Paths.games.aws.<env>.ec2.docker.python`. |

## Part 2 — `code/scripts/dev/`

```
code/scripts/dev/
├── aws/                  # AWS test-data helpers (not deploy — see test/aws/ for that)
├── bump-version.sh       # interactive project-wide version bump
├── image-finder/         # two standalone image-search mini-tools (content authoring)
├── run_all_unit_tests.sh # every backend + frontend unit suite, one aggregate report
├── run_robot_everywhere.sh # runs all 4 run_robots/*.sh in sequence, one summary
├── run_robot_results/    # generated logs only (UNIT_*, per-env robot run logs)
├── run_robots/           # per-backend Robot E2E launcher scripts
├── sonar/                # SonarQube scan scripts
└── starter/              # start/stop scripts for local dev servers
```

### `aws/`

Test-data maintenance for the AWS backend — not deployment (that's `code/scripts/test/aws/`).

| Script | Purpose |
|---|---|
| `purge_robot_test_data.py` | Deletes Robot Framework leftovers from the DynamoDB test table: seed stories, the suite's imported demo stories, `robottest*`-marked matches/guests, and (with `--orphans`) `CHARACTER#…` rows stranded by `POST /api/dev/cleanup` (that endpoint deletes only the match's `METADATA` item, not the whole partition). Reads its identifying rules from the same source files as the seed/import code, so it can't drift. `--dry` previews only; refuses a table name that looks like production. |
| `purge_robot_test_data.sh` | Thin wrapper: `python3 purge_robot_test_data.py "$@"`. |
| `aws_configure_local_socat.sh` | Reads the API Gateway URL for the test stack from CloudFormation. Its own header notes host-file aliasing doesn't work against API Gateway (SNI/Host-header required) — scripts should use the `AWS_API_URL`-style env var directly instead. |

### `bump-version.sh`

Interactive script (prompts for the new version) that rewrites the project version across
`pom.xml` files, Spring `application*.yml`, `pyproject.toml`, `app/config.py`, the website
footer `index.html`, the AWS `echo` Lambda handler, and the two frontend footer components.
Per this repo's hard rule, run it **only when explicitly asked** — never as a side effect of
another task.

```bash
code/scripts/dev/bump-version.sh
```

### `image-finder/`

Two unrelated, standalone Flask mini-apps used while authoring story content (finding
illustration source images) — not part of the build/test pipeline for any backend or
frontend. Each is self-contained: its own `app.py`, `requirements.txt`, and a `starter.sh`
that creates/reuses the repo's `.venv`, installs its `requirements.txt`, and runs the app.

| Folder | What it searches | Notes |
|---|---|---|
| `game-icons/` | [game-icons.net](https://game-icons.net/) | Also has a CLI, `search_agent.py`, with its own (Italian) README; outputs JSON with `imageUrl`/`linkCopyright`. |
| `unsplash/` | [Unsplash](https://unsplash.com/) | Needs `UNSPLASH_ACCESS_KEY` — set in `config.py`, as an env var, or in a local `.env` in that folder. |

```bash
code/scripts/dev/image-finder/game-icons/starter.sh   # http://localhost:5000
code/scripts/dev/image-finder/unsplash/starter.sh
```

### `run_all_unit_tests.sh`

Runs every **unit**-test suite in the repo (not the Robot E2E suites) and prints one
aggregate pass/fail table: Java (`mvn test`), Python (`pytest`, `code/backend/python`), AWS
(`pytest`, `code/backend/aws`), and both frontends (`vitest` in `react-admin`/`react-game`).
Parses each suite's JUnit/Jest-JSON output to sum totals, writes per-suite logs to
`run_robot_results/UNIT_<suite>_<timestamp>.log`, and exits non-zero if anything failed.

```bash
code/scripts/dev/run_all_unit_tests.sh                # all suites
code/scripts/dev/run_all_unit_tests.sh --only java,python
```

### `run_robot_everywhere.sh`

Runs all four `run_robots/*.sh` scripts below in sequence (AWS, local Java+Postgres, local
Java+SQLite, local Python), tees each run's output into `run_robot_results/<ENV>_<ts>.log`,
and prints one summary table (status/exit code/duration per environment). Exits `2` if any
environment failed.

```bash
code/scripts/dev/run_robot_everywhere.sh
```

### `run_robot_results/`

Output only — no scripts. Holds the logs written by `run_all_unit_tests.sh` (`UNIT_*.log`)
and `run_robot_everywhere.sh` (`<ENV>_<timestamp>.log`); each run clears its own prefix
before writing new logs. The Robot HTML/XML reports themselves stay under
`code/tests/robot/reports-*/`, per suite — see `.claude/docs/robot-suites.md`.

### `run_robots/`

The four backend-specific Robot Framework launchers (build/start the backend, run the full
suite, clean up, tear down). Already documented in full in `.claude/docs/commands.md` and
`.claude/docs/robot-suites.md` — summary only, to avoid duplicating/contradicting those:

| Script | Backend | Report dir |
|---|---|---|
| `run_robot_with_local_java.sh` | Java + SQLite (dev profile) | `code/tests/robot/reports-local-java/` |
| `run_robot_with_local_java_postgres.sh` | Java + PostgreSQL (prod profile; can spin up its own Docker Postgres) | `code/tests/robot/reports-local-java-postgres/` |
| `run_robot_with_local_python.sh` | Python (FastAPI) | `code/tests/robot/reports-local-python/` |
| `run_robot_with_aws_serverless.sh` | AWS (deployed test stack) | `code/tests/robot/reports-aws/` |

All four seed dev data first, run `robot` against `code/tests/robot/tests/`, then call
`POST /api/dev/cleanup` (and, for AWS, `aws/purge_robot_test_data.py --orphans` as a
second-pass sweep) so `robottest*` rows don't accumulate — win or lose.

### `sonar/`

SonarQube/SonarCloud analysis. There is no `sonar-project.properties` file anywhere in the
repo: Java's scan config lives in `code/backend/java/pom.xml` (`sonar.organization`,
`sonar.host.url`, `sonar.projectKey`, `sonar.cpd.exclusions` properties + the
`sonar-maven-plugin`); the JS/Python scans pass all `-Dsonar.*` config as CLI flags to
`npx sonarqube-scanner`, clearing `.scannerwork/` first each time.

| Script | Scope | Auth |
|---|---|---|
| `run_sonar_scanner_java.sh` | Java only — `mvn clean package && mvn sonar:sonar -Dsonar.login=…` (legacy `-Dsonar.login` flag) | `SONAR_LOGIN_TOKEN_JAVA` |
| `run_sonar_scanner.sh` | Multi-target: `java`, `python`, `react-admin`, `react-game`, or `all` (default) — runs each component's tests with coverage, then scans | `SONAR_LOGIN_TOKEN` (`SONAR_LOGIN_TOKEN_JAVA` for the `java` target) |

`run_sonar_scanner.sh` defaults `SONAR_HOST_URL` to `sonarcloud.io` and
`SONAR_ORGANIZATION` to `gamespaths`. It also defines a `run_aws_lambda` function targeting
`code/backend/aws-lambda` (a path that doesn't exist in this repo — the backend is at
`code/backend/aws`); that function is not wired into any of the script's CLI targets
(`all|java|python|react-admin|react-game`), so it is effectively dead code and does not run.

```bash
code/scripts/dev/sonar/run_sonar_scanner.sh [all|java|python|react-admin|react-game]
code/scripts/dev/sonar/run_sonar_scanner_java.sh
```

### `starter/`

Local dev process management — start one component at a time (or all three Java-stack ones
together) and kill whatever is holding their ports first.

| Script | Starts | Port | Kills first |
|---|---|---|---|
| `start_java_sqlite.sh` | Java backend, dev profile (SQLite) | 8042 | 8042 |
| `start_python.sh` | Python backend (venv + seed data) | 8042 | 8042 |
| `start_react_admin.sh` | React admin (`npm run dev`) | 5172 | 5172 |
| `start_react_game.sh` | React game (`npm run dev`) | 5174 | 5174 |
| `start_all_java_sqlite.sh` | The three above, in parallel (`&` + `wait`) | 8042/5172/5174 | — (delegates to each) |
| `kill_all.sh` | Nothing — just frees 8042, 5172, 5174 | — | 8042, 5172, 5174 |

None of these start the admin connector (8044) explicitly — it comes up automatically as
part of the same Java/Python process (see `.claude/docs/commands.md`). `kill_all.sh` does
not free 8044.

```bash
code/scripts/dev/starter/start_all_java_sqlite.sh   # Java + both React frontends
code/scripts/dev/starter/kill_all.sh                # stop everything above
```

## See also

- `.claude/docs/commands.md` — build/run/test commands per component, including the
  `run_robots/*` and `sonar/*` invocations summarized above.
- `.claude/docs/robot-suites.md` — Robot suite catalog, seed files, report paths.
- `code/backend/java/README.md`, `code/backend/python/README.md` — component docs, each
  with their own "build & push the test image" section linking back to Part 1 above.
- `code/tests/stress/` — the k6 stress-test scripts invoked by `run_stress_ec2.sh`.



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
