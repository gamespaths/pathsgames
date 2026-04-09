# Paths Games - Backend Python

This is a backend for Paths Games, a game platform. 

This version of backend is written in Python and uses FastAPI and SQLAlchemy (multi-module backend using **Hexagonal Architecture**  with Ports and Adapters).


## Project Structure

```
code/backend/python/
├── app/
│   ├── core/           # Pure domain: ports, services, models (no FastAPI/SQLAlchemy)
│   ├── adapters/       # Infrastructure: REST, Auth, Persistence
│   ├── config.py       # Configuration loading
│   └── launcher.py     # Application entry point & DI wiring
├── tests/              # Unit tests
├── Dockerfile          # Container image definition
├── .env.example        # Environment variables template
├── pyproject.toml      # Dependency management
└── README.md
```

## Quick Start

- Prerequisites: **Python 3.13+** and `apt install libpq-dev`
- Install dependencies:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
- Run (development):
    ```bash
    python3 -m app.launcher
    ```
- Run (production):
    ```bash
    uvicorn app.launcher:app --host 0.0.0.0 --port 8042
    ```

## Run with Docker

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- A `.env` file created from `.env.example` (copy and edit it):
    ```bash
    cp .env.example .env
    ```

### Development mode (SQLite, no external DB needed)

```bash
# Build the image
docker build -t pathsgames-backend-python .

# Run with SQLite (default ENV=development)
docker run --rm \
  -p 8042:8042 \
  -e ENV=development \
  -e JWT_SECRET=PathsGamesDevSecret2026_MustBeAtLeast32Chars! \
  -v "$(pwd)/database.sqlite:/app/database.sqlite" \
  pathsgames-backend-python
```

> The `-v` mount persists the SQLite database across container restarts.

### Production mode (PostgreSQL)

```bash
docker run --rm \
  -p 8042:8042 \
  -e ENV=production \
  -e JWT_SECRET=<your-strong-secret> \
  -e CORS_ALLOWED_ORIGINS=https://paths.games,https://www.paths.games \
  -e DB_HOST=<postgres-host> \
  -e DB_PORT=5432 \
  -e DB_NAME=pathsgames \
  -e DB_USER=pathsgames \
  -e DB_PASSWORD=<db-password> \
  pathsgames-backend-python
```

### Using an `.env` file

```bash
docker run --rm -p 8042:8042 --env-file .env pathsgames-backend-python
```

### Useful Docker commands

```bash
# Check running containers
docker ps

# View logs
docker logs <container-id>

# Stop a running container
docker stop <container-id>

# Remove the image
docker rmi pathsgames-backend-python
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/echo/status` | Server status, timestamp, and properties |
| POST | `/api/auth/guest` | Create a new guest session |
| POST | `/api/auth/guest/resume` | Resume an existing guest session |
| GET | `/api/admin/guests` | List all guest users |
| GET | `/api/admin/guests/stats` | Guest statistics |
| GET | `/api/admin/guests/{uuid}` | Get guest by UUID |
| DELETE | `/api/admin/guests/{uuid}` | Delete guest by UUID |
| DELETE | `/api/admin/guests/expired` | Cleanup expired guests |

## Architecture

Following the **Hexagonal Architecture** pattern:
1. **Core**: Contains domain entities and logical services. Independent of external frameworks.
2. **Ports**: Interfaces that define how the core interacts with the outside world.
3. **Adapters**: Implementations of ports for specific technologies (FastAPI, SQLAlchemy, PyJWT).

## Testing the API

Once the server is running (default: `http://localhost:8042`), you can use the following `curl` commands to test the endpoints:

### 1. Echo / Health Check
```bash
curl -s http://localhost:8042/api/echo/status | python3 -m json.tool
```

### 2. Guest Login (Create Session)
```bash
curl -X POST -s http://localhost:8042/api/auth/guest | python3 -m json.tool
COOKIE_TOKEN=$(curl -X POST -s http://localhost:8042/api/auth/guest | python3 -m json.tool | grep guestCookieToken | cut -d '"' -f 4)
echo $COOKIE_TOKEN
```

### 3. Resume Guest Session
Replace `<COOKIE_TOKEN>` with the `guestCookieToken` received from the create call:
```bash
curl -X POST -s http://localhost:8042/api/auth/guest/resume \
     -H "Content-Type: application/json" \
     -d '{"guestCookieToken": "'$COOKIE_TOKEN'"}' | python3 -m json.tool
```

### 4. Admin: List Guests
```bash
curl -s http://localhost:8042/api/admin/guests | python3 -m json.tool
```

### 5. Admin: Guest Stats
```bash
curl -s http://localhost:8042/api/admin/guests/stats | python3 -m json.tool
```

### 6. Admin: Delete Guest
```bash
curl -X DELETE -s http://localhost:8042/api/admin/guests/<UUID> | python3 -m json.tool
```

### 7. Running Automated Tests
```bash
PYTHONPATH=. pytest -v tests/
```





# Version Control
- Starting from 0.12.2 version, code is created with AI prompt:
    > Ciao, read all "documentation_v0" and ""code/backend" content, now i wanna create "code/backend/python" project, let's go!

    > add into readme file a "test" section with all curl calls

- **Document Version**: 0.14.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.12.3 | First version of this document | March 31, 2026 |
    | 0.12.5 | Add Docker section, fix production port, update project structure | April 1, 2026 |
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




