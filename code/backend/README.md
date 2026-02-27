# Paths Games - Backend

Java 21 + Spring Boot 3.4 multi-module backend using **Hexagonal Architecture** (Ports and Adapters).

## Project Structure

```
code/backend/
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
| **core** | `games.paths.core` | Domain logic, ports (`EchoPort`), services (`EchoService`). No framework dependencies. |
| **adapter-rest** | `games.paths.adapterRest` | REST controllers exposing domain ports as HTTP endpoints. |
| **adapter-auth** | `games.paths.auth` | JWT authentication, Google SSO, Spring Security. |
| **adapter-admin** | `games.paths.admin` | Admin management REST endpoints. |
| **adapter-websocket** | `games.paths.websocket` | WebSocket channels for real-time game state sync. |
| **adapter-postgres** | `games.paths.postgres` | PostgreSQL repositories for production. |
| **adapter-sqlite** | `games.paths.sqlite` | SQLite repositories for local development. |
| **adapter-mongo** | `games.paths.mongo` | MongoDB adapter for document registries. |
| **adapter-kafka** | `games.paths.kafka` | Kafka producer/consumer for async messaging. |
| **ms-launcher** | `games.paths.launcher` | Spring Boot `@SpringBootApplication`, wires all modules. |

## Profiles

| Profile | File | Port | Database | Description |
|---------|------|------|----------|-------------|
| **dev** (default) | `application-dev.yml` | 8042 | SQLite | Local development |
| **prod** | `application-prod.yml` | 8080 | PostgreSQL | Production environment |

## Quick Start

### Prerequisites
- Java 21+
- Maven 3.9+

### Build
```bash
cd code/backend
mvn clean install -DskipTests
```

### Run (dev profile)
```bash
mvn -pl ms-launcher spring-boot:run
```

### Run (prod profile)
```bash
mvn -pl ms-launcher spring-boot:run -Dspring-boot.run.profiles=prod
```

### Test
```bash
mvn clean test
```

### Echo API
```bash
curl -s http://localhost:8042/api/echo/status | python3 -m json.tool
```

Response:
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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/echo/status` | Server status, timestamp, and properties |

## Architecture

```
┌───────────────────────────────────────────┐
│              ms-launcher                  │
│   (Spring Boot App + Configuration)       │
├───────────┬───────────┬───────────────────┤
│adapter-rest│adapter-ws │ adapter-auth      │
│ (REST API) │(WebSocket)│ (JWT/SSO)         │
├───────────┴───────────┴───────────────────┤
│                  core                     │
│        (Ports + Domain Services)          │
├───────────┬───────────┬───────────────────┤
│adapter-pg │adapter-sql│ adapter-mongo     │
│(PostgreSQL)│ (SQLite) │ (MongoDB)         │
└───────────┴───────────┴───────────────────┘
```




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




