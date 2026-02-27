# Paths Games

**Paths Games** is a multiplayer game inspired by classic gamebooks, adapted to modern gaming mechanics.

- Visit [paths.games](http://paths.games) website.

- ✅ Paths games is free-to-play game, all code will be released with GNU-GPL3 licence

- crowdfunding campaign *coming soon*

## Documentation
Documents includes all steps in roadmap for example development components, configuration parameters and lists of features reserved for futures versions.

- [Version 1 Roadmap](./documentation_v1/Step00_Roadmap.md): start project and create the first playable version of *Paths Games*
    - check [developer branch](https://github.com/gamespaths/pathsgames/tree/developer) for last updates

- Version 2: crowfouning campaign start and Creative Commons (CC BY-NC-SA) for contents (images, story, musics, ... )

- Version 3: integration with Google play with Android App and, Steam with desktop application, Debian with dedicated package

- Version 4: graphical with advanced game-engine

- Version 5: to execute the game-engine on remote application


## Tecnical components

- **Main tecnical stack**
    | Category | Components |
    |---|:---:|
    | Systems | <img src="https://img.shields.io/badge/Linux-BBCCEE?style=for-the-badge&logo=linux&logoColor=black" /> <img src="https://img.shields.io/badge/Debian-A81D33?style=for-the-badge&logo=debian&logoColor=white" /> <img src="https://img.shields.io/badge/GNU-4E9A06?style=for-the-badge&logo=gnu&logoColor=white" /> |
    | Developer tools | <img src="https://img.shields.io/badge/GitHub-000000?style=for-the-badge&logo=github&logoColor=white" /> <img src="https://img.shields.io/badge/VS%20Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" /> <img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white" /> |
    | Cloud infrastructure | <img src="https://img.shields.io/badge/AWS-%23FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" />  <img src="https://img.shields.io/badge/Azure-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" />  <img src="https://img.shields.io/badge/Python-3766AB?style=for-the-badge&logo=python&logoColor=white" />  |
    | Infra tooling (IaC) | <img src="https://img.shields.io/badge/Terraform-623CE4?style=for-the-badge&logo=terraform&logoColor=white" /> <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" /> <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" /> |
    | Main backend technologies | <img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=black" /> <img src="https://img.shields.io/badge/SpringBoot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" /> <img src="https://img.shields.io/badge/Apache%20Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white" />|
    | Databases & storage | <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" /> <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" /> <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" /> |
    | Website technologies | <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" /> <img src="https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" /> <img src="https://img.shields.io/badge/Font%20Awesome-528DD7?style=for-the-badge&logo=fontawesome&logoColor=white" /> |

- **Backend** project into `code/backend`, see [README](./code/backend/README.md) for all details
    - Hexagonal Architecture (ports & adapters)
    - Build project with command `cd code/backend && mvn clean install -DskipTests`
    - Execute all unit test with command `cd code/backend && mvn clean test`
    - Start service in local environment with command `cd code/backend && mvn -pl ms-launcher spring-boot:run`
    - Check local environment with echo API: `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
    - REST API versioned under `/api/v1/` (auth, stories, games, gameplay, gamechat, admin)
    - Real-time communication via STOMP over WebSocket on topic `/topic/v1/game/{id}`

- **Website** project into `code/website`
    - `code/website/html` — source code of [Paths.Games](https://paths.games/) website
    - `code/website/terraform-aws` — Terraform template for AWS infrastructure, see [README](./code/website/terraform-aws/README.md)
    - `code/website/concepts` — design exploration assets (mockups, card concepts, logo, screenshots)
    


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




