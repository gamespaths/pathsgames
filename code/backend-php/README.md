# Paths Games - Backend PHP

This is a backend for Paths Games, a game platform. 

This version of backend is written in PHP and uses Slim Framework 4 and plain PDO (multi-module backend using **Hexagonal Architecture** with Ports and Adapters).


## Project Structure

```
code/backend-php/
├── database.sql        # MySQL table definitions
├── src/
│   ├── Core/           # Pure domain: ports, services, models (no Slim/PDO)
│   └── Adapter/        # Infrastructure: REST (Slim Controllers), Persistence (PDO)
├── public/
│   └── index.php       # Application entry point & manual DI wiring
├── tests/              # Unit tests (PHPUnit)
├── Dockerfile          # Container image definition
├── .env.example        # Environment variables template
├── phpunit.xml         # PHPUnit configuration
├── composer.json       # Dependency management
└── README.md
```

## Quick Start

- Prerequisites: **PHP 8.2+** and **Composer**
- Install dependencies:
    ```bash
    composer install
    ```
- Run MySQL 
    - With Docker for local development:
        ```bash
        docker run --name pathsgames-mysql -p 3307:3306 -e MYSQL_DATABASE=pathsgames_0_12_4 -e MYSQL_USER=pathsgames -e MYSQL_PASSWORD=pathsgames -e MYSQL_ROOT_PASSWORD=root -d mysql:8.0
        docker exec -i pathsgames-mysql mysql -u pathsgames -p'pathsgames' pathsgames_0_12_4 < database.sql
        ```
    - Using a real MySql databaase, load the schema into an existing database using `database.sql`
        - Create user and grant privileges:
            ```mysql
            CREATE USER 'pathsgames'@'localhost' IDENTIFIED BY 'pathsgames';
            GRANT ALL PRIVILEGES ON `pathsgames%`.* TO 'pathsgames'@'localhost' WITH GRANT OPTION;
            FLUSH PRIVILEGES;
            ```
        - Not necessary `mysql -u pathsgames -p'pathsgames' -e "CREATE DATABASE pathsgames_0_12_4;"` because database is created by script `database.sql
        - Load the schema into the database:
            ```bash
            mysql -u pathsgames -p'pathsgames' pathsgames < database.sql
            ```
- Run (development using PHP built-in server):
    ```bash
    # Ensure you are in the code/backend-php directory
    php -S localhost:8042 -t public 
    ```

## Run with Docker
- **Prerequisites**
    - [Docker](https://docs.docker.com/get-docker/) installed.
    - A running **MySQL 8** instance (or spin one up with Docker — see below).
    - A `.env` file created from `.env.example` (copy and edit it):
        ```bash
        cp .env.example .env
        ```
- Step 1 — Start MySQL with Docker (if you don't have one) or on *normal* server
- Step 2 — Build and run the PHP backend
    ```bash
    # Build the image
    docker build -t pathsgames-backend-php .
    # Run connecting to the MySQL container above
    docker run --rm \
        -p 8042:8042 \
        -e APP_ENV=development \
        -e JWT_SECRET=PathsGamesDevSecret2026_MustBeAtLeast32Chars! \
        -e DB_HOST=127.0.0.1 \
        -e DB_PORT=3306 \
        -e DB_NAME=pathsgames \
        -e DB_USER=pathsgames \
        -e DB_PASS=pathsgames \
         --network host \
        pathsgames-backend-php
    ```
    - Note: use `--network host` in Gnu Linux system if MySql server runs outside docker server.
    - Note: use `host.docker.internal` in Windows system, needed when MySQL runs outside the container network.
    - Note: add `-e APP_VERSION=0.12.5 ` to change server app version

- Production mode
    ```bash
    docker run --rm \
    -p 8042:8042 \
    -e APP_ENV=production \
    -e APP_VERSION=X.Y.Z \
    -e JWT_SECRET=<your-strong-secret> \
    -e CORS_ALLOWED_ORIGINS=https://paths.games,https://www.paths.games \
    -e DB_HOST=<mysql-host> \
    -e DB_PORT=3306 \
    -e DB_NAME=pathsgames \
    -e DB_USER=pathsgames \
    -e DB_PASS=<db-password> \
    pathsgames-backend-php
    ```
- Using an `.env` file

    ```bash
    docker run --rm -p 8042:8042 --env-file .env pathsgames-backend-php
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
1. **Core Domain/Service**: Contains domain entities and logical services. Independent of external frameworks.
2. **Ports**: Interfaces that define how the core interacts with the outside world.
3. **Adapters**: Implementations of ports for specific technologies (Slim Framework controllers, PHP PDO for MySQL).

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
# Install dev dependencies first (if not already installed)
composer install

# Run the test suite
composer test
# or directly:
vendor/bin/phpunit --configuration phpunit.xml
```


# Version Control
- Starting from 0.12.4 version, code is created with AI prompt:
    > read all "documentation_v0" and "code/backend-python" content, now i wanna create "code/backend-php" project, let's go!

- **Document Version**: 0.12.5
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.12.4 | First version of this document | April 1, 2026 |
    | 0.12.5 | Add Docker section, tests section, project structure update | April 1, 2026 |
- **Last Updated**: April 1, 2026
- **Status**: In progress




# < Paths Games />
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
