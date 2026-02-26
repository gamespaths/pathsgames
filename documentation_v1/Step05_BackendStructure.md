# Paths Games V1 - Step 05: Define backend module structure

This document defines the **backend module structure** to build a **Paths Games**, a playable web-based game, with detailed requirements and scope for a V1 release.

In these step we are going to create the code/backend folder and first API to check if backend started in right mode!


## 1. Separate domain from infrastructure

Following the **Hexagonal Architecture** (Ports and Adapters) pattern, the backend will be strictly divided to isolate the core game logic from external frameworks and technologies.
- **Core Module**: Contains the pure business logic, game rules (turn calculation, energy consumption, weather effects), and core entities (`Match`, `Character`, `Location`, `Event`, `Choice`). This module must be written in pure Java 21 and remain completely independent of Spring Boot, databases, or web frameworks.
- **Infrastructure Module**: Contains the adapters that implement the domain's interfaces (ports). This includes database repositories, REST controllers, WebSocket handlers, and external service integrations. Main module will be

## 2. Define API module
The API module handles all synchronous client-server communication using **Spring Boot REST Controllers**.
- **Authentication & Security**: Endpoints for user registration, login, and Google SSO, secured via JWT and Spring Security.
    - main package will be `games.paths.auth`
- **Game Management**: Endpoints to create matches, join matches, select character templates/classes, and fetch the initial game state.
    - main package will be `games.paths.game`
- **Admin API**: A dedicated set of endpoints under the specific package for the admin web interface.
    - main package will be `games.paths.admin`
- **Standardization**: All endpoints will follow RESTful naming conventions and return standardized JSON payloads.
    - main package will be `games.paths.rest`

## 3. Define realtime module
The realtime modules manages asynchronous, bi-directional communication using **WebSockets**, which is crucial for a turn-based multiplayer game.
- **Match Channels**: Dedicated WebSocket topics for each active match to broadcast state changes, turn advancements, and weather updates.
- **Player Actions**: Real-time synchronization of player movements, event triggers, and choice selections.
- **Notifications & Chat**: Instant delivery of trade requests, group movement invitations, and in-game chat messages.
- **Connection Management**: Handling player disconnects, reconnects, and AFK timeouts (e.g., `TimeoutPlayerPass`).

## 4. Define persistence module
The persistence modules is responsible for data storage and retrieval, implementing the repository interfaces defined in the domain.
- **Relational Database**: Support for **SQLite** (for local development/testing) and **PostgreSQL** (for production/server environments).
- **Data Mapping**: Mapping domain entities to the defined database schema (e.g., `game_match`, `list_places`,`gaming_registry`).
- **Document & File Storage**: Integration with MongoDB (if needed for complex document registries) and cloud storage (AWS S3, Azure Blob, or Kubernetes Storage) for game assets and images.

## 5. Define shared services module
The shared services module provides cross-cutting functionalities used by multiple parts of the application.
- **Security Services**: JWT token generation/validation, password hashing, and role-based access control (ADMIN/PLAYER).
- **Configuration Management**: Handling environment variables, global runtime variables (`global_runtime_variables`), and game parameters (e.g., `game_max_match_in_same_moment`).
- **Logging & Audit**: Centralized logging for player actions, system events, and error tracking (`gaming_logs`, `gaming_list_movements`).
- **Time & Scheduling**: Managing game timeouts, turn expirations, and scheduled tasks.


## 6. Create backend project and first build
- **Create project** with pom files, subfolder structure, application class and application properties files
- Create first **echo** components: port, service and rest controller
- For every java class, create the unit test class
- First **service start** with command `mvn -pl ms-launcher spring-boot:run `
- Check **echo API** with command `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
- Run **unit test** with command `mvn clean test`
- Write the specific **README** with tecnical details about backend project 


# Version Control
- First version created with AI prompt:
    > now read all documents in documentation_v1 and help me to complete the Step05 file  
    > read all files into documentation_v1 folder, and create the project into "code/backend" folder, with modules  "adapter-mongo", "adapter-postgres", "adapter-sqlite", "adapter-kafka", "adapter-rest", "adapter-auth", "adapter-admin", "adapter-websocket" and "core" and "ms-launcer" modules, create an application class, with two application yaml profile (dev and prod), with echo port and echo api rest to get a timestamp and server status and server properties from port method  
    > now, for every class created into code folder, please create  unit test classes  
    > now create a README into code/backend folder and edit main README.md  
    > in all project I wanna change main package from "games.pathsGame" to "games.paths"  
- **Document Version**: 1.0
    - 1.0 first version of document (February 20, 2026)
- **Last Updated**: February 20, 2026
- **Status**: Complete ✅



# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by AlNao, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://www.alnao.com">AlNao</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.




