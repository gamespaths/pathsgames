# Paths Games V1 - Step 08: Configure Environments and CI

This document defines the "environment configuration and CI/CD pipelines" for **Paths Games**, covering GitHub Actions workflows, Docker image publishing, and static website deployment.

  - ✅ Define environment-specific configurations

  - ✅ Separate credentials and secrets

  - ✅ Choose CI system

  - ✅ Define build pipelines

  - ✅ Run placeholder automated tests

  - ✅ Fail the pipeline on errors

  - ✅ Connect CI to the main branch


## 1. Environment-Specific Configurations

The project uses **Spring Boot profiles** to separate environment settings. Each profile activates different database adapters, ports, and logging levels.

| Environment | Profile | Port | Database | Config file |
|-------------|---------|------|----------|-------------|
| Development | `dev` (default) | 8042 | SQLite | `application-dev.yml` |
| Production | `prod` | 8080 | PostgreSQL | `application-prod.yml` |

Environment variables override properties at runtime:
- `SPRING_PROFILES_ACTIVE` — selects the active profile
- `SERVER_PORT` — overrides the default port
- Database credentials are injected via environment variables (*never hardcoded*)

### 1.1 Docker Environment

Build the docker image and push to DockerHub

```bash
# Login to DockerHub
docker login -u utente

# Build the image
cd code/backend
docker build -t pathsgames/pathsgames:latest .

# Tag with version (match POM version)
docker tag pathsgames/pathsgames:latest pathsgames/pathsgames:0.8.0 #update version every time

# Push both tags
docker push pathsgames/pathsgames
docker push pathsgames/pathsgames:0.8.0 #update version every time
```

The Docker image runs with the `prod` profile by default. All sensitive configuration is passed through environment variables at container startup:

```bash
# Run docker image
docker run -d \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/pathsgames \
  -e SPRING_DATASOURCE_USERNAME=dbuser \
  -e SPRING_DATASOURCE_PASSWORD=dbpass \
  -p 8042:8080 \
  pathsgames/pathsgames:latest
```


## 2. Credentials and Secrets

All secrets are stored in **GitHub Actions Secrets** (repository level). No credentials are committed to the repository.

