# AlNao Paths Game V1 - Step 03: Scope Definition

## Project Overview
AlNaoPathsGame is a cooperative multiplayer game inspired by gamebooks, RPG rules, board games and card games. Players work together through narrative choices, managing resources, time, and character progression in a shared story.

This document defines the complete scope for Version 1 (V1) of AlNaoPathsGame organized into five critical sections:

  - ✅ **Mandatory Features**: Complete list of all features that MUST be implemented in V1. These define what the game is and how it works.

  - ✅ **Excluded Features**: Explicit list of features that will NOT be in V1. These are planned for V2 or later versions.

  - ✅ **Maximum Complexity Limit**: Clear boundaries defining scope limits, technical constraints, content limitations, and performance targets.

  - ✅ **V1 Completion Criteria**: Specific, measurable criteria that define when V1 is considered finished and ready for production.

  - ✅ **Frozen Decisions**: All decisions that are locked until V2. No changes allowed except critical bug fixes.

  - ✅ **Open questions**: Open questions and uncertainties that need resolution during development


This is a functional specification document. Technical implementation details (database tables, API endpoints, service methods) are documented separately in technical design documents.


### Version Control
- First version created with AI prompt:
    > Take the 'StartProject' file and write this new file by separating into five sections: 1 List mandatory features, 2 List excluded features, 3 Define maximum complexity limit, 4 Establish what makes V1 finished, 5 Freeze decisions until V2. I want the new file in English. Check that everything is there, meaning that all functional information from this file is carried over to the various sections. Do not add any logic and do not modify the game logic. Optionally add a questions section at the end. In this file, eliminate all technical parts but summarize the technical components in one line per component. Proceed carefully and make multiple passes if needed, but I want it to be complete.
- **Document Version**: 1.0
- **Last Updated**: February 3, 2026
- **Status**: FROZEN until V1 completion


## 1. List of Mandatory Features

### 1.1 User Authentication and Management
- User registration with username, password, and email
- Login with username/password
- Single-sign-on with Google
- JWT-based API security
- User profile with historical statistics

### 1.2 Game Session Management
- Players must register and login to play
- Match creation with story and difficulty selection
- Maximum number of concurrent active matches (configurable parameter)
- Players can join matches before they start
- First player can manually start the match or it starts automatically when full
- Maximum number of players per match depends on selected difficulty
- Players cannot change once match starts; disconnected players remain in queue
- Player abandonment handling

### 1.3 Character Creation and Management
- When joining a match, players select:
  - Character template (from available list)
  - Character class (mage, thief, ranger, elf, dwarf, sorcerer, paladin, cleric, guard, child, elder)
  - Character characteristics (legal, neutral, chaotic, good, evil, beautiful, introverted, ugly - from global list)
  - Initial stats based on story difficulty and character constraints
- Character statistics:
  - Integer values: Energy, Life, Sadness, Experience (starts at zero)
  - Stats: Dexterity (DES), Intelligence (INT), Constitution (COS) - minimum 1
  - Energy and Sadness cannot exceed Life
  - Maximum values for Energy, Life, and Sadness defined by character template
  - Class bonuses applied at match start
  - Class bonuses applied at each time start (recover specific stat)
- Backpack/Inventory:
  - Resources: Food quantity, Magic quantity, Coins quantity (minimum 0)
  - List of consumable items with weight
  - Maximum carrying capacity = Constitution + difficulty parameter + default_backpack_capacity
  - Total weight = Food + Magic + Sum(item weights). Note: coins have no weight
  - Cannot move if weight exceeds maximum capacity
- Characteristic changes only through events, not player choice

### 1.4 Time-Based Progression System
- Game progresses through discrete time units (days/hours/rounds)
- Time advances when all characters have zero energy or voluntarily sleep
- Each time has a "weather" affecting movement costs (random from valid weather list with probability weights)
- At time start:
  - Characters in safe locations gain: DES+P energy, COS+P life, lose INT+P sadness (P = location safety parameter)
  - Characters in unsafe locations gain only DES energy
  - New weather is randomly determined
  - Class bonuses applied to characters
  - Temporary effects duration reduced
  - Location timers decreased
  - Characters wake up from sleep
- Turn order calculated by formula: (DES * 3 + INT * 2 + COS * 1) * 1000 + LIFE * 10 + CHARACTER_ID
- Higher values act first; tied values use character ID as tiebreaker
- Active players act in sequence; can pass turn without spending energy
- Players have timeout for their turn; after timeout, turn passes automatically
- If all players pass with remaining energy, round repeats until all sleep
- Turn queue tracked in dedicated table with timestamps

