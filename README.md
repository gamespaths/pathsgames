# Paths Games

<p align="center">
  <a href="https://sonarcloud.io/summary/new_code?id=paths-game-backend-java"><img src="https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status" alt="coverage" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL%20v3-blue" alt="GPL v3" /></a>
</p>




**Paths Games** is a multi-user storytelling game where choices matter. Players explore dynamic worlds, manage resources, and collaborate (or compete) in real-time narrative adventures. 

Crowdfunding campaign *coming soon*. Visit [paths.games](http://paths.games) website. **Open Source**: Built with ❤️ and released under the **GNU-GPL3** license.



## Documentation
Documents includes all steps and the roadmap for create paths.games components, configuration parameters and lists of features reserved for futures versions.



| Version | Steps | Focus | 
| --- | --- | --- |
| 0 | 📝 **Foundation** <br /> Steps 1-11| - ✅ [Start the project](./documentation_v0/Step01_StartProject.md) & [Create the repository](./documentation_v0/Step02_CreateTheRepository.md) & [Define the V1 scope](./documentation_v0/Step03_DefineScope.md) <br />- ✅ [Technology stack](./documentation_v0/Step04_TechnologyStack.md) & [Backend structure](./documentation_v0/Step05_BackendStructure.md) & [Naming conventions](./documentation_v0/Step06_NamingConventions.md) <br />- ✅ [Configure website](./documentation_v0/Step07_ConfigureWebsite.md) & [Configure Environments & CI](./documentation_v0/Step08_ConfigureMinimalCI.md) <br />- ✅ [Design data model](./documentation_v0/Step09_DesignCoreDataModel.md) & [Create initial DB](./documentation_v0/Step10_CreateDBschema.md) & [Define API versioning](./documentation_v0/Step11_DefineAPIVersioning.md) |
| 0.18.0 | 🛠️ **Current version** | - ✅ [Guest login](./documentation_v0/Step12_GuestLoginMethod.md) & [Session management](Step13_SessionTokenManagement.md) & [Stories magement](./documentation_v0/Step14_StoriesImportSystem.md) <br />- ✅ [Stories contents](./documentation_v0/Step15_StoryContentAPIs.md) & [Content details](./Step16_ContentDetailAPIs.md) & [Stories admin operations](./documentation_v0/Step17_StoryAdminCRUD.md) <br />- ✅ [Frontend: Stories catalog](./Step18_GameMainFrontend.md) <br />- 🚧 [**Version 0 Roadmap**](./documentation_v0/Step00_Roadmap.md) & [Developer branch](https://github.com/gamespaths/pathsgames/) 🏗️  |
| 0.42 | 🧑‍🔬 **Single player** <br /> Steps 12-42 |  Single player game engine and website prototype |
| 0.84 | 🧑‍🤝‍🧑 **Multiplayer** <br /> Steps 43-84 | Multiplayer + credentials, WebSocket, trade, chat, lobby, admin tools, SSO |
| 1 | 🏁 **Launch & Hardening** <br /> Steps 85-101 | Security, E2E testing, load testing, monitoring, production infra, docs, V1 launch |
| 2 | 🎯 **Crowfouning campaign** | Creative Commons (CC BY-NC-SA) for contents (images, story, musics, ... ) <br />Anti-Spam Logic (Fatigue) |
| 3 | 🕸️ **Campains** | Tutorial & Hints & Multiple-stories connection and global registry |
| 4 | 🤖 **NPC** | NPCs & Entities & Group Rituals & Combact system & open world system  |
| 5 | 🤖 Game engine | Permadeath & Game Over & Silent Events | 
| 6 | 🤖 Game engine | Timed Missions & Voting System & Noise & Stealth & Multi-Value Registry |
| 7 | 📱 Distributions | Mobile/Android App & Desktop application integrated with Steam & Debian package |
| 42 | 📡 | *Life, the Universe and Everything*| 
| 84 | 🛰️ | *To Boldly Go Where No Man Has Gone Before* |


## 📂 Repository structure and tecnologies

<img src="https://img.shields.io/badge/Java-ED8B00?logo=openjdk&logoColor=black"/> 
<img src="https://img.shields.io/badge/Maven-C71A36?logo=apachemaven&logoColor=white" /> 
<img src="https://img.shields.io/badge/SpringBoot-6DB33F?logo=springboot&logoColor=white" /> 
<img src="https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white" /> 
<img src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white" />
<img src="https://img.shields.io/badge/JUnit-25A162?logo=junit5&logoColor=white" />
<img src="https://img.shields.io/badge/SonarQube-4E9BCD?logo=sonarqube&logoColor=white" />

- **Java**: main backend project on `code/backend/java` folder, see [README](./code/backend/java/README.md).
    project build with Java 21 and Spring boot with Hexagonal Architecture. Run application on developer environment with commands:
    - Build project without run unit-test `mvn clean install -DskipTests`
    - Execute all unit test `mvn clean test`
    - Start service in local environment `mvn -pl ms-launcher spring-boot:run`
    - Check local environment with echo API: `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
-  **sonar-qube** scanner with `/code/script/dev/run_sonar_scanner_java.sh`
    - [SonarCloud](https://sonarcloud.io/project/overview?id=paths-game-backend-java): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java)
    

---
<img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" /> 
<img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" /> 
<img src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white" />

- **Python**: the developers team are creating an alternative backend version developed with python, see [README](./code/backend/python/README.md) for all details.
    - Start virtual environment `python3 -m venv .venv && source .venv/bin/activate`
    - Start application `python3 -m app.launcher`
    - Execute test `pytest tests` or `pytest tests --cov=app --cov-report=term-missing`
    - [SonarCloud](https://sonarcloud.io/project/information?id=paths-game-backend-python): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python)


---
<img src="https://img.shields.io/badge/php-474A8A?logo=php&logoColor=white" /> 
<img src="https://img.shields.io/badge/MySql-gray?logo=MySql&logoColor=white" />

- **Php**: the developers team area creating an alternative backend version developed with php, see [README](./code/backend/php/README.md) for all details.
    - Start service into configured environment `php -S localhost:8042 -t public `
    - Execute test `XDEBUG_MODE=coverage vendor/bin/phpunit tests --coverage-text`
    - [SonarCloud](https://sonarcloud.io/project/information?id=paths-game-backend-php): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-php&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-php)

---
<img src="https://img.shields.io/badge/AWS%20Lambda-%23FF9900?logo=amazonaws&logoColor=white" />   
<img src="https://img.shields.io/badge/Python-3766AB?logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/Pytest-0A9EDC?logo=pytest&logoColor=white" />

- **AWS Serverless**: an alternative backend based on AWS API Gateway, Lambda and DynamoDB, see [README](./code/backend/aws/README.md) for architecture and deployment details.
    - To deploy all components into cloud run `/code/script/dev/aws_backend_deploy.sh`
    - To test all components with robot run `code/script/dev/run_robot_with_aws_serverless.sh`
    - To remove all component run `/code/script/dev/aws_backend_remove.sh`
    - [SonarCloud](https://sonarcloud.io/project/overview?id=pathsgames_backend-aws-lambda): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=bugs)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=coverage)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda)

---
<img src="https://img.shields.io/badge/Robot%20Framework-000000?logo=robotframework&logoColor=white" /> 
<img src="https://img.shields.io/badge/Python-3766AB?logo=python&logoColor=white" />

- **Robot-test** project into `code/tests/robot` to execute automatic tests with robot-framework!
    - To execute all test run script: `/code/script/dev/run_robot_everywhere.sh`
        - Reports are created into `code/script/dev/run_robot_results` folder
    - To execute manually all test run `robot --variablefile variables/dev.yaml --outputdir reports/ tests/`
        - Report is created into `code/tests/robot/reports/` folder.

---
<img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap&logoColor=white" />
<img src="https://img.shields.io/badge/Font%20Awesome-528DD7?logo=fontawesome&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white" />
<img src="https://img.shields.io/badge/React%20Router-CA4245?logo=reactrouter&logoColor=white" />

- **Frontend/React-game**: Main game frontend/website. See [README](./code/frontend/react-game/README.md).
    - All code is available into `code/frontend/react-game` folder. 
    - To run it locally `npm run dev`
    - To run all test `npm run test`
    - [SonarCloud](https://sonarcloud.io/project/information?id=pathsgames_frontend-react-game) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=bugs)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=coverage)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game)


---
<img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap&logoColor=white" />
<img src="https://img.shields.io/badge/Font%20Awesome-528DD7?logo=fontawesome&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white" />
<img src="https://img.shields.io/badge/React%20Router-CA4245?logo=reactrouter&logoColor=white" />

- **Frontend/React-admin**: Admin and content management system with stories, cards. See [README](./code/frontend/react-admin/README.md)
    - All code is available into `code/frontend/react-admin` folder. 
    - To run it locally `npm run dev`
    - To run all test `npm run test`
    - Test execution: `npm run test` or `robot --variablefile variables/dev.yaml --outputdir reports/ tests/`
    - [SonarCloud](https://sonarcloud.io/project/configuration?id=gamespaths_frontend-react-admin): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=bugs)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=coverage)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin)


---
<img src="https://img.shields.io/badge/AWS-%23FF9900?logo=amazonaws&logoColor=white" /> 
<img src="https://img.shields.io/badge/Terraform-623CE4?logo=terraform&logoColor=white" /> 
<img src="https://img.shields.io/badge/Google%20Tag%20Manager-246FDB?logo=googletagmanager&logoColor=white" />

- **WebSite terraform** [README](./code/website/terraform-aws/README.md): Terraform configuration provisions the full AWS infrastructure required for static website hosting.
    - It creates and configures an S3 bucket for storing and serving static files, with versioning and security policies.
    - CloudFront is set up as a CDN with HTTPS support, custom error pages, and geo-restrictions, using an ACM certificate for SSL.
    - Route53 DNS records and AWS SSM parameters are managed for domain routing and dynamic Content Security Policy (CSP) configuration.
    - Optional AWS WAF integration provides additional security, and all resources are defined as code for repeatable, automated deployments.

---
<img src="https://img.shields.io/badge/GitHub-000000?logo=github&logoColor=white" /> 
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" />

- **GitHub actions** configurated into `.github/workflows` folder
    - Backend-ci: Runs main backend build, test, and packaging pipeline for all supported stacks.
    - Sonarqube-aws-lambda: Analyzes AWS Lambda backend code quality and security with SonarQube.
    - Sonarqube-java: Runs SonarQube analysis for the Java backend, checking code quality and coverage.
    - Sonarqube-php: Runs SonarQube analysis for the PHP backend, checking code quality and coverage.
    - Sonarqube-python: Runs SonarQube analysis for the Python backend, checking code quality and coverage.
    - Sonarqube-react-game: Runs SonarQube analysis for the React-game frontend, checking code quality and coverage.
    - Sonarqube-react-admin: Runs SonarQube analysis for the React-admin frontend, checking code quality and coverage.
    - Website-deploy: Deploys the static website to the production hosting environment.
---

<img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" />
<img src="https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white" />
<img src="https://img.shields.io/badge/Linux-BBCCEE?logo=linux&logoColor=black" /> 
<img src="https://img.shields.io/badge/Debian-A81D33?logo=debian&logoColor=white" />  

- **Docker**: The java application image is archived into [dockerHub/pathsgames repository](https://hub.docker.com/r/pathsgames/pathsgames).
    -  Run backend application with docker image with `prod' profile using *extenal* postgres database:
        ```
        docker run -d -p 8042:8080 -e SPRING_PROFILES_ACTIVE=prod   \
            -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/pathsgames   \
            -e SPRING_DATASOURCE_USERNAME=dbuser   -e SPRING_DATASOURCE_PASSWORD=dbpass   \    
            pathsgames/pathsgames:latest
        ```






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



