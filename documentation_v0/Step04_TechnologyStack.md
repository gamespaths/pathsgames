# Paths Games V1 - Step 04: Technology Stack

This document defines the **Technology Stack** definition to build a **Paths Games**, a playable web-based game, with detailed requirements and scope for a V1 release.

  - ✅ Backend Language

  - ✅ Backend Frameworks

  - ✅ Primary Database and storage

  - ✅ Database Migration Tool

  - ✅ Frontend Technology

  - ✅ Deployment System


## Technology Stack


### 1. Backend Language
- Java 21 (latest LTS version) — primary reference implementation
- Fully compatible with Docker and Kubernetes, script to build image and deploy on docker registry
- Fully compatible with AWS (Ec2, EKS and Elastic Beanstalk) and Azure and private cloud system with kubernetes system
- Unit tests and sonar coverage/analytics
- With Docker and Kubernetes project could be deployed on AWS Cloud, Azure Cloud and private cloud systems
- Script to deploy/test/manage system could be in Bash-SH, Python or NodeJS
- Expected scale-system to update infrastructure when scale up is needed for increase game usage

Additional backend implementations (alternative, full API parity with Java):
- **Python** (FastAPI, hexagonal architecture) — `code/backend/python/`
- **AWS Serverless** (Lambda + Python 3.13 + DynamoDB) — `code/backend/aws/`
- Abandoned: **PHP** (plain PHP, hexagonal architecture) — `code/backend/php/`
- Abandoned: **Node.js** (Fastify + TypeScript + Prisma, hexagonal architecture) — `code/backend/node/`


All backends share the same REST API contract validated by the Robot Framework E2E suite (288 tests).


### 2. Backend Frameworks
- Spring Boot (3.5.x versions) with software design Hexagonal Architecture (code, ports, adapters)
- REST Controllers
- WebSocket support
- When necessary will be added library/plugin from Spring Boot Cloud and other library (example "Spring Boot Starter Kafka")
- Unit tests in a Spring Boot project with Junit


### 3. Primary Database and storages
- SQLite used on development environment and light version
- PostgreSQL used on production and server environment
- Will be develop multiple adapters
- MongoDB will be used to manage document registries (if it will be necessary)
- Files storages will be managed with AWS-S3, Azure-Blob and Kubernetes Storage


### 4. Database Migration Tool
- Flyway for database schema versioning — manages incremental SQL migrations executed automatically on application startup
- Tracks applied migrations in a `flyway_schema_history` table; only new, unapplied files are executed
- Each database adapter (`adapter-postgres`, `adapter-sqlite`) keeps its own dialect-specific SQL files under `src/main/resources/db/migration/`
- Versioned migrations (`V{version}__{description}.sql`) are executed once; repeatable migrations (`R__{description}.sql`) are re-executed when content changes
- Spring Boot integration via `spring-boot-starter-flyway` — no external CLI required
- Migration version numbers are aligned with the project roadmap steps (e.g., Step 10 → `V0.10.x`)
- Chosen over Liquibase for its pure-SQL approach, which gives full control over dialect-specific DDL without an abstraction layer


### 5. Frontend Technology
- Web site written di React (18+ or latest version) with State and Redux (if needed)
- Bootstrap (5+) for UI components and styling and Font Awesome (5+)
- Web application with login system with JWT (to secure client-server)
- I wanna book and card style. 
    - A book style card collector book
    - Cards represent all part of game (players, locations, caratteristics, actions, ...)
- Multi-style system: stories could have specific style (medieval, modern, fantasy, ... )
- Main graphics game page is divided in sections:
    - on top left: game logo
    - on top center: weather, timing and players/characters list (with card style) with marker to show active player
    - on top right: user icons/menu to access into user profile details/page
    - on center: locations grid with all disponible actions 
    - on left: special cards list (example missions list)
    - on right: books with story logs (with cards and )
    - on bottom: the player/character book collector with all card , books with more pages (specific for cards types)
    - on bottom right: chat icon and notifications (connected to websocket!)
- for V1 version is not expected Mobile compability and Smartphone application