### 1.5 Energy and Status Management
- Characters with zero energy cannot act; must sleep
- When Sadness reaches Life value: character loses COS life points, Sadness resets to zero, character sleeps immediately
- At zero or negative Life: character enters coma (considered both sleeping and comatose)
- Comatose characters can be saved by:
  - Another character in same location spending energy to give COS life points
  - Consumable items that restore life
- When all characters enter coma simultaneously: trigger group_coma event
- No permanent death in V1

### 1.6 Location and Movement System
- Characters move through connected locations (board-like structure)
- Multiple characters can be in different locations (splitting allowed)
- Location capacity limits (e.g., 4 in room, 2000 in forest)
- Each location has:
  - Name, description, image
  - Energy cost to enter (base + weather modifier)
  - Safety status (affects time-start bonuses)
  - Safety parameter value
  - List of explicit neighbors (directional: NORTH/SOUTH/EAST/WEST/UP/DOWN/SKY)
  - Maximum character capacity
  - Optional time counter (location expires after N time units)
  - Event triggered when location expires
- Movement between locations:
  - Only possible to neighbor locations
  - May require registry conditions (e.g., "DoorOpen=YES")
  - Costs energy (base + weather + extra costs)
  - Can be bi-directional or one-way
- Group movement: When one character moves, others in same location receive invitation to follow for free (no energy cost)
  - Follow action only happens within timeout window
  - Followers move instantly without energy cost
  - Only available when initiating character moves

### 1.7 Event System
- Events have:
  - Title, narrative text, description
  - Energy cost (zero for automatic events) and Coin cost (possibile zero)
  - Can modify registry (key=value pairs)
  - Can cause time to end (all characters sleep)
  - Can add/remove consumable items to character inventory
  - Can change character position to another location without movement cost
  - Can modify character stats: life, sadness, food, magic, coins (respecting limits)
  - Can add/remove character characteristics
  - Can change weather
  - Can interrupt subsequent events
  - Can have coins cost
- Events affect all characters in the location
- Event types:
  - AUTOMATIC_FIRST_ENTRY: Triggers when character enters location for first time
  - AUTOMATIC_SUBSEQUENT_ENTRY: Triggers from second entry onward
  - AUTOMATIC_FIRST_IN_LOCATION: Triggers when character enters empty location
  - TIME_START: Triggers when character starts time in this location
  - OPTIONAL: Player chooses to trigger (costs energy)
- Events execute in order; can interrupt subsequent events
- Events can be triggered multiple times

### 1.8 Choice System
- Events and locations can present choices with multiple options
- Active character selects one option from available choices
- Options executed in order; for automatic choices, first valid option wins
- Each option has activation rules:
  - Maximum sadness limit
  - Minimum DES/INT/COS requirement
  - Prohibited characteristic (e.g., "Steal" unavailable for lawful characters)
  - Required characteristic (e.g., "Seduce" only for beautiful characters)
  - Multiple conditions with AND/OR logic (all AND or all OR, no mixed logic)
- Option conditions can check:
  - All characters in specific location
  - Registry key has specific value
  - Active character has specific consumable item
  - At least one character in location has specific class
  - Sum of character stats in location exceeds threshold
  - Current location matches specific location
- Each option leads to single event as result
- "Otherwise" option available (no limits, no conditions)
- Only one option executes per choice
- If user has timeout and doesn't choose: select "otherwise" if available, else event ends
- Option effects can modify character stats (single or group, depending on effect configuration)
- If marked as "progress": insert into story progression table

### 1.9 Mission System
- Missions managed through registry and choices
- During story, characters can accept missions (e.g., "MerchantDaughter=TO_SAVE")
- Through events and choices, mission status updates (e.g., "MerchantDaughter=SAVED" or "=DEAD")
- Completing missions can provide rewards (items, resources)
- Missions tracked in dedicated tables with steps
- Mission progression based on registry values

### 1.10 Game Registry
- Each match has unique registry: annotations (key=value pairs) and objects
- Registry entries are boolean (YES/NO) or numeric
- Examples: "KingDead=YES", "FoundKnife=YES", "NumberOfKnives=3", "Chapter=4", "Day=12"
- Game phase/chapter managed through registry (e.g., "Chapter=4", "Phase=2")
- Registry used for:
  - Tracking story progression
  - Unlocking/locking location movements
  - Enabling/disabling events
  - Mission tracking
  - Game state persistence

