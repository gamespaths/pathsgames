# AlNao Paths Game

**AlNao Paths Game**: AlNaoPathsGame is a librogame-style multiplayer story game with React frontends and Java Spring Boot backends, stored in the referenced GitHub repo.
- Players register/login (JWT, optional Google SSO), create or join timed “matches” with selectable stories, difficulty and character choices.
- Core mechanics: time-based turns, character stats (energy, life, sadness, experience), inventories, classes, and per-character backpacks with weight limits. World model: named locations with neighbors, movement costs affected by weather, event triggers on entry or time, and group follow mechanics. Events and choices drive narrative changes, modify registry keys/objects/stats, can trigger new events or change weather, and may have activation conditions. Game state is tracked in a comprehensive registry and many game tables (players, matches, events, choices, inventory, snapshots, logs) suggested for PostgreSQL/SQLite.
- Tecnical information: REST APIs and WebSocket topics are defined for auth, stories, games, gameplay actions, chat, admin controls, and real-time turn/event updates. Services, scheduled jobs, and backend methods are outlined (locking, snapshots, time progression, event execution, integrity checks, notifications). Frontend component list covers login, lobby, character cards, map/grid, event/choice panels, turn UI, chat, admin tools, and card-collector UI.
- V1: The document includes a 30-step development roadmap, many configuration parameters, and a list of features reserved for a later version. A project plan to build a playable web-based game called AlNaoPathsGame, with detailed requirements and scope for a V1 release.




## Documentation
- Step 1 [Start the project](./documentation/Step01_StartProject.md) *(italian language, traslation coming soon)*
- Step 2 [Create the repository](./documentation/Step02_CreateTheRepository.md)
- *coming soon*


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



# &lt; AlNao /&gt;
All source code and informations in this repository are the result of careful and patient development work by AlNao, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For further details, in-depth information, or requests for clarification, please visit AlNao.it.



## License
Made with ❤️ by <a href="https://www.alnao.it">AlNao</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.