### 6. Deployment System
- Repository: GitHub, see [Create the repository](./Step02_CreateTheRepository.md)
- Repository for Docker image: created into [DockerHub pathsgames/pathsgames](https://hub.docker.com/r/pathsgames/pathsgames)
- CI process: managed by GitHub Action and/or AWS Code-build
- CD process: managed by Jenkins and/or AWS Code-deploy
- AWS & Azure integration: configured when first run will be executed using Iaac system and/or SH script (CLI)
- IaaC: Terraform used for all Infrastructure needed on Cloud
- Final goal is run all component into Kubernetes Cloud cluster and/or AWS Elastic Beanstalk


### 7. Hosting cost hypotheses (v0.39.1)

Estimates, **not quotes**: USD/month, VAT excluded, us-east-1 list prices (Sept 2026) unless a
row says otherwise.

**Assumptions.** 200 requests/user/day (the k6 stress flow is ~15 requests/game-flow; 200
approximates a real session + catalog browsing, conservative). Peak hour = 15% of daily
traffic, peak = 3× the hourly average. 5 KB average response. CPU/request: Python ~20 ms, Java
~5 ms. Serverless request: Lambda arm64 1024 MB / 100 ms, 5 DynamoDB reads + 3 writes
(on-demand), 1 KB logs. Traffic tiers: 100 users/day = 600k req/month (peak ≈2.5 rps); 1,000 =
6M (peak ≈25 rps); 10,000 = 60M (peak ≈250 rps).

| Option | 100 users/day | 1,000 users/day | 10,000 users/day |
| :--- | :--- | :--- | :--- |
| Cloudflare: Python backend in Containers + Neon Postgres | ~7–10 (1 `lite` always on, Neon free) | ~76 (3 `basic`, Neon Launch 0.5 CU) | ~425 (20 `basic`, Neon 2 CU) |
| AWS serverless (current: API Gateway HTTP + Lambda + DynamoDB), 1 region | ~2.4–3 | ~28–29 | ~345 |
| AWS serverless, 10 regions (users split, DynamoDB provisioned inside each region's free 25 RCU/WCU) | ~1.1 | ~14 | ~390 (on-demand needed) |
| AWS EC2 + Java (single instance, Postgres on the box up to 1,000) | ~18 (`t4g.small`) | ~32 (`t4g.medium`) | ~139 (`m7g.large` + RDS `db.t4g.medium`, no HA) |
| AWS ECS Fargate + Java (ALB + RDS) | ~59 | ~91 | ~181 (2 tasks, HA + autoscaling) |

A dedicated domain `pathsgames.app` on Cloudflare Registrar costs 14.20 USD/year (≈1.2/month);
the AWS options can use a `*.paths.games` subdomain instead, at no extra cost.

**Cloudflare notes.** Workers Paid plan (5 USD/month) is required for Containers. Container
memory/disk are billed on provisioned size, CPU on active usage (since 2025-11-21); container
disk is ephemeral, hence Neon for persistence. No autoscaling yet — capacity is sized by
instance count. Neon free tier = 100 CU-h + 0.5 GB, scales to zero after 5 min idle; Launch =
0.106 USD/CU-h + 0.35 USD/GB-month. `.app` is HSTS-preloaded (HTTPS mandatory).

**AWS notes.** DynamoDB on-demand: 0.125 USD/M reads, 0.625 USD/M writes (us-east-1/us-east-2).
API Gateway HTTP: 1 USD/M requests. The Lambda free tier (1M requests + 400k GB-s) is per
account across regions, while the DynamoDB free 25 RCU/WCU provisioned is per region. Regional
prices average +16–18% over us-east-1 for API Gateway/DynamoDB across the 10-region spread
(sa-east-1 the most expensive). DynamoDB Global Tables would multiply write cost — avoid for
multi-region (~1,300 USD/month of replicated writes at 10,000 users/day). Break-even,
serverless vs EC2, is ≈2,000–4,000 users/day. Current stacks: `dev` = `PROVISIONED` 10/10 +
2×5/5 (inside the region's free tier, us-east-2); `test` = `PAY_PER_REQUEST` (same region as
`dev`, absorbs Robot/stress bursts); `prod` = `PAY_PER_REQUEST` by default (us-east-1).

**Robot Framework runs on AWS (current, measured).** Measured via Cost Explorer + CloudWatch on
2026-09-23 on stack `pathsgames-test` (us-east-2, on-demand):

| Metric | Value |
| :--- | :--- |
| One full run | 766 tests, ~18 min |
| HTTP calls (RequestsLibrary) → billed API Gateway requests | ~6.4k → ~9.6k |
| DynamoDB writes / reads | ~23.3k / ~26.4k |
| Cost per run | ≈0.028 USD (DynamoDB ≈0.018, API Gateway ≈0.0096, Lambda inside free tier) |
| At 3 runs/day | ≈2.5 USD/month (≈30 USD/year) |
| Post-run cleanup + purge | ≈5.2k writes + 4.3k reads ≈0.0036 USD/run (≈0.32 USD/month) — the part the v0.39.1 TTL can remove once purge runs less often |

k6 stress tests against the serverless stack cost ≈1.38 USD/session (2026-09-19 run: 1.45M
writes, 314k API requests) — run stress tests on EC2 instead (`run_stress_ec2.sh`, see
[Step20_GameWebSiteFirstRun.md](./Step20_GameWebSiteFirstRun.md)).


# Version Control
- First version created with AI prompts:
    > check this document, update the english language error and complete tecnoloty stack section with java, spring boot last vesion and rest controller and websotket,  i need docker and kubernetes compatibility, database sqlite on developer env and postgres on servers, react with bootstrap, deploy with github actions and jenkins, on aws we will use code build and code pipeline on eks or elastic beanstalk  
    
    > I'm a developer and I wanna create a frontend app for my multigame turn-based game , it's a rest application, the game is book game, I wanna book and card style. Card represent all part of game (player, locations,...). I wanna a book style card collector book. I wanna use react18+ and bootstrap 5 and font awesome 5. For now i wanna medieval / fantasy style but i would like change in future with different css files (example for dark or tecnology styles). In main page I wanna see: 1 on top players/characters list (with card style), 2 on center locations, 3 on left special card (missions), 4 on right little books with story and logs, 5 on bottom current player book collector card with player/character cards. Tell me which additional details you need.  
    
    > read all documents and tell me, the number 1 is my defenitive edition so don't try to change roles, i need suggestion for file 2 e 3 e 4  
    
    > add flyway information in the document  
- **Document Version**: 0.39.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.4 | first version of document with points list | February 10, 2026 |
    | 0.7 | configure `hub.docker.com/r/pathsgames/pathsgames` repository | February 27, 2026 |
    | 0.10.12 | added Flyway as database migration tool (section 4) | March 19, 2026 |
    | 0.23.1 | added alternative backends to section 1 | June 12, 2026 |
    | 0.39.1 | added section 7, hosting cost hypotheses (Cloudflare, AWS serverless/EC2/Fargate) at 3 traffic tiers, plus measured Robot/k6 AWS cost | September 24, 2026 |
- **Last Updated**: September 24, 2026
- **Status**: Complete ✅ , frozen until V0 completion




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