### 1.11 Item and Inventory Management
- Two types of items:
  - Consumable items (tracked in inventory, have weight)
  - Fixed items (tracked in registry, no weight)
- Consumable items:
  - Have weight value
  - Can be found during gameplay
  - Can be used anytime during player's turn (if not sleeping/comatose)
  - Can be discarded or sent to another character in same location (if not sleeping/comatose)
  - Discarded items disappear from game
  - Can be traded between characters in same location (both must be awake and not comatose)
  - Effects applied immediately when used
- Inventory weight limit: Constitution + difficulty_parameter + default_backpack_capacity
- If weight exceeds limit: cannot move
- Items logged when used (timestamp, character, item, effects)

### 1.12 Character Trade System
- Characters in same location can trade items and resources
- Trade proposal includes: items offered, items requested, quantities
- Recipient receives notification with timeout
- Recipient can accept or reject
- Trade expires after timeout (configurable parameter)
- Both characters must be awake and not comatose
- Trade only for: Food, Magic, Coins, Consumable items

### 1.13 Experience and Character Advancement
- Experience gained through events
- When sleeping in safe location: can spend experience to increase DES, INT, or COS by 1
- Experience cost per stat increase defined by match difficulty
- Experience starts at zero and accumulates

### 1.14 Random Events
- Global random events with probability weights
- Triggered at time start based on conditions
- Conditions check registry values
- Probability determines if event activates

### 1.15 Weather System
- Each time has current weather from valid weather list
- Weather affects movement costs (different for safe/unsafe locations)
- Weather selected randomly at time start based on:
  - Probability weights
  - Registry conditions
  - Time range restrictions (from_time, to_time)
  - Priority values
- Weather can trigger events
- Weather can modify energy at time start

### 1.16 Communication Systems
- In-game chat: players can communicate during match
- System notifications: game events, turn changes, trade proposals
- Notification queue system with priority
- Message rate limiting (minimum time between messages)

### 1.17 WebSocket Real-Time Updates
- Real-time notifications for:
  - Player joined/left
  - Turn updates (whose turn, deadline, queue order)
  - Game events (weather changes, traps, etc.)
  - Time end/start
  - Trade proposals
  - Chat messages
  - System messages
  - Lock expired
  - Player disconnected/reconnected
  - State synchronization
  - Choice timeout warnings
  - Registry updates
  - Movement invitations

### 1.18 Logging and History
- Event log: all events triggered with timestamp, character, description
- Movement log: all movements with start/end locations, energy cost, weather, timestamp
- Object usage log: all item uses with effects, timestamp
- Weather log: weather changes with timestamps
- Choice execution log: all choices made with outcome and timestamp
- Complete match history for replay

### 1.19 Snapshot System
- Manual snapshot creation
- Automatic snapshot at time end (light snapshot - delta only)
- Snapshot restoration capability
- Snapshot validation
- Full and light snapshot types

### 1.20 Admin Tools
- View match states
- Force turn advancement
- Terminate stuck matches
- Restore snapshots
- Manage problematic users
- Edit registry values
- Force unlock stuck situations
- Kick users from matches
- View logs with filters (time, player, event)
- View replay of complete match history

### 1.21 Story Content Management
- Multiple stories available
- Each story has:
  - Title, description, author, version
  - Initial location
  - Available difficulty levels
  - Available character templates
  - Available classes
  - Available characteristics
  - Locations with events
  - Objects and items
  - Weather types
  - Missions
  - Global random events
  - Multi-language support (texts and cards)
- Story validation tool

### 1.22 Concurrent Action Management
- Lock system to prevent race conditions
- Only one character can act at a time
- Lock acquisition with timeout
- Lock expiration handling
- Lock history tracking
- Turn queue management
- Consecutive pass counter (game over if exceeds limit)

### 1.23 Player Session Management
- Track online/offline status
- Last seen timestamp
- Client ID tracking
- IP and device tracking
- Automatic cleanup of stale sessions
- Reconnection handling

### 1.24 Pass and Stalemate Prevention
- Players can pass turn without spending energy
- Consecutive pass counter tracked
- If all players pass with remaining energy: counter increments
- Pass counter increases timeout for next turns
- If pass counter exceeds limit: game over
- Warning when stalemate approaching

---

## 2. List of Excluded Features (NOT in V1)

The following features are planned for V2 and must NOT be implemented in V1:

### 2.1 NPC System
- Wandering NPCs
- Static NPCs (e.g., fixed merchant)
- NPC interactions

