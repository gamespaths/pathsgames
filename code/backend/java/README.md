# Paths Games - Backend Java

Java 21 + Spring Boot 3.4 multi-module backend using **Hexagonal Architecture** (Ports and Adapters).

## Project Structure

```
code/backend/java/
├── pom.xml                  # Parent POM (reactor)
├── core/                    # Pure domain: ports, services, entities (no Spring)
├── adapter-rest/            # REST API controllers (Spring MVC)
├── adapter-auth/            # Authentication & JWT adapter
├── adapter-admin/           # Admin API adapter
├── adapter-websocket/       # WebSocket real-time adapter
├── adapter-postgres/        # PostgreSQL persistence adapter (production)
├── adapter-sqlite/          # SQLite persistence adapter (development)
├── adapter-mongo/           # MongoDB document storage adapter
├── adapter-kafka/           # Kafka messaging adapter
└── ms-launcher/             # Spring Boot application entry point
```

## Module Descriptions

| Module | Package | Description |
|--------|---------|-------------|
| **adapter-rest** | `games.paths.adapters.rest` | REST controllers exposing domain ports as HTTP endpoints. |
| **adapter-auth** | `games.paths.adapters.auth` | JWT authentication, Google SSO, Spring Security. |
| **adapter-admin** | `games.paths.adapters.admin` | Admin management REST endpoints. |
| **adapter-websocket** | `games.paths.adapters.websocket` | WebSocket channels for real-time game state sync. |
| **adapter-postgres** | `games.paths.adapters.postgres` | PostgreSQL repositories for production. |
| **adapter-sqlite** | `games.paths.adapters.sqlite` | SQLite repositories for local development. |
| **adapter-mongo** | `games.paths.adapters.mongo` | MongoDB adapter for document registries. |
| **adapter-kafka** | `games.paths.adapters.kafka` | Kafka producer/consumer for async messaging. |
| **core** | `games.paths.core` | Domain logic, ports (`EchoPort`), services (`EchoService`). No framework dependencies. |
| **ms-launcher** | `games.paths.launcher` | Spring Boot `@SpringBootApplication`, wires all modules. |

## Profiles

| Profile | File | Port | Database | Description |
|---------|------|------|----------|-------------|
| **dev** (default) | `application-dev.yml` | 8042 | SQLite | Local development |
| **prod** | `application-prod.yml` | 8080 | PostgreSQL | Production environment |

## Database & Flyway

Both profiles use **Flyway** for automatic schema migration. Migrations run on every application startup — only new, unapplied versions are executed.
- SQLite (dev): The database file is created automatically at startup. Default path: `~/.paths.games/database.sqlite`. Override with a JVM property:
    ```bash
    mvn -pl ms-launcher spring-boot:run -Dgame.database.path=/custom/path/mydb.sqlite
    ```
- PostgreSQL (prod): Configure via environment variables (defaults shown):
    | Variable | Default | Description |
    |----------|---------|-------------|
    | `DB_HOST` | `localhost` | PostgreSQL host |
    | `DB_PORT` | `5432` | PostgreSQL port |
    | `DB_NAME` | `pathsgames` | Database name |
    | `DB_USERNAME` | `pathsgames` | Database user |
    | `DB_PASSWORD` | `pathsgames` | Database password |


## Quick Start
- Prerequisites: **Java 21+** & **Maven 3.9+**
- Build
    ```bash
    cd code/backend/java
    mvn clean install -DskipTests
    ```
- Run (dev profile)
    ```bash
    mvn -pl ms-launcher spring-boot:run
    ```
- Run (prod profile)
    ```bash
    mvn -pl ms-launcher spring-boot:run -P prod -Dspring-boot.run.profiles=prod
    ```
    - **Note**: `-P prod` activates the Maven profile (puts `adapter-postgres` on the classpath);
        - `-Dspring-boot.run.profiles=prod` activates the Spring profile (loads `application-prod.yml`).
        - Both flags are required — omitting `-P prod` causes `Cannot load driver class: org.postgresql.Driver`.
    - Run database postgres on docker:
        ```bash
        docker run --name pathsgames-postgres -p 5432:5432  -e POSTGRES_DB=pathsgames -e POSTGRES_USER=pathsgames -e POSTGRES_PASSWORD=pathsgames -d postgres:latest
        ```
- Run Tests
    ```bash
    mvn clean test
    ```
- For sonar scan run command
    ```bash
    mvn clean package && mvn sonar:sonar -Dsonar.login=<TOKEN>
    ```
- Echo API
    ```bash
    curl -s http://localhost:8042/api/echo/status | python3 -m json.tool
    ```
    - Response:
        ```json
        {
            "status": "OK",
            "timestamp": 1740049200000,
            "properties": {
                "env": "development",
                "version": "X.Y.Z-SNAPSHOT",
                "applicationName": "paths-game-backend",
                "port": "8042",
                "javaVersion": "21.0.x"
            }
        }
        ```
- API Endpoints
    | Method | Endpoint | Description |
    |--------|----------|-------------|
    | GET | `/api/echo/status` | Server status, timestamp, and properties |

## Architecture

```
┌────────────────────────────────────────────┐
│              ms-launcher                   │
│   (Spring Boot App + Configuration)        │
├────────────┬───────────┬───────────────────┤
│adapter-rest│adapter-ws │ adapter-auth      │
│ (REST API) │(WebSocket)│ (JWT/SSO)         │
├────────────┴───────────┴───────────────────┤
│                  core                      │
│        (Ports + Domain Services)           │
├────────────┬───────────┬───────────────────┤
│adapter-pg  │adapter-sql│ adapter-mongo     │
│(PostgreSQL)│ (SQLite)  │ (MongoDB)         │
└────────────┴───────────┴───────────────────┘
```




# Version Control
- Starting from 0.5.0 version, code is created with AI prompt:
    > Paths Games V1 - Step 05: Define backend module structure

- **Document Version**: 0.14.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.5.0 | Step 05: Define backend module structure | Feb 26, 2026 |
    | 0.10.12 | Create initial DB schema | Mar 25, 2026 |
    | 0.14.1 | Manage projects structure and 101 steps definition | April 09, 2026 |
- **Last Updated**: April 1, 2026
- **Status**: In progress






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




