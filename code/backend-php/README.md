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



{
    "uuid": "1b85b58d-6e3f-4841-9687-8b092a5748fb",
    "guestCookieToken": "de59a57c0ef9bf5f4c972a43dd9b67dd7db7aa942f26356a489b52022e3e891f",
    "tsInsert": "2026-04-01T15:12:07+00:00",
    "expiresAt": "2026-04-02T15:12:07+00:00"
}

{
    "userUuid": "9e9bdb1b-77f6-4c1d-86d3-3947c48be05c",
    "username": "guest_9e9bdb1b",
    "accessToken": "xxxxx",
    "refreshToken": "xxxx",
    "accessTokenExpiresAt": 1775058438000,
    "refreshTokenExpiresAt": 1775661438000,
    "guestCookieToken": "4aa11b14-daa6-4f0b-8407-262893d32878"
}


{
    "status": "OK",
    "timestamp": 1775056574460,
    "properties": {
        "env": "development",
        "version": "0.12.4",
        "applicationName": "paths-game-backend-python",
        "port": "8042",
        "pythonVersion": "3.12.x"
    }
}