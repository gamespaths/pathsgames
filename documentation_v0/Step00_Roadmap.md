# Paths Games V0 - Roadmap & Todo-List

This document defines the **project plan** to build a **Paths Games**, an playable web-based game, with detailed requirements and scope for create the V1 release.

The file lists a 30-step development roadmap (each with five substeps) covering repo setup, V1 scope, tech stack, backend modules, environments, CI, and naming conventions. It specifies core gameplay systems: data model, game state, turn cycle, timeouts, WebSocket sync, movement, choices, event handling, logging, snapshots, admin tools, and testing/playtest. Frontend requirements include a minimal playable UI (login, lobby, turn/status display, events and inputs) and component planning for a web client.


# Roadmap

| Step |  | Main goals |
| ---- | ----- | ---------- |
| [Start the project](./Step01_StartProject.md) | ✅ | Write ideas on document, define 30 steps to execute to start the project, a simple list and for each step give 5 subpoints. <br /> *italian language, traslation coming soon* |
| [Create the repository](./Step02_CreateTheRepository.md) | ✅ | Choose repository platform, initialize an empty repository, set the main branch and define basic access rules |
| [Define the V1 scope](./Step03_DefineScope.md) | ✅ | Define the V1 scope, list mandatory features, list excluded features, define maximum complexity limit, establish what makes V1 "finished", freeze decisions until V2 |
| [Technology stack](./Step04_TechnologyStack.md) | ✅ | Select backend language, select backend framework, select primary database, select frontend technology, select deployment system |
| [Backend structure](./Step05_BackendStructure.md) | ✅ | Separate domain from infrastructure, define API module, define realtime module, define persistence module, define shared services module, create backend project and first build |
| [Naming conventions](./Step06_NamingConventions.md) | ✅ | Define REST endpoint naming, define WebSocket event naming, define table and column naming, define DTO and payload naming |
| [Configure website](./Step07_ConfigureWebsite.md) | ✅ | Define and buy domains [paths.games](http://paths.games/) & [pathsgames.com](http://pathsgames.com/), create terraform template, deploy terraform template into cloud system, create first version of website, deploy first version of website
| [Configure CI](./Step08_ConfigureCI.md) | ✅ | Define environment-specific configurations, separate credentials and secrets, choose CI system (GitHub Actions), define build pipelines (backend Docker + website S3), run automated tests, fail pipeline on errors, connect CI to the main branch |
| [Design core data model](./Step09_DesignCoreDataModel.md) | ✅ | Identify main entities, define relationships between entities, identify persistent vs transient data, list valid game states, define rules that must never be broken, validate models with real cases |
| [Create initial DB schema](./Step10_CreateDBschema.md) | ✅ | Translate the data model into tables, define primary keys, define foreign keys, version the schema |

## Next steps

11. Define API versioning
    - Establish a versioning scheme
    - Decide backward compatibility policy
    - Define deprecation strategy
    - Document supported versions
    - Prepare structure for future versions
12. Implement basic authentication
    - Define authentication method
    - Handle user registration
    - Handle login
    - Handle session/token validation
    - Handle logout and expiration
13. Implement match creation and joining
    - Create endpoint to create matches
    - Manage match invite/code
    - Handle player joining
    - Validate match state on join
    - Notify connected clients
14. Implement minimal match state
    - Define initial match state
    - Handle state transitions
    - Expose state via API
    - Sync state via WebSocket
    - Validate state consistency
15. Implement basic turn cycle
    - Define turn order
    - Manage active turn
    - Block out-of-turn actions
    - Handle turn passing
    - Notify turn changes
16. Implement time and timeout management
    - Define turn duration
    - Start a timer for turns
    - Handle automatic expiration
    - Apply default action on timeout
    - Notify clients on timeout
17. Implement WebSocket and state sync
    - Define WebSocket channels
    - Handle connect/disconnect
    - Authenticate WS connections
    - Send state updates
    - Handle transmission errors
18. Handle reconnect and client desync
    - Detect disconnections
    - Allow safe reconnects
    - Send full state on reconnect
    - Resolve state conflicts
    - Log desync events
19. Implement match registry
    - Define registry structure
    - Handle writing events to registry
    - Expose registry to internal systems
    - Sync registry changes
    - Validate registry consistency
20. Implement minimal automatic events
    - Define event triggers
    - Activate events on condition
    - Apply event effects
    - Update match state
    - Notify players
21. Implement choices and resolution
    - Define choice structure
    - Validate choice availability
    - Handle choice selection
    - Resolve choice effects
    - Notify players of outcomes
22. Implement movement and basic locations
    - Define location structure
    - Define adjacency
    - Validate allowed movement
    - Apply movement cost
    - Handle entry events
23. Implement a minimal playable frontend
    - Implement login UI
    - Implement match lobby
    - Display turn state
    - Show events and choices
    - Handle player input
24. Handle errors and edge states
    - Handle duplicate actions
    - Handle out-of-time actions
    - Handle stuck matches
    - Handle inconsistent data
    - Show clear client errors
25. Implement logging and audit
    - Log player actions
    - Log system events
    - Log application errors
    - Link logs to matches
    - Preserve critical logs
26. Implement match snapshots
    - Define snapshot format
    - Create manual snapshot
    - Create automatic snapshot
    - Restore from snapshot
    - Validate restore integrity
27. Implement minimal admin tools
    - View match states
    - Force turn advancement
    - End stuck matches
    - Restore snapshots
    - Manage problematic users
28. Write a complete test story
    - Define a minimal plot
    - Define initial locations
    - Define main events
    - Define key choices
    - Verify completion
29. Run end-to-end technical playtest
    - Test match creation
    - Test turn flow
    - Test disconnects
    - Test timeouts
    - Test match end
30. Freeze V1 and document
    - Verify if anything is missing
    - Block new features
    - Write technical documentation
    - Write operational documentation
    - Prepare roadmap for V2



# Version Control
- First version created with AI prompt:
    > Read "Start project" file and assume I want to create and to start developing it: give me 30 steps to follow, a simple list where the first is "start the project"; for each step give 5 subpoints.
- **Document Version**: 0.10.12
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.1.0 | first version of this document | February 3, 2026 |
	| 0.1.1 | added licence and version control sections, file renamed from "todolist" to "roadmap" | February 5, 2026 |
    | 0.1.2 | update "2. Define the V1 scope" and "3. Define the technology stack" sections | February 10, 2026 |
    | 0.6 | step 04, step 05, step 06 | February 26, 2026 |
    | 0.7 | step 07: configure website | February 27, 2026 |
    | 0.8 | step 08: configure CI | March 5, 2026 |
    | 0.9 | step 09: design core data model | March 9, 2026 |
    | 0.10.12 | step 10: create initial DB schema | March 19, 2026 |
- **Last Updated**: March 19, 2026
- **Status**: In progress



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







