# Paths Games

**Paths Games** is a multiplayer game inspired by classic gamebooks, adapted to modern gaming mechanics.

- ✅ Paths games is free-to-play game, all code will be released with GNU-GPL3 licence

- crowdfunding campaign *coming soon*

## Documentation
Documents includes all steps in roadmap for example development components, configuration parameters and lists of features reserved for futures versions.

- [Version 1 Roadmap](./documentation_v1/Step00_Roadmap.md): start project and create the first playable version of *Paths Games*
    - Step 1: [Start the project](./documentation_v1/Step01_StartProject.md) *(italian language, traslation coming soon)*
    - Step 2: [Create the repository](./documentation_v1/Step02_CreateTheRepository.md)
    - Step 3: [Define the scope](./documentation_v1/Step03_DefineScope.md)
    - Step 4: [Define the tecnoloty stack](./documentation_v1/Step04_TechnologyStack.md)
    - Step 5: [Define the backend structure](./documentation_v1/Step05_BackendStructure.md)
    - Step 6: [Define naming conventions](./documentation_v1/Step06_NamingConventions.md)
    - check [developer branch](https://github.com/gamespaths/pathsgames/tree/developer) for last updates

- Version 2: crowfouning campaign start and Creative Commons (CC BY-NC-SA) for contents (images, story, musics, ... )

- Version 3: integration with Google play with Android App and, Steam with desktop application, Debian with dedicated package

- Version 4: graphical with advanced game-engine

- Version 5: to execute the game-engine on remote application


## Tecnical components
- **Backend** project into `code/backend`, see [README](./code/backend/README.md) for all details
    - Build project with command `cd code/backend && mvn clean install -DskipTests`
    - Execute all unit test with command `cd code/backend && mvn clean test`
    - Start service in local environment with command `cd code/backend && mvn -pl ms-launcher spring-boot:run`
    - Check local environmne with echo API with command `curl -s http://localhost:8042/api/echo/status | python3 -m json.tool`
- **Website**
    - `code/website/html` source code of [Paths.Games](https://paths.games/) website
    - `code/website/terraform-aws` terraform template to create the website into AWS infrastrure, see [README](./code/website/terraform-aws/README.md) for all details
    


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




