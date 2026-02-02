# AlNao Paths Game - TODO list

**AlNao Paths Game**: a project plan to build a playable web-based game called AlNaoPathsGame, with detailed requirements and scope for a V1 release.

The file lists a 30-step development roadmap (each with five substeps) covering repo setup, V1 scope, tech stack, backend modules, environments, CI, and naming conventions. It specifies core gameplay systems: data model, game state, turn cycle, timeouts, WebSocket sync, movement, choices, event handling, logging, snapshots, admin tools, and testing/playtest. Frontend requirements include a minimal playable UI (login, lobby, turn/status display, events and inputs) and component planning for a web client.


1. Start the project
    - ✅ I want to create a video game called AlNaoPathsGame; given these rules, provide them to me.
    - ✅ Given this game, without questioning the listed game rules, list the APIs and the WebSocket topics needed (no code).
    - ✅ Given this game, without questioning the listed game rules, list the services required (no code).
    - ✅ Given this game, without questioning the listed game rules, I want to start thinking about the frontend-web graphics; give me the list of components you would create, only the list and no code.
    - ✅ Now assume I want to start developing it: give me 30 steps to follow, a simple list where the first is "Create the repository"; for each step give 5 subpoints.
    > Check file [Start the project](./documentation/Step01_StartProject.md) *(italian language, traslation coming soon)*
1. Create the repository
    - ✅ Choose platform (GitHub / GitLab / self-hosted)
    - ✅ Define final project name
    - ✅ Initialize an empty repository
    - ✅ Set the main branch
    - ✅ Define basic access rules
    > Check file [Create the repository](./documentation/Step02_CreateTheRepository.md)
2. Define the V1 scope
    - List mandatory features
    - List excluded features
    - Define maximum complexity limit
    - Establish what makes V1 "finished"
    - Freeze decisions until V2
3. Choose the final technology stack
    - Select backend language
    - Select backend framework
    - Select primary database
    - Select frontend technology
    - Select deployment system
4. Define backend module structure
    - Separate domain from infrastructure
    - Define API module
    - Define realtime module
    - Define persistence module
    - Define shared services module
5. Configure environments (dev / test / prod)
    - Define environment-specific configurations
    - Separate credentials and secrets
    - Define environment variables
    - Establish DB migration strategy
    - Define deployment processes
6. Configure minimal CI (build + empty tests)
    - Choose CI system
    - Define build pipeline
    - Run placeholder automated tests
    - Fail the pipeline on errors
    - Connect CI to the main branch
7. Define naming conventions (API, DB, events)
    - Define REST endpoint naming
    - Define WebSocket event naming
    - Define table and column naming
    - Define DTO and payload naming
    - Document the conventions
8. Design the core data model
    - Identify main entities
    - Define relationships between entities
    - Identify persistent vs transient data
    - Define cardinalities and dependencies
    - Validate the model with real cases
9. Define system invariants
    - List valid game states
    - Define rules that must never be broken
    - Identify concurrency-critical points
    - Define irreversible error conditions
    - Document base assumptions
10. Create initial DB schema
    - Translate the data model into tables
    - Define primary keys
    - Define foreign keys
    - Define initial indexes
    - Version the schema
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