### 2.2 Advanced Inventory Management
- Hand/equipped items system
- Two-item hand limit
- Free action to swap items between hand and backpack
- Item equipping requirements

### 2.3 Permanent Death and Game Over
- Only group coma triggers event (no permanent death)
- No individual character death

### 2.4 Anti-Spam System
- Internal variable that grows with excessive actions
- Influences probability/energy costs

### 2.5 Reproducible Randomness
- Seed per match for reproducible random events
- Replay debugging features

### 2.6 Tutorial and First-Time Hints
- Tutorial overlay system
- First-time event hints
- Automatic tutorial notifications

### 2.7 Advanced Registry
- Multi-value registry keys
- Array storage in registry (e.g., "Visited locations" list)

### 2.8 Player Signal System
- Quick ping system ("Follow me", "Danger here", "Need help")
- Non-chat communication

### 2.9 Silent Events
- Events without narrative text (only effects)

### 2.10 Noise and Stealth System
- Noise counter per location
- Noise-triggered negative events
- Stealth mechanics

### 2.11 Group Rituals
- Actions requiring multiple characters in same location
- Stat sum threshold requirements
- Special group-unlocked events

### 2.12 Timed Missions
- Missions with time expiration
- Time-limited objectives

### 2.13 Voting System
- Group voting on critical choices
- Vote resolution mechanics

### 2.14 Location Fatigue
- Locations become sterile when visited too often
- Reduced useful events in overvisited locations

### 2.15 Anti-Stall Rules
- Auto-generated micro-events after N minutes of inactivity
- Automatic energy penalties for inactivity

### 2.16 User Progression System
- Rewards earned at match completion
- Cosmetics for future matches
- Initial experience bonuses
- Cross-match progression

### 2.17 Spectator Mode
- Watch ongoing matches
- Match rating/voting
- Story rating system

### 2.18 Analytics Mode
- Death location/event/choice analysis
- Player abandonment timing analysis
- Undiscovered choices tracking
- Undiscovered events tracking
- Undiscovered locations tracking

### 2.19 Free Actions System
- Limited free actions per time
- Free actions for: hand/backpack swaps, specific events, item use, trades, group movement

### 2.20 Temporary Effects System (Advanced)
- "+1 DES for next 2 actions"
- "Paralyzed until Time 5"
- Complex temporary modifiers
(Basic temporary effects table exists but not fully implemented)

---

## 3. Define Maximum Complexity Limit

### 3.1 Scope Boundaries
V1 focuses on core game loop:
- User registration and authentication
- Match creation and joining
- Character creation and basic management
- Turn-based time progression
- Simple movement between locations
- Basic event and choice system
- Simple item inventory
- Character statistics tracking
- Basic cooperative gameplay
- Real-time WebSocket updates
- Minimal admin tools

### 3.2 Technical Constraints
- Maximum 4 components (2 frontend + 2 backend)
- Single database technology (PostgreSQL or SQLite)
- No microservices architecture
- No external service integrations (except Google SSO)
- Standard REST API + WebSocket (no GraphQL)
- No mobile apps in V1
- No advanced caching systems
- No complex AI/ML features

### 3.3 Content Limitations
- Minimum 1 complete playable story for testing
- Maximum story complexity:
  - Up to 50 locations
  - Up to 100 events
  - Up to 200 choices
  - Up to 20 item types
  - Up to 10 character classes
  - Up to 15 characteristics
  - Up to 10 weather types
- Single language support initially (multi-language structure prepared but not required)

### 3.4 Performance Targets
- Support up to 100 concurrent matches
- Maximum 10 players per match
- Maximum 5-second response time for API calls
- Maximum 1-second WebSocket message delivery
- Simple in-memory caching acceptable
- No advanced optimization required in V1

### 3.5 Feature Depth Limits
- No complex combat system
- No skill trees
- No character relationships/reputation
- No crafting system
- No complex economic system
- No procedural generation
- No advanced AI opponents
- Maximum 3 levels of event chaining
- Maximum 5 conditions per choice option

### 3.6 Testing Requirements
- 1 complete end-to-end story playthrough
- Basic unit tests for core services
- Manual testing acceptable for UI
- No automated UI testing required
- Basic load testing (10 concurrent matches)

---

## 4. Establish What Makes V1 Finished

V1 is considered complete when ALL following criteria are met:

### 4.1 Core Functionality Complete
- ✓ User registration, login, Google SSO working
- ✓ Match creation with story and difficulty selection
- ✓ Player can join existing matches
- ✓ Character creation with template, class, characteristics selection
- ✓ Turn-based progression system functional
- ✓ Time advancement when all players sleep/zero energy
- ✓ Movement between locations with energy costs
- ✓ Event triggering (automatic and optional)
- ✓ Choice system with condition validation
- ✓ Item inventory management (add, remove, use, trade)
- ✓ Character stats tracking (energy, life, sadness, DES, INT, COS)
- ✓ Weather system affecting movement
- ✓ Registry system tracking game state
- ✓ Mission tracking system
- ✓ Chat and communication working
- ✓ WebSocket real-time updates functional

### 4.2 Technical Completeness
- ✓ All mandatory REST APIs implemented and documented
- ✓ WebSocket topics operational
- ✓ Database schema finalized and versioned
- ✓ Authentication and authorization working
- ✓ Lock system preventing race conditions
- ✓ Snapshot creation and restoration working
- ✓ Logging system capturing all events
- ✓ Admin tools functional (view matches, force actions, restore snapshots)

### 4.3 Testing Complete
- ✓ At least 1 complete story playable from start to finish
- ✓ Core services have unit tests
- ✓ End-to-end manual playtest successful
- ✓ Multi-player testing with 4+ players successful
- ✓ Disconnect/reconnect handling tested
- ✓ Timeout mechanisms tested
- ✓ Trade system tested
- ✓ Group movement tested
- ✓ Coma and revival tested

### 4.4 User Experience Requirements
- ✓ Frontend displays all essential game information:
  - Character stats
  - Current location and available movements
  - Available events and choices
  - Inventory and items
  - Turn order and active player
  - Weather and time
  - Registry state (visible to players)
  - Mission progress
  - Other players in location
- ✓ Clear visual feedback for all actions
- ✓ Error messages are clear and actionable
- ✓ Chat functional and visible
- ✓ Notifications working properly
- ✓ Timeout warnings visible to players
- ✓ Loading states clear

### 4.5 Documentation Complete
- ✓ API documentation (all endpoints documented)
- ✓ WebSocket message format documented
- ✓ Database schema documented
- ✓ Game rules documented
- ✓ Admin tools usage guide
- ✓ Story creation guide (for content creators)
- ✓ Installation and deployment instructions

### 4.6 Stability Criteria
- ✓ No critical bugs
- ✓ No data corruption issues
- ✓ Matches can complete without server intervention
- ✓ System recovers from disconnections
- ✓ Locks expire and release properly
- ✓ No infinite loops in game logic
- ✓ Stalemate prevention working

### 4.7 Acceptance Criteria
- ✓ 3+ people can play a complete story together
- ✓ Match lasts at least 30 minutes without crashes
- ✓ All character classes playable
- ✓ All core game mechanics demonstrated in test story
- ✓ Story completion triggers properly
- ✓ Game over conditions work correctly
- ✓ Admin can intervene in stuck matches

### 4.8 Deployment Ready
- ✓ Application deployable to production environment
- ✓ Environment configuration separated (dev/test/prod)
- ✓ Database migration strategy defined
- ✓ Backup and restore procedures documented
- ✓ Basic monitoring in place
- ✓ CI pipeline running (build + test)

---

## 5. Freeze Decisions Until V2

The following decisions are FROZEN for V1. No changes, additions, or "improvements" allowed until V2:

### 5.1 Frozen Game Mechanics
- Turn order formula: (DES*3 + INT*2 + COS*1) * 1000 + LIFE*10 + ID
- Maximum carrying capacity formula: Constitution + difficulty_parameter + default_backpack_capacity
- Stat recovery formula: DES+P energy, COS+P life, -INT-P sadness (P = safety parameter)
- Energy/Sadness/Life cannot exceed maximums
- Coma triggers at zero life
- Sleep triggers at zero energy
- Sadness=Life triggers: lose COS life, sadness resets to zero, immediate sleep
- Group movement: free for followers
- No NPC interactions
- No permanent death
- No complex combat
- No skill trees
- No crafting

### 5.2 Frozen Technical Decisions
- Backend: Java Spring Boot (last version disponibile) and/or Python with Flask
- Frontend: React with Bootstrap5 and FontAwesome and/or Python with Flask
- Database: PostgreSQL or SQLite (choose one and stick with it)
- JWT authentication between Backend and Frontend
- REST API + WebSocket architecture
- No external APIs (except Google SSO)
- Standard Spring Boot project structure and standard React component structure