- `DockerHub Token` on [docker security page](https://hub.docker.com/settings/security)
    - on "New Access Token" with `github-actions-pathsgames` 
    - with "Read & Write" permission
    - copy and save DOCKERHUB_TOKEN on GitHub
- `AWS access keys` on [AWS console](https://console.aws.amazon.com/iam/) 
    - on AMI service, create a new user 
    - on "Security credentials" to create a new "Access keys"
    - with type "Third-party service"
    - copy the AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY values
    - **Enable least-privilege permissions** Best practice is to create an IAM user with only minimum permission (s3:PutObject, s3:DeleteObject, s3:ListBucket on bucket and cloudfront:CreateInvalidation on distribution).
- `Sonar token` on [SonarCloud console](https://sonarcloud.io/account/security)
    - "Generate Token" section to generate a valid token 
- To configure keys values on GitHub on settings page
    - on "Secrets and variables" section
    - on "Actions" view use "New repository secret" past new secrets values.


### 2.1 Required GitHub Secrets
| Secret | Purpose | Used by |
|--------|---------|---------|
| `DOCKERHUB_USERNAME` | DockerHub account username | Backend pipeline |
| `DOCKERHUB_TOKEN` | DockerHub access token (not password) | Backend pipeline |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key for S3/CloudFront | Website pipeline |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | Website pipeline |
| `AWS_REGION` | AWS region (`us-east-1`) | Website pipeline |
| `S3_BUCKET_WEBSITE` | S3 bucket name for website (`pathsgames-com`) | Website pipeline |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID for cache invalidation | Website pipeline |
| `SONAR_TOKEN` | SonarCloud authentication token | SonarQube pipeline |
| `SONAR_HOST_URL` | SonarCloud URL (`https://sonarcloud.io`) | SonarQube pipeline |

### 2.2 Future Secrets (for React frontend)

| Secret | Purpose | Used by |
|--------|---------|---------|
| `S3_BUCKET_FRONTEND` | S3 bucket name for React app | Frontend pipeline (future) |
| `CLOUDFRONT_DISTRIBUTION_ID_FRONTEND` | CloudFront distribution ID for frontend | Frontend pipeline (future) |


## 3. CI System: GitHub Actions

**GitHub Actions** is the chosen CI/CD system. Workflows are defined in `.github/workflows/` and trigger automatically on push and pull request events.

### 3.1 Why GitHub Actions
- Native integration with the GitHub repository
- Free tier sufficient for open-source projects (unlimited minutes on public repos)
- Supports custom runners if needed in the future
- Matrix builds for testing across environments
- Built-in secret management

### 3.2 Workflow Overview

| Workflow file | Trigger | Purpose |
|---------------|---------|---------|
| `backend-ci.yml` | Push/PR on `code/backend/**` | Build, test, and publish Docker image |
| `website-deploy.yml` | Push on `code/website/html/**` | Deploy static website to S3 + invalidate CloudFront |
| `sonarqube.yml` | Push/PR on `code/backend/**` | Code quality analysis, coverage, and security scan |
| `frontend-deploy.yml` | *(future)* Push on `code/frontend/**` | Build React app and deploy to S3 |

### 3.3 Branch Strategy for CI

| Branch | Backend CI | Website Deploy | SonarQube | Notes |
|--------|-----------|----------------|-----------|-------|
| `master` | Build + Test + Docker push (`:latest` + `:x.y.z`) | Deploy to production S3 | ✅ Full scan | Production releases |
| `develop` | Build + Test + Docker push (`:dev`) | — | ✅ Full scan | Development builds |
| `release/*` | Build + Test + Docker push (`:rc`) | — | — | Release candidates |
| `feature/*` | Build + Test only | — | — | No artifact publishing |
| Pull requests | Build + Test only | — | ✅ PR analysis | Validation gate |


## 4. Build Pipelines

### 4.1 Backend Pipeline (`backend-ci.yml`)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│ Checkout │───►│  Build   │───►│  Test    │───►│ Docker Build │
│          │    │ Maven    │    │ Maven    │    │  & Push      │
└──────────┘    └──────────┘    └──────────┘    └──────────────┘
```

**Steps:**
1. **Checkout** — clone the repository
2. **Set up Java 21** — install JDK 21 with Maven cache
3. **Build** — `mvn clean install -DskipTests` in `code/backend/`
4. **Test** — `mvn test` in `code/backend/`
5. **Docker Build & Push** — build the Docker image from `code/backend/Dockerfile` and push to DockerHub `pathsgames/pathsgames`

**Docker tagging strategy:**

| Branch | Tag |
|--------|-----|
| `master` | `latest`, `0.8.0` (from POM version, without `-SNAPSHOT`) |
| `develop` | `dev` |
| `release/*` | `rc` |

### 4.2 Website Pipeline (`website-deploy.yml`)

```
┌──────────┐    ┌──────────┐    ┌───────────────┐
│ Checkout │───►│ S3 Sync  │───►│  CloudFront   │
│          │    │          │    │  Invalidation │
└──────────┘    └──────────┘    └───────────────┘
```

**Steps:**
1. **Checkout** — clone the repository
2. **Configure AWS credentials** — using GitHub secrets
3. **S3 Sync** — `aws s3 sync code/website/html/ s3://$S3_BUCKET_WEBSITE --delete`
4. **CloudFront Invalidation** — `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"`

### 4.3 Frontend Pipeline (future — `frontend-deploy.yml`)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────────────┐
│ Checkout │───►│ npm      │───►│ S3 Sync  │───►│  CloudFront   │
│          │    │ build    │    │          │    │  Invalidation │
└──────────┘    └──────────┘    └──────────┘    └───────────────┘
```

**Steps** (to be implemented when the React project is created):
1. **Checkout** — clone the repository
2. **Set up Node.js** — install Node.js LTS
3. **Install & Build** — `npm ci && npm run build` in `code/frontend/`
4. **Configure AWS credentials** — using GitHub secrets
5. **S3 Sync** — upload `build/` output to the frontend S3 bucket
6. **CloudFront Invalidation** — invalidate the frontend distribution cache


## 5. Automated Tests

### 5.1 Backend Tests
- Unit tests run with `mvn test` using **JUnit 5**
- Tests are mandatory: pipeline **fails** if any test fails
- Current tests cover the `core` and `adapter-rest` modules (echo endpoint)
- Future steps will add integration tests and coverage thresholds

### 5.2 SonarQube / SonarCloud
- **SonarCloud** is used for code quality analysis (free for open-source projects)
- Runs on push to `master`/`develop` and on pull requests to both branches
- Uses **JaCoCo** for test coverage reports (`jacoco.xml`)
- Quality gate is enforced: pipeline **fails** if quality gate is not passed (`-Dsonar.qualitygate.wait=true`)
- Project key: `pathsgames-backend`
- Setup: register at [sonarcloud.io](https://sonarcloud.io) with GitHub account, import `gamespaths/pathsgames` repository

### 5.3 Pipeline Quality Gates
- **Compilation must succeed** — `mvn clean install` exit code checked
- **All tests must pass** — `mvn test` exit code checked
- **SonarQube quality gate must pass** — enforced in `sonarqube.yml`


## 6. Pipeline Failure Handling

All pipelines are configured to **fail fast** on errors:

- Maven builds use default behavior: any compilation error or test failure stops the build
- GitHub Actions steps use `set -e` semantics by default (non-zero exit = failure)
- Pipeline status is visible on:
  - The repository main page (badge)
  - Pull request checks
  - GitHub Actions tab
- Notifications: GitHub default email notifications on failure

### 6.1 Status Badge

Add to the repository `README.md`:
```markdown
![Backend CI](https://github.com/gamespaths/pathsgames/actions/workflows/backend-ci.yml/badge.svg)
![Website Deploy](https://github.com/gamespaths/pathsgames/actions/workflows/website-deploy.yml/badge.svg)
![SonarQube](https://github.com/gamespaths/pathsgames/actions/workflows/sonarqube.yml/badge.svg)
```


## 7. Connect CI to the Main Branch

### 7.1 Branch Protection Rules (recommended)

For the `master` branch on GitHub:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - Required check: `build-and-test` (from `backend-ci.yml`)
- ✅ Require branches to be up to date before merging
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

### 7.2 Workflow Triggers Summary

| Event | Backend CI | Website Deploy | SonarQube |
|-------|-----------|----------------|----------|
| Push to `master` | ✅ Build + Test + Docker | ✅ Deploy to S3 | ✅ Full scan |
| Push to `develop` | ✅ Build + Test + Docker (`:dev`) | ❌ | ✅ Full scan |
| Push to `release/*` | ✅ Build + Test + Docker (`:rc`) | ❌ | ❌ |
| Push to `feature/*` | ✅ Build + Test | ❌ | ❌ |
| Pull request to `master` | ✅ Build + Test | ❌ | ✅ PR analysis |
| Pull request to `develop` | ✅ Build + Test | ❌ | ✅ PR analysis |


## 8. Dockerfile

The backend Dockerfile is located at `code/backend/Dockerfile` and uses a **multi-stage build** for minimal image size:

```dockerfile
# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
COPY core/pom.xml core/
COPY adapter-rest/pom.xml adapter-rest/
COPY adapter-auth/pom.xml adapter-auth/
COPY adapter-admin/pom.xml adapter-admin/
COPY adapter-websocket/pom.xml adapter-websocket/
COPY adapter-postgres/pom.xml adapter-postgres/
COPY adapter-sqlite/pom.xml adapter-sqlite/
COPY adapter-mongo/pom.xml adapter-mongo/
COPY adapter-kafka/pom.xml adapter-kafka/
COPY ms-launcher/pom.xml ms-launcher/
RUN mvn dependency:go-offline -B
COPY . .
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/ms-launcher/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 8.1 Docker Commands (local)

```bash
# Build image locally
cd code/backend
docker build -t pathsgames/pathsgames:local .

# Run locally with dev profile
docker run -d -p 8042:8042 -e SPRING_PROFILES_ACTIVE=dev pathsgames/pathsgames:local

# Run locally with prod profile
docker run -d -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/pathsgames \
  pathsgames/pathsgames:local
```


## 9. File Structure

After this step, the following files are added to the repository:

```
.github/
└── workflows/
    ├── backend-ci.yml           ← Backend build, test, and Docker publish
    ├── website-deploy.yml       ← Website S3 sync and CloudFront invalidation
    └── sonarqube.yml            ← SonarCloud code quality and coverage analysis
code/
└── backend/
    └── Dockerfile               ← Multi-stage Docker build for the backend JAR
```


# Version Control
- First version created with AI prompt:
    > check repository files, i wanna create documentation_v1/Step08_ConfigureMinimalCI. I use GitHub and i wanna create gitHub actions. website deployed on s3 bucket and backend i wanna create jar will be deployed on dockerhub image repository. in future we'll create a react project "frontend" will be deployed on another S3 bucket  
    > added SonarQube workflow and updated secrets/triggers
- **Document Version**: 1.1
    - 1.0: first version of document (March 5, 2026)
    - 1.1: added SonarQube workflow and updated secrets/triggers (March 5, 2026)
- **Last Updated**: March 5, 2026
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
