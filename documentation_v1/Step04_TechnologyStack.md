# AlNao Paths Game V1 - Step 04: Technology Stack

This document defines the **Technology Stack** definition to build a **AlNao Paths Game**, a playable web-based game called AlNaoPathsGame, with detailed requirements and scope for a V1 release.

  - ✅ Backend Language

  - ✅ Backend Frameworks

  - ✅ Primary Database and storage

  - ✅ Frontend Technology

  - ✅ Deployment System


## Technology Stack


### 1. Backend Language
- Java 21 (latest LTS version) 
- Fully compatible with Docker and Kubernetes, script to build image and deploy on docker registry
- Fully compatible with AWS (Ec2, EKS and Elastic Beanstalk) and Azure and private cloud system with kubernetes system
- Unit tests and sonar coverage/analytics
- With Docker and Kubernetes project could be deployed on AWS Cloud, Azure Cloud and private cloud systems
- Script to deploy/test/manage system could be in Bash-SH, Python or NodeJS
- Expected scale-system to update infrastructure when scale up is needed for increase game usage


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


### 4. Frontend Technology
- Web site written di React (18+ or latest version) with State and Redux (if needed)
- Bootstrap (5+) for UI components and styling and Font Awesome (5+)
- Web application with login system with JWT (to secure client-server)
- I wanna book and card style. 
    - A book style card collector book
    - Cards represent all part of game (players, locations, caratteristics, actions, ...)
- Multi-style system: stories could have specific style (medieval, modern, fantasy, star trek, ... )
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


### 5. Deployment System
- Repository: GitHub, see [Create the repository](./Step02_CreateTheRepository.md)
- Repository for Docker image: created into [DockerHub alnao/pathsgame](https://hub.docker.com/repository/docker/alnao/pathsgame/general)
- CI process: managed by GitHub Action and/or AWS Code-build
- CD process: managed by Jenkins and/or AWS Code-deploy
- AWS & Azure integration: configured when first run will be executed using Iaac system and/or SH script (CLI)
- IaaC: Terraform used for all Infrastructure needed on Cloud
- Final goal is run all component into Kubernetes Cloud cluster and/or AWS Elastic Beanstalk


# Version Control
- First version created with AI prompts:
    > check this document, update the english language error and complete tecnoloty stack section with java, spring boot last vesion and rest controller and websotket,  i need docker and kubernetes compatibility, database sqlite on developer env and postgres on servers, react with bootstrap, deploy with github actions and jenkins, on aws we will use code build and code pipeline on eks or elastic beanstalk  
    > I'm a developer and I wanna create a frontend app for my multigame turn-based game , it's a rest application, the game is book game, I wanna book and card style. Card represent all part of game (player, locations,...). I wanna a book style card collector book. I wanna use react18+ and bootstrap 5 and font awesome 5. For now i wanna medieval / fantasy style but i would like change in future with different css files (example for dark or tecnology styles). In main page I wanna see: 1 on top players/characters list (with card style), 2 on center locations, 3 on left special card (missions), 4 on right little books with story and logs, 5 on bottom current player book collector card with player/character cards. Tell me which additional details you need.  
    > read all documents and tell me, the number 1 is my defenitive edition so don't try to change roles, i need suggestion for file 2 e 3 e 4
- **Document Version**: 1.0
  - 1.0: first version of document with points list (February 10, 2026)
- **Last Updated**: February 10, 2026
- **Status**: FROZEN until V1 completion



# < AlNao />

All source code and information in this repository are the result of careful and patient development work by AlNao, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.


Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.


For further details, in-depth information, or requests for clarification, please visit AlNao.it.

## License
Made with ❤️ by <a href="https://www.alnao.it">AlNao</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

