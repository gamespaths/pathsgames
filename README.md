# Paths Games

<p align="center">
  <a href="https://sonarcloud.io/summary/new_code?id=paths-game-backend-java"><img src="https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status" alt="coverage" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL%20v3-blue" alt="GPL v3" /></a>
</p>




**Paths Games** is a multi-user storytelling game where choices matter. Players explore dynamic worlds, manage resources, and collaborate (or compete) in real-time narrative adventures. 

Crowdfunding campaign *coming soon*. Visit [paths.games](http://paths.games) website. 

**Open Source**: Built with ❤️ and released under the **GNU-GPL3** license.


## Documentation
Start from the [**documentation index**](./wiki/INDEX.md). Shared documents (game rules, data model, story format, architecture, security, environments) live in [`wiki/`](./wiki/); every version has its own folder `wiki/documentation_vN/` with a roadmap of exactly 42 steps (rules in the [Version Template](./wiki/VersionTemplate.md)). All versions are summarised in the [**Global Roadmap**](./wiki/Roadmap.md) and every idea is tracked in the [Backlog](./wiki/Backlog.md).



| Version | Focus | 
| --- | --- |
| 📝 **Project Foundation** <br /> Version 0 - alpha |✅ [Start the project](./wiki/documentation_v0/Step01_StartProject.md) & [Create the repository](./wiki/documentation_v0/Step02_CreateTheRepository.md) & [Define the V1 scope](./wiki/documentation_v0/Step03_DefineScope.md) <br />✅ [Technology stack](./wiki/documentation_v0/Step04_TechnologyStack.md) & [Backend structure](./wiki/documentation_v0/Step05_BackendStructure.md) & [Naming conventions](./wiki/documentation_v0/Step06_NamingConventions.md) <br /> ✅ [Configure website](./wiki/documentation_v0/Step07_ConfigureWebsite.md) & [Configure Environments & CI](./wiki/documentation_v0/Step08_ConfigureMinimalCI.md) <br />✅ [Design data model](./wiki/documentation_v0/Step09_DesignCoreDataModel.md) & [Create initial DB](./wiki/documentation_v0/Step10_CreateDBschema.md) & [Define API versioning](./wiki/documentation_v0/Step11_DefineAPIVersioning.md) |
| 📖 **Stories & match** <br /> Version 0 - alpha |✅ [Guest login](./wiki/documentation_v0/Step12_GuestLoginMethod.md) & [Session management](./wiki/documentation_v0/Step13_SessionTokenManagement.md) & [Stories management](./wiki/documentation_v0/Step14_StoriesImportSystem.md) <br />✅ [Stories contents](./wiki/documentation_v0/Step15_StoryContentAPIs.md) & [Content details](./wiki/documentation_v0/Step16_ContentDetailAPIs.md) & [Stories admin operations](./wiki/documentation_v0/Step17_StoryAdminCRUD.md) <br />✅ [Frontend: Stories catalog](./wiki/documentation_v0/Step18_GameMainFrontend.md) & [Match creation](./wiki/documentation_v0/Step19_SinglePlayerMatchCreation.md) & [Game first run](./wiki/documentation_v0/Step20_GameWebSiteFirstRun.md) <br />✅ [Character selection](./wiki/documentation_v0/Step21_CharacterSelection.md)  & [Story validation](./wiki/documentation_v0/Step22_StoryValidation.md) & [Character stats](./wiki/documentation_v0/Step23_CharacterStatsInitialization.md) |
| ⚙️ **Turns, movements & events** <br /> Version 0 - alpha |✅ [Turn cycle engine](./wiki/documentation_v0/Step24_TurnCycleEngine.md) & [Time clock cycle](./wiki/documentation_v0/Step25_TimeAdvancementClockCycle.md) & [Time-start recovery](./wiki/documentation_v0/Step26_TimeStartRecovery.md) <br/>✅ [Weather System](./wiki/documentation_v0/Step27_WeatherSystem.md) & [Movement System](./wiki/documentation_v0/Step28_MovementSystem.md) & [Normal Events](./wiki/documentation_v0/Step29_NormalEvents.md) <br />✅ [Coma and status](./wiki/documentation_v0/Step30_EdgeStates.md) & [Choice engine](./wiki/documentation_v0/Step31_ChoiceEngine.md) & [Choice resolution](./wiki/documentation_v0/Step32_ChoiceResolution.md)<br />✅ [Location events](./wiki/documentation_v0/Step33_LocationEntryEvents.md) & [Inventory](./wiki/documentation_v0/Step34_InventoryAndResources.md) & [Items resolution](./wiki/documentation_v0/Step35_ItemsResolution.md) |
| 🧑‍🔬 **Registry, missions & alpha** <br />  Version 0 - alpha | ✅ [Registry engine](./wiki/documentation_v0/Step36_RegistrySystem.md) & [Missions](./wiki/documentation_v0/Step37_MissionSystem.md) & [Experience system](./wiki/documentation_v0/Step38_ExperienceSystem.md)<br /> ✅ [Random events](./wiki/documentation_v0/Step39_RandomEvents.md) <br /> 🚧 Alpha UX polish (40) & Alpha preparation (41) <br /> 🚀 **Alpha launch** (42) — single-player on AWS <br /><br /> [**V0 Roadmap**](./wiki/documentation_v0/Roadmap.md) & [Developer branch](https://github.com/gamespaths/pathsgames/) 🏗️ |
| 🔐 **V1 — beta** <br /> Accounts & depth | 📝 [Roadmap draft](./wiki/documentation_v1/Roadmap.md) <br /> Google SSO & profile & guest linking <br /> EN/IT & accessibility & optional music <br /> Story frontend data & permadeath & game over <br /> Admin tool & admin messages & crowdfunding & content licenses |
| 🌍 **V2 — gamma** <br /> A living world | 📝 [Roadmap draft](./wiki/documentation_v2/Roadmap.md) <br /> Steam SSO & campaigns & global registry & advanced analytics <br /> Timed missions & silent events & warehouse <br /> NPCs & entities & open world & noise and stealth & user progression |
| 📱 **V3 — delta** <br /> Everywhere | 📝 [Roadmap draft](./wiki/documentation_v3/Roadmap.md) <br /> Android app (online) & Steam app & Debian package <br /> Offline backend & sync & performance & free actions |
| 🧑‍🤝‍🧑 **V4 — epsilon** <br /> Multiplayer | 📝 [Roadmap draft](./wiki/documentation_v4/Roadmap.md) <br /> Realtime channel & lobby & multiplayer turns & anti-stall <br /> Group movement & coma rescue & multiplayer game board |
| 🗳️ **V5 — zeta** <br /> Advanced multiplayer | 📝 [Roadmap draft](./wiki/documentation_v5/Roadmap.md) <br /> Trade & chat & notifications <br /> Player signals & voting & group rituals & spectator mode |
| 🏗️ **V6 — eta** <br /> Infrastructure | 📝 [Roadmap draft](./wiki/documentation_v6/Roadmap.md) <br /> Kubernetes & Azure (Docker) & Cloudflare <br /> Disaster recovery & monitoring & security audit |
| 📡 | *Life, the Universe and Everything*| 
| 🛰️ | *To Boldly Go Where No Man Has Gone Before* |


## 📂 Repository structure and technologies



- **Java**: main backend project on `code/backend/java` folder, see [README](./code/backend/java/README.md).
    project build with Java 21 and Spring boot with Hexagonal Architecture. Run application on developer environment with commands:
    - Technologies <img src="https://img.shields.io/badge/Java-ED8B00?logo=openjdk&logoColor=black"/> <img src="https://img.shields.io/badge/Maven-C71A36?logo=apachemaven&logoColor=white" /> <img src="https://img.shields.io/badge/SpringBoot-6DB33F?logo=springboot&logoColor=white" /> <img src="https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white" /> <img src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white" /> <img src="https://img.shields.io/badge/JUnit-25A162?logo=junit5&logoColor=white" /> <img src="https://img.shields.io/badge/SonarQube-4E9BCD?logo=sonarqube&logoColor=white" />
    - Build project without run unit-test `mvn clean install -DskipTests`
    - Execute all unit test `mvn clean test`
    - Start service in local environment `mvn -pl ms-launcher spring-boot:run`
    - Check local environment with echo API: `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
    -  **sonar-qube** scanner with `code/scripts/dev/sonar/run_sonar_scanner_java.sh`
        - [SonarCloud](https://sonarcloud.io/project/overview?id=paths-game-backend-java): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java)
        
- **Python**: the developers team are creating an alternative backend version developed with python, see [README](./code/backend/python/README.md) for all details.
    - Technologies <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" /> <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" /> <img src="https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white" />
    - Start virtual environment `python3 -m venv .venv && source .venv/bin/activate`
    - Start application `python3 -m app.launcher`
    - Execute test `pytest tests` or `pytest tests --cov=app --cov-report=term-missing`
    - [SonarCloud](https://sonarcloud.io/project/information?id=paths-game-backend-python): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-python&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-python)


- **AWS Serverless**: an alternative backend based on AWS API Gateway, Lambda and DynamoDB, see [README](./code/backend/aws/README.md) for architecture and deployment details.
    - Technologies <img src="https://img.shields.io/badge/AWS%20Lambda-%23FF9900?logo=amazonaws&logoColor=white" /> <img src="https://img.shields.io/badge/Python-3766AB?logo=python&logoColor=white" /> <img src="https://img.shields.io/badge/Pytest-0A9EDC?logo=pytest&logoColor=white" />
    - To deploy all components into cloud run `code/scripts/test/aws/aws_backend_deploy.sh [dev|test]`; production is deployed with `sam deploy --config-env prod` from `code/backend/aws/`.
    - To test all components with robot run `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh`
        - The stage name equals the environment: `https://<id>.execute-api.us-east-2.amazonaws.com/<env>/api/echo/status` (e.g. `/test/`); the test stack also answers on the custom domain `https://api-test.paths.games/api/echo/status`.
    - To check cloudformation stack (run from the repository root) `source .env && aws cloudformation describe-stacks --region "${AWS_REGION_TEST:-us-east-2}" --stack-name "${AWS_STACK_NAME_TEST:-pathsgames-test}" --query "Stacks[0].Outputs" --output table`, or simply run `code/scripts/test/aws/aws_check_status.sh`.
    - To remove all component run `code/scripts/test/aws/aws_backend_remove.sh [dev|test]`
    - [SonarCloud](https://sonarcloud.io/project/overview?id=pathsgames_backend-aws-lambda): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=bugs)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=coverage)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_backend-aws-lambda&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=pathsgames_backend-aws-lambda)


- **Frontend/React-game**: Main game frontend/website. See [README](./code/frontend/react-game/README.md).
    - Technologies <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" /> <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" /> <img src="https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white" /> <img src="https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap&logoColor=white" /> <img src="https://img.shields.io/badge/Font%20Awesome-528DD7?logo=fontawesome&logoColor=white" /> <img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" /> <img src="https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white" /> <img src="https://img.shields.io/badge/React%20Router-CA4245?logo=reactrouter&logoColor=white" />
    - All code is available into `code/frontend/react-game` folder. 
    - To run it locally `npm run dev`
    - To run all test `npm run test` e `npm run test:coverage`
    - [SonarCloud](https://sonarcloud.io/project/information?id=pathsgames_frontend-react-game) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=bugs)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=coverage)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pathsgames_frontend-react-game&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=pathsgames_frontend-react-game)


- **Frontend/React-admin**: Admin and content management system with stories, cards. See [README](./code/frontend/react-admin/README.md)
    - Technologies <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" /> <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" /> <img src="https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white" /> <img src="https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap&logoColor=white" /> <img src="https://img.shields.io/badge/Font%20Awesome-528DD7?logo=fontawesome&logoColor=white" /> <img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" /> <img src="https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white" /> <img src="https://img.shields.io/badge/React%20Router-CA4245?logo=reactrouter&logoColor=white" />
    - All code is available into `code/frontend/react-admin` folder. 
    - To run it locally `npm run dev`
    - To run all test `npm run test`
    - [SonarCloud](https://sonarcloud.io/project/configuration?id=gamespaths_frontend-react-admin): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=bugs)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=coverage)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=gamespaths_frontend-react-admin&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=gamespaths_frontend-react-admin)

- **WebSite terraform** [README](./code/website/terraform-aws/README.md): Terraform configuration provisions the full AWS infrastructure required for static website hosting.
    - Technologies <img src="https://img.shields.io/badge/AWS-%23FF9900?logo=amazonaws&logoColor=white" /> <img src="https://img.shields.io/badge/Terraform-623CE4?logo=terraform&logoColor=white" /> <img src="https://img.shields.io/badge/Google%20Tag%20Manager-246FDB?logo=googletagmanager&logoColor=white" />
    - The module (`code/website/terraform-aws`, README there) is environment-parameterized: one Terraform state per environment, run through `./tf.sh <test|production> <init|plan|apply>`; `production` hosts the static website `paths.games` (bucket `pathsgames-com`), `test` hosts the react-game frontend on `test.paths.games` (bucket `pathsgames-com-test`). State lives in `s3://pathsgames-production-iac` / `s3://pathsgames-test-iac`.
    - Per environment it creates: S3 bucket (versioning, encryption, public access blocked, CloudFront-only bucket policy), CloudFront distribution with HTTPS, SPA fallback error pages and geo-restrictions, a security-headers policy with a dynamic Content Security Policy, and an optional WAF.
    - Shared resources owned by `production` and looked up by the other environments: the ACM certificate (`paths.games`, `*.paths.games`, `pathsgames.com`) and the SSM parameters holding the CSP allowlists. Route53 DNS records are NOT managed by Terraform (they are created by hand). All resources carry the standard tags (`CostCenter`, `Environment`, `ManagedBy=Terraform`, `Owner`, `Project`, `version`, `Name`).
    - Content is not deployed by Terraform: production via the `website-deploy` GitHub workflow, test via `code/scripts/test/aws/deploy_frontend-game_on_aws.sh`.

- **Robot-test** project into `code/tests/robot` to execute automatic tests with robot-framework!
    - Technologies <img src="https://img.shields.io/badge/Robot%20Framework-000000?logo=robotframework&logoColor=white" /> <img src="https://img.shields.io/badge/Python-3766AB?logo=python&logoColor=white" />
    - To execute all test run script: `/code/scripts/dev/run_robot_everywhere.sh`
        - Reports are created into `code/scripts/dev/run_robot_results` folder
    - To execute manually all test run `robot --variablefile variables/dev.yaml --outputdir reports/ tests/`
        - Report is created into `code/tests/robot/reports/` folder.

- **GitHub actions** configurated into `.github/workflows` folder
    - Technologies <img src="https://img.shields.io/badge/GitHub-000000?logo=github&logoColor=white" /> <img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" />
    - Backend-ci: Builds and tests the Java backend with Maven and pushes its Docker image.
    - Sonarqube-aws-lambda: Analyzes AWS Lambda backend code quality and security with SonarQube.
    - Sonarqube-java: Runs SonarQube analysis for the Java backend, checking code quality and coverage.
    - Sonarqube-python: Runs SonarQube analysis for the Python backend, checking code quality and coverage.
    - Sonarqube-react-game: Runs SonarQube analysis for the React-game frontend, checking code quality and coverage.
    - Sonarqube-react-admin: Runs SonarQube analysis for the React-admin frontend, checking code quality and coverage.
    - Website-deploy: Deploys the static website to the production hosting environment.

- **Docker**: The java application image is archived into [dockerHub/pathsgames repository](https://hub.docker.com/r/pathsgames/pathsgames).
    - Technologies <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" /> <img src="https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white" /> <img src="https://img.shields.io/badge/Linux-BBCCEE?logo=linux&logoColor=black" /> <img src="https://img.shields.io/badge/Debian-A81D33?logo=debian&logoColor=white" />  
    -  Run backend application with docker image with `prod' profile using *extenal* postgres database:
        ```
        docker run -d -p 8042:8080 -e SPRING_PROFILES_ACTIVE=prod   \
            -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/pathsgames   \
            -e SPRING_DATASOURCE_USERNAME=dbuser   -e SPRING_DATASOURCE_PASSWORD=dbpass   \    
            pathsgames/pathsgames:latest
        ```






## References
- Technologies
    - Java: 
        [Java 21 (OpenJDK)](https://openjdk.org/projects/jdk/21/) 
        , [Spring Boot 3](https://spring.io/projects/spring-boot)
        , [Hibernate](https://hibernate.org/orm/)
        , [Flyway](https://flywaydb.org/)
        , [PostgreSQL](https://www.postgresql.org/)
        , [SQLite](https://www.sqlite.org/)
        , [MongoDB](https://www.mongodb.com/)
        , [Apache Kafka](https://kafka.apache.org/)
        , [Spring WebSocket](https://docs.spring.io/spring-framework/reference/web/websocket.html)
        , [JJWT](https://github.com/jwtk/jjwt)
        , [Maven](https://maven.apache.org/)
        , [JUnit 5](https://junit.org/junit5/)
        , [Mockito](https://site.mockito.org/)
        , [JaCoCo](https://www.jacoco.org/jacoco/)
        , [OpenAPI 3](https://www.openapis.org/)
    - Python:
        [Python 3](https://www.python.org/)
        , [FastAPI](https://fastapi.tiangolo.com/)
        , [Uvicorn](https://www.uvicorn.org/)
        , [Pydantic](https://docs.pydantic.dev/)
        , [SQLAlchemy 2](https://www.sqlalchemy.org/)
        , [pytest](https://docs.pytest.org/)
        , [HTTPX](https://www.python-httpx.org/)
    - AWS serverless backend:
        [AWS SAM](https://aws.amazon.com/serverless/sam/)
        , [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
        , [AWS Lambda](https://aws.amazon.com/lambda/)
        , [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
        , [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)
        , [Amazon CloudWatch Logs](https://aws.amazon.com/cloudwatch/)
        , [AWS Certificate Manager](https://aws.amazon.com/certificate-manager/)
        , [Amazon Route 53](https://aws.amazon.com/route53/)
        , [AWS SDK for Python (boto3)](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
    - Website & infrastructure:
        [Terraform](https://www.terraform.io/)
        , [Amazon S3](https://aws.amazon.com/s3/)
        , [Amazon CloudFront](https://aws.amazon.com/cloudfront/)
        , [AWS WAF v2](https://aws.amazon.com/waf/)
        , [AWS Systems Manager Parameter Store](https://aws.amazon.com/systems-manager/features/#Parameter_Store)
        , [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
        , [Google Tag Manager](https://tagmanager.google.com/)
        , [Bootstrap 5](https://getbootstrap.com/)
        , [Font Awesome](https://fontawesome.com/)
    - Frontends:
         [React 18](https://react.dev/)
        , [Vite 5](https://vitejs.dev/)
        , [React Router 6](https://reactrouter.com/)
        , [Axios](https://axios-http.com/)
        , [Tailwind CSS](https://tailwindcss.com/)
        , [PostCSS](https://postcss.org/)
        , [DOMPurify](https://github.com/cure53/DOMPurify)
        , [vanilla-cookieconsent](https://cookieconsent.orestbida.com/)
        , [@marsidev/react-turnstile](https://github.com/marsidev/react-turnstile)
        , [Node.js](https://nodejs.org/)
    - Testing & quality:
         [Robot Framework 7](https://robotframework.org/)
        , [Vitest](https://vitest.dev/)
        , [SonarQube / SonarCloud](https://www.sonarsource.com/products/sonarcloud/)
    - CI/CD & containers:
         [GitHub Actions](https://docs.github.com/en/actions)
        , [Docker](https://www.docker.com/)
        , [Docker Hub](https://hub.docker.com/r/pathsgames/pathsgames)
- Game system: 
    [Tainted grail](https://awakenrealms.com/games/awaken-realms/tainted-grail)
- GitHub Copilot SDK:
    [copilot-sdk](https://github.com/github/copilot-sdk)
    , [getting-started](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- Ralph-AI system :
    [Getting started with ralph](https://www.aihero.dev/getting-started-with-ralph)
    , [giuppidev](https://www.youtube.com/watch?v=KK3R7v2Rtew)
    , [ralph-giuppi](https://github.com/giuppidev/ralph-giuppi) 



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



