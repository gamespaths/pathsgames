# Paths Games

**Paths Games** is a multiplayer game inspired by classic gamebooks, adapted to modern gaming mechanics.

- ✅ Paths games is **free-to-play** game, all code will be **open source** released with GNU-GPL3 licence

- Visit [paths.games](http://paths.games) website, crowdfunding campaign *coming soon*.


## Documentation
Documents includes all steps and the roadmap for create paths.games components, configuration parameters and lists of features reserved for futures versions.

- [Version 0 Roadmap](./documentation_v0/Step00_Roadmap.md): start project and create the first playable version of *Paths Games*, check [developer branch](https://github.com/gamespaths/pathsgames/) for all updates:
    | Steps | Focus | 
    | --- | --- |
    | **Start project** <br /> Steps 1-13| - ✅ [Start the project](./documentation_v0/Step01_StartProject.md) & [Create the repository](./documentation_v0/Step02_CreateTheRepository.md) & [Define the V1 scope](./documentation_v0/Step03_DefineScope.md) <br />- ✅ [Technology stack](./documentation_v0/Step04_TechnologyStack.md) & [Backend structure](./documentation_v0/Step05_BackendStructure.md) & [Naming conventions](./documentation_v0/Step06_NamingConventions.md) <br />- ✅ [Configure website](./documentation_v0/Step07_ConfigureWebsite.md) & [Configure Environments & CI](./documentation_v0/Step08_ConfigureMinimalCI.md) <br />- ✅ [Design core data model](./documentation_v0/Step09_DesignCoreDataModel.md) & [Create initial DB schema](./documentation_v0/Step10_CreateDBschema.md) & [Define API versioning](./documentation_v0/Step11_DefineAPIVersioning.md) <br />- ✅ [Implement guest login](./documentation_v0/Step12_GuestLoginMethod.md) & [Session & token management](Step13_SessionTokenManagement.md) |
    | **Single player** <br /> Steps 14-42 |- ✅ [Stories magement and import](./documentation_v0/Step14_StoriesImportSystem.md) <br />Guest login, story management, start match, ... |
    | **Multiplayer** <br /> Steps 43-84 | Multiplayer + credentials, WebSocket, trade, chat, lobby, admin tools, SSO |
    | **Launch game** <br /> Steps 85-101 | Security, E2E testing, load testing, monitoring, production infra, docs, V1 launch |

- Version 1: 
    - start the crowfouning campaign 
    - use Creative Commons (CC BY-NC-SA) for contents (images, story, musics, ... )
    - use GraphQL protocol in new versions
    - game-engine feature: multiplayer system

- Version 2: 
    - game-engine feature: combact system 
    - game-engine feature: open world system

- Version 3: 
    - mobile version integrated with Google play with Android App and
    - desktop application integrated with Steam 
    - create and distribute the free Debian package

- Version 4
    - update graphical system with advanced game-engine

- Version 42:
    - *Life, the Universe and Everything*
    - *To Boldly Go Where No Man Has Gone Before*


## Tecnical components

- **Main tecnical stack**
    | Category | Components |
    |---|:---:|
    | Main systems | <img src="https://img.shields.io/badge/Linux-BBCCEE?logo=linux&logoColor=black" height=30/> <img src="https://img.shields.io/badge/Debian-A81D33?logo=debian&logoColor=white" height=30/> <img src="https://img.shields.io/badge/GNU-4E9A06?logo=gnu&logoColor=white" height=30/> |
    | Developer tools | <img src="https://img.shields.io/badge/GitHub-000000?logo=github&logoColor=white" height=30/> <img src="https://img.shields.io/badge/VS%20Code-007ACC?logo=visualstudiocode&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Maven-C71A36?logo=apachemaven&logoColor=white" height=30/> |
    | Cloud infrastructures | <img src="https://img.shields.io/badge/AWS-%23FF9900?logo=amazonaws&logoColor=white" height=30/>  <img src="https://img.shields.io/badge/Azure-0078D4?logo=microsoftazure&logoColor=white" height=30/>  <img src="https://img.shields.io/badge/Python-3766AB?logo=python&logoColor=white" height=30/>  |
    | Infra tooling (IaC) | <img src="https://img.shields.io/badge/Terraform-623CE4?logo=terraform&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" height=30/> |
    | Main backend technologies | <img src="https://img.shields.io/badge/Java-ED8B00?logo=openjdk&logoColor=black" height=30/> <img src="https://img.shields.io/badge/SpringBoot-6DB33F?logo=springboot&logoColor=white" height=30/> <img src="https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status" height=30/>|
    | Alternative backend | <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" height=30/> <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" height=30/> <img src="https://img.shields.io/badge/php-474A8A?logo=php&logoColor=white" height=30/>
    | Databases & storage | <img src="https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white" height=30/> <img src="https://img.shields.io/badge/MongoDB-4EA94B?logo=mongodb&logoColor=white" height=30/> <img src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white" height=30/> |
    | Website technologies | <img src="https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Font%20Awesome-528DD7?logo=fontawesome&logoColor=white" height=30/> |
    | Backend tecnologies | <img src="https://img.shields.io/badge/React-61DBFB?logo=react&logoColor=black" height=30/> <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" height=30/> <img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" height=30/>



- **Backend** projects into `code/backend` folder:
    - **Java**: main backend project, see [README](./code/backend/java/README.md) for all details, build with Java 21, Spring boot with Hexagonal Architecture. Run application on developer environment with commands:
        - Build project with command `mvn clean install -DskipTests`
        - Execute all unit test with command `mvn clean test`
        - Start service in local environment with command `mvn -pl ms-launcher spring-boot:run`
        - Check local environment with echo API: `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
        -  **sonar-qube** scanner with command `mvn clean package && mvn sonar:sonar -Dsonar.login=TOKEN`
            - [SonarCloud](https://sonarcloud.io/project/overview?id=paths-game-backend-java): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java)
            
    - **Docker**: The java application image is archived into [dockerHub/pathsgames repository](https://hub.docker.com/r/pathsgames/pathsgames). Run backend application with docker image with `prod' profile using *extenal* postgres database:
        ```
        docker run -d -p 8042:8080 \
            -e SPRING_PROFILES_ACTIVE=prod   \
            -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/pathsgames   \
            -e SPRING_DATASOURCE_USERNAME=dbuser   \
            -e SPRING_DATASOURCE_PASSWORD=dbpass   \
            pathsgames/pathsgames:latest
        ```
    - **Python**: the developers team are creating an alternative backend version developed with python, see [README](./code/backend/python/README.md) for all details.
        - Start service into virtual environment `python3 -m app.launcher`
        - [SonarCloud](https://sonarcloud.io/project/information?id=paths-game-backend-python): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python)
    - **Php**: the developers team area creating an alternative backend version developed with php, see [README](./code/backend/php/README.md) for all details.
        - Start service into configured environment `php -S localhost:8042 -t public `
        - [SonarCloud](https://sonarcloud.io/project/information?id=paths-game-backend-php): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php)
    - **AWS Serverless**: an alternative backend based on AWS API Gateway, Lambda and DynamoDB, see [README](./code/backend/aws/README.md) for architecture and deployment details.
- **Robot-test** project into `code/tests/robot` to execute automatic tests with robot-framework!
    - To execute all test run `robot --variablefile variables/dev.yaml --outputdir reports/ tests/`
    - Report is created into `code/tests/robot/reports/report.html` folder.
- **Website** project into `code/website` define all website components:
    - `code/website/html` — source code of [Paths.Games](https://paths.games/) website
    - `code/website/terraform-aws` — Terraform template for AWS infrastructure, see [README](./code/website/terraform-aws/README.md)
    - `code/website/concepts` — design exploration assets (mockups, card concepts, logo, screenshots)
    
- **Frontend**: projects about backend builded with React, Vite and Node.js
    - **React-admin**: *coming soon*
    - **React-game**: *coming soon*


## References
- Game system
    - [Tainted grail](https://awakenrealms.com/games/awaken-realms/tainted-grail)
- GitHub Copilot SDK
    - [copilot-sdk](https://github.com/github/copilot-sdk)
        - [getting-started](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- Ralph-AI system 
    - [Getting started with ralph](https://www.aihero.dev/getting-started-with-ralph)
    - [giuppidev](https://www.youtube.com/watch?v=KK3R7v2Rtew) *italian Language*
        - Code example [ralph-giuppi](https://github.com/giuppidev/ralph-giuppi) 



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




