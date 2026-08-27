# Commands reference

Loaded on demand — not part of the session context. Read this file only when you actually
need to build, run, or test a specific component.

Python and Robot Framework commands ALWAYS run inside the virtualenv: `source .venv/bin/activate`.
All commands run from the working directory named in each section.

## Java backend (primary) — `code/backend/java/`

```bash
mvn clean install -DskipTests           # build without tests
mvn clean test                          # run all unit tests
mvn -pl core test -DskipITs             # core domain tests only (fastest)
mvn -pl ms-launcher spring-boot:run     # dev server (SQLite, public 8042 + admin 8044)
mvn -pl ms-launcher spring-boot:run -P prod -Dspring-boot.run.profiles=prod  # prod (PostgreSQL, public 8080, admin 8044)
curl -s http://localhost:8042/api/echo/status | python3 -m json.tool  # health check (public)
curl -s http://localhost:8044/api/admin/matches  # admin API on 8044 (401 without admin token)
```

Prod needs BOTH flags: `-P prod` puts adapter-postgres on the classpath,
`-Dspring-boot.run.profiles=prod` loads `application-prod.yml`.

Prod PostgreSQL on Docker:
```bash
docker run --name pathsgames-postgres -p 5432:5432 -e POSTGRES_DB=pathsgames \
  -e POSTGRES_USER=pathsgames -e POSTGRES_PASSWORD=pathsgames -d postgres:latest
```

## Python backend (alternative) — `code/backend/python/`

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m app.launcher                 # dev server (public 8042 + admin 8044, one process)
pytest tests
pytest tests --cov=app --cov-report=term-missing
```

## AWS serverless backend — `code/backend/aws/`

NEVER run these without explicit user confirmation.

```bash
/code/script/dev/aws_backend_deploy.sh
/code/script/dev/aws_backend_remove.sh
```

## Robot E2E tests — `code/tests/robot/`

```bash
# via scripts (from repo root)
code/script/dev/run_robots/run_robot_with_local_java.sh          # Java + SQLite
code/script/dev/run_robots/run_robot_with_local_java_postgres.sh # Java + PostgreSQL
code/script/dev/run_robots/run_robot_with_local_python.sh
code/script/dev/run_robots/run_robot_with_aws_serverless.sh

# manually (from code/tests/robot/)
robot --variablefile variables/dev.yaml --outputdir reports/ tests/
python -m robot --variablefile variables/dev.yaml tests/17_admin_crud  # single suite
```

Suite catalog and seed/report paths: `.claude/docs/robot-suites.md`.

## React admin frontend — `code/frontend/react-admin/`

```bash
npm install
npm run dev    # http://localhost:5172, proxies /api/* -> http://localhost:8044 (admin port)
npm run test
```

## Flask admin console (alternative) — `code/frontend/python-flask-admin/`

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                                        # http://localhost:5098 (admin port 8044)
ADMIN_BASE_URL=http://localhost:8044 python run.py   # explicit backend URL
pytest                                               # 35 unit tests (backend mocked)
pytest --cov=app --cov-report=term-missing
```

## Flask game frontend (alternative) — `code/frontend/python-flask-game/`

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                                   # http://localhost:5099 (mock data)
BASE_URL=http://localhost:8042 python run.py    # live backend mode
pytest                                          # 35 unit tests
pytest --cov=app --cov-report=term-missing
```

## SonarQube

```bash
code/script/dev/run_sonar_scanner_java.sh
```
