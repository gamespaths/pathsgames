# Paths Games V6 - Roadmap

**V6 — eta: infrastructure.** Draft plan of the seventh version: 42 steps released as `6.N.0`.
Rules in [Version Template](../VersionTemplate.md), all versions in the
[Global Roadmap](../Roadmap.md). It comes after advanced multiplayer and takes the
old V0 roadmap steps 85-87 and 96-99. Azure runs the Docker images of the existing backends: no
dedicated Azure backend.

Shared references: [Architecture](../Architecture.md),
[Environments](../Environments.md), [Security](../Security.md).

- **Steps 1-7**: analysis, Docker images, Kubernetes, zero-downtime, secrets, managed PostgreSQL, distributed job lock.
- **Steps 8-11**: Azure, Cloudflare, DNS and certificates, backup and disaster recovery.
- **Steps 12-15**: monitoring, logging aggregation, alerting, frontend error reporting.
- **Steps 16-17**: security audit and penetration tests, incident runbook. **Steps 18-39**: reserved.
- **Steps 40-42**: recurring hardening, migration from zeta, eta launch.


# Steps

1. **Infrastructure analysis** — where and how to run the game at scale.
    - Targets: Kubernetes, Azure, Cloudflare, existing AWS serverless (docs)
    - Cost estimates per traffic tier (docs)
    - What stays serverless and what moves to containers (docs)
    - Migration path from the current stages (docs)
    - List of doubts for the owner (docs)
2. **Docker images** — old step 98.
    - Multi-stage images for Java and Python (infra)
    - Vulnerability scanning in the build pipeline (infra)
    - Image tags aligned with versions (infra)
    - Registry push (Docker Hub already used for Java) (infra)
    - Image smoke tests (tests)
3. **Kubernetes deployment** — old step 98.
    - Manifests: backend pods, resource limits, autoscaling (infra)
    - Readiness and liveness probes (infra)
    - Separate public and admin (8044) services (infra)
    - Manifest linting (tests)
    - Deployment guide (docs)
4. **Zero-downtime deployment** — old step 98.
    - Rolling updates with probes (infra)
    - Flyway migrations compatible with rolling updates (backend)
    - Realtime connection draining (infra)
    - Rollback procedure (docs)
    - Deployment tests (tests)
5. **Secrets management** — old step 98.
    - Kubernetes secrets or a cloud secret manager (infra)
    - Rotation of JWT and provider secrets (infra)
    - No secret in images or repositories (infra)
    - Update [Security](../Security.md) (docs)
    - Checks in CI (tests)
6. **Managed PostgreSQL** — old step 98.
    - Managed instance with encryption (infra)
    - Connection pool sizing (backend)
    - Backup schedule (infra)
    - Restore test (tests)
    - Update [Environments](../Environments.md) (docs)
7. **Distributed lock for scheduled jobs** — jobs must run once with several instances.
    - Java: lock library (e.g. ShedLock) on `@Scheduled` jobs (backend)
    - Python: equivalent lock for APScheduler jobs (backend)
    - AWS: EventBridge jobs already run once (docs)
    - Tests with two instances (tests)
    - Update [Architecture](../Architecture.md) (docs)
8. **Azure deployment** — the Docker images on Azure.
    - Azure container service choice (docs)
    - Deployment of Java or Python images (infra)
    - Azure database and storage (infra)
    - Smoke tests on Azure (tests)
    - Cost report (docs)
9. **Cloudflare** — CDN, DNS and protection (old step 99).
    - Cloudflare in front of frontends and APIs (infra)
    - Cache rules for static assets (infra)
    - WAF and bot protection rules (infra)
    - Realtime traffic through Cloudflare (infra)
    - Tests of cache invalidation (tests)
10. **DNS and certificates** — old step 99.
    - Production DNS records (infra)
    - Certificates with automatic renewal (infra)
    - Admin endpoints never exposed on paths.games DNS (infra)
    - Update [Environments](../Environments.md) (docs)
    - Expiry monitoring (infra)
11. **Backup and disaster recovery** — old step 99.
    - Daily full and frequent incremental backups, off-site copy (infra)
    - Documented and tested restore procedure (docs, tests)
    - Infrastructure rebuild from code (infra)
    - DNS failover (infra)
    - Recovery time and data loss targets (docs)
12. **Monitoring and dashboards** — old step 96.
    - Health checks: database, realtime broker, disk (backend)
    - Metrics: requests, errors, latency, active matches, connections (backend)
    - Dashboards (e.g. Grafana) (infra)
    - Game metrics: turn processing time, event throughput (backend)
    - Unit tests for health and metrics endpoints (tests)
13. **Logging aggregation and tracing** — old step 97.
    - Structured JSON logs with correlation ids (backend)
    - Central log store (infra)
    - Log levels per environment (backend)
    - Request tracing from REST to database and realtime (backend)
    - Tests of log format and id propagation (tests)
14. **Alerting** — old steps 96-97.
    - Alert rules: error rate, latency, realtime disconnection spikes (infra)
    - Notification channels (infra)
    - On-call checklist (docs)
    - Alert tests (tests)
    - Update [Environments](../Environments.md) (docs)
15. **Frontend error reporting and status page** — old steps 96-97.
    - JavaScript error capture sent to a backend endpoint (frontend)
    - Status page with health and maintenance notices (frontend)
    - Error endpoint with rate limit (backend)
    - Unit tests (tests)
    - Privacy check of collected data (docs)
16. **Security audit and penetration tests** — old steps 85-87.
    - Input validation audit: injection, XSS, path traversal, oversized payloads (tests)
    - JWT and OAuth audit (tests)
    - Role escalation and data isolation tests (tests)
    - Findings with severity and fixes (docs)
    - Update [Security](../Security.md) (docs)
17. **Incident runbook** — old step 99.
    - Escalation path (docs)
    - Rollback procedure (docs)
    - Communication templates (docs)
    - Drill of a simulated incident (tests)
    - Runbook published in `wiki/` (docs)
18. **Reserved**
19. **Reserved**
20. **Reserved**
21. **Reserved**
22. **Reserved**
23. **Reserved**
24. **Reserved**
25. **Reserved**
26. **Reserved**
27. **Reserved**
28. **Reserved**
29. **Reserved**
30. **Reserved**
31. **Reserved**
32. **Reserved**
33. **Reserved**
34. **Reserved**
35. **Reserved**
36. **Reserved**
37. **Reserved**
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Review of every new infrastructure component (all)
    - Network policies and least-privilege permissions (infra)
    - Dependency scan and secrets review (all)
    - KPI report checked on the new infrastructure (backend, frontend)
    - Unit tests and Robot suites (tests)
41. **Migration from zeta and privacy check** — recurring.
    - Migration of users, stories and progression from zeta to eta (infra)
    - Privacy check: data location per cloud provider (all)
    - Dry run and rollback plan (docs)
    - Verify migrated data with Robot suites (tests)
    - Update [Environments](../Environments.md) (docs)
42. **Eta launch** — recurring.
    - New stage `eta` on the chosen infrastructure; `eta.paths.games`, `eta-api.paths.games` (infra)
    - Content license check and i18n check (EN, IT) (docs, frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch, smoke test and load test at 50% of target capacity (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the infrastructure version plan | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