### 5.3 Frozen Data Model
- Database tables as defined (33 tables)
- Registry as key-value pairs (string and numeric)
- Match states: CREATA, IN_CORSO, PAUSA, TERMINATA, TERMINATA_GAMEOVER
- Character states: ATTIVO, ADDORMENTATO, COMA
- Event types: AUTOMATICO_ENTRATA_1, AUTOMATICO_ENTRATA_2, INIZIO_tempo, FACOLTATIVO, PRIMO_GIOCATORE
- No schema changes except bug fixes

### 5.4 Frozen UI Approach
- Card-based visual design (inspired by collectible card games)
- Locations displayed as cards on grid
- Characters as cards
- Missions as cards
- Registry as card collection
- Chat as post-it notes
- Timeout displayed as hourglass
- No mobile app
- No native desktop app
- Web-only interface

### 5.5 Frozen Feature Set
- Exactly the features in Section 1 (Mandatory Features)
- Nothing from Section 2 (Excluded Features)
- No feature creep
- No "small additions"
- No "quick improvements"
- Bug fixes only

### 5.6 Frozen Scope
- Single complete story for testing
- Multi-language structure prepared but not required
- No analytics dashboard
- No user profiles beyond basic stats
- No social features
- No achievements
- No leaderboards

### 5.7 When V2 Can Start
V2 planning begins ONLY when:
- All Section 4 criteria met
- At least 10 complete playthroughs by different players
- Feedback collected and documented
- V1 stable in production for at least 2 weeks
- Team explicitly agrees V1 is complete

### 5.8 Change Request Process
If critical issue requires frozen decision change:
1. Document why change is absolutely necessary
2. Explain why it cannot wait for V2
3. Get explicit approval from all team members
4. Update this document with reasoning
5. Log decision in project history

---

## 6. Questions and Uncertainties

### 6.1 Technical Questions
- **Database choice**: PostgreSQL vs SQLite - which is definitive for V1?
  - Recommendation: PostgreSQL for production, SQLite for local development
- **Snapshot storage**: Database JSONB field vs MongoDB vs File system?
  - Recommendation: Database JSONB field for simplicity in V1
- **Lock mechanism**: Database-based vs Redis?
  - Recommendation: Database-based for V1 simplicity (Redis in V2 if needed)
- **WebSocket library**: Which specific library for Java Spring Boot?
  - Recommendation: Spring WebSocket with STOMP protocol

### 6.2 Game Balance Questions
- **Starting resources**: What are default values for Food, Magic, Coins at character creation?
  - To be defined in test story balancing
- **Energy costs**: What are typical energy costs for events and movements?
  - To be defined in test story balancing
- **Experience costs**: How much experience needed to increase stats?
  - To be defined per difficulty level
- **Turn timeout**: What is optimal timeout value?
  - Start with 60 seconds, adjust based on playtesting

### 6.3 User Experience Questions
- **Disconnection grace period**: How long should we wait for player reconnection before auto-pass?
  - Recommendation: 5 minutes before auto-pass
- **Trade timeout**: How long should trade proposals remain valid?
  - Recommendation: 60 seconds
- **Movement follow timeout**: How long to accept group movement invitation?
  - Recommendation: 30 seconds
- **Choice timeout**: How long to make a choice?
  - Recommendation: 60 seconds with visual countdown

### 6.4 Content Questions
- **Test story scope**: How long should the test story take to complete?
  - Recommendation: 30-60 minutes for first playthrough
- **Story validation**: What constitutes a "valid" story?
  - Must have: start location, at least one ending, completable path, no dead ends (or dead ends are intentional)
- **Multi-language**: Which languages to support in V1?
  - Recommendation: English only for V1, structure ready for Italian in V2

### 6.5 Deployment Questions
- **Hosting**: Self-hosted vs cloud platform?
  - To be decided based on team infrastructure
- **Scaling strategy**: How to handle growth beyond 100 concurrent matches?
  - Out of scope for V1; revisit in V2
- **Backup frequency**: How often to backup production database?
  - Recommendation: Daily full backup, hourly incremental

### 6.6 Admin Tools Questions
- **Admin authentication**: Separate admin login or user role-based?
  - Recommendation: User role-based (ADMIN role)
- **Admin capabilities**: Can admins play in matches or only observe?
  - Recommendation: Admins can play with regular accounts
- **Intervention logging**: How detailed should admin action logs be?
  - Recommendation: Log all admin actions with timestamp, admin ID, action type, affected match/user

