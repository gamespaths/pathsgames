# Paths Games V1 - Step 01: Start the project

This document defines the **start project steps** to build a **Paths Games**, a playable web-based game, with detailed requirements and scope for a V1 release.


**Important note**: this file describe the **initial concepts**: rules and tecnical components should be evolved in next steps, read all MD file to all details.


**NEVER change/update this file during developer steps**


## Main concept

1. **Project Overview: PathsGames**
	- Hi! I want to create a game titled "PathsGames".
	- Note: If you have any doubts or questions, the answer is always 42.
2. **Repository & Architecture**
	- The repository is organized into the following sections: frontend, backend, website, admin, documentation, scripts, etc.
	- Backend: Java Spring Boot 3.5.x using the main package games.paths.xxx.
	- Database: PostgreSQL (production) / SQLite (development/local).
	- Communication: REST APIs secured with JWT.
	- Frontend: Web-browser based with full mobile compatibility.
	- Authentication: User registration and login required. All API calls between frontend and backend use JWT tokens. Supports SSO via Google and Steam.
		- Anonymous session: When a user visits without logging in, the backend generates a unique guest token (UUID) stored in an HttpOnly cookie
		- Temporary identity: The guest gets a row in users (or a separate users_guest table) with state=6 (GUEST) and no email/password
		- Cookie-based session: All API calls authenticate via JWT generated 
		- Optional upgrade: Guest can later register a full account, linking their match history
		- Google SSO: Google SSO one-click login (you already planned google_id_sso). Auto-generate nickname from Google profile
3. **Game Mechanics & Roles**: The game functions like a hybrid of a gamebook, a board game, and a card game.
	- Match Creation: A player can create a match by selecting a story and a difficulty level from the available list.
	- Character Setup: Players join a match before it starts by selecting a character, class, and traits from a story-specific list.
	- Classes: Examples include Wizard, Elf, Guard, Child, or Old Man. Each class has unique starting stats.
	- Class Bonuses: At the start of every "Time Unit," characters recover or gain values defined in a specific bonus table.
	- Match Start: Only the first player (the creator) can manually start the match. The number of concurrent matches is limited by the Match_Running_In_Same_Moment parameter. A match starts automatically if the number of players reaches the max_players limit defined by the story/difficulty.
	- Persistence: The player list can never change once the match begins. If a player disconnects, the others can continue their turns. The disconnected player can rejoin the match at any time.
	- Gameplay & Narrative
		- Structure: Matches follow gamebook logic involving a time clock (days, hours, etc.), events, choices, locations, and movement.
		- State Registry ("Annotations"): A key-value system used to track progress.
		- Values: Boolean (YES/NO) or Numeric.
		- Example: KingIsDead=YES, Sword=YES, GuardsKilled=4, Chapter=2, Day=42. 
		- Chapter Management: Progression through chapters is handled via the Registry.
	- Characters track four main attributes: Energy, Life, Sadness, and Experience.
		- Rules: Energy and Sadness values cannot exceed the current Life value.
		- Initialization: Starting values are determined by the chosen class. All values must be >= 0
		- Resources: Characters carry quantities of Food, Magic, and Coins (>=0).
		- Consumables: Items found during the story are stored in the inventory. They can be used during a character's turn, provided the character is not sleeping or in a coma.
		- Trading: Characters in the same location (who are not sleeping or in a coma) can trade items, food, and coins. Magic cannot be traded.
		- Weight & Capacity: Every consumable item has a weight.
		- Max Capacity Calculation: $Constitution + Difficulty Parameter + Default Inventory Capacity.
		- Current Load: The sum of Food + Magic + Coins + Total Item Weight. This must not exceed the Max Capacity.
		- Quest Items / Static Objects: These are non-consumable and managed via the State Registry; they do not count towards inventory weight.
		- Encumbrance: If a character's weight exceeds their capacity, they are immobilized and cannot move.
		- Every character has characteristics dexterity, intelligence, constitution. Starting value is from character class. Value is always >=0.
			- A user selects the character "Alberto, Programmer class" with the following initial stats: Max Life = 10, DEX = 4, INT = 4, COS = 2, Max Energy = 6, Max Sadness = 4, Max Weight = 10.
			- When a character sleeps in a Safe Location, they may spend an Experience Cost (experience_cost) to increase one of their core stats (DES, INT, or COS) by 1 point. The experience_cost is a match-wide parameter defined by the story's difficulty setting.
			- At the start of a match, each character selects from a list of Alignments/Traits (e.g., Lawful, Neutral, Chaotic, Good, Evil, Beautiful, Introverted, Ugly). The available options are defined in global_runtime_variables. These traits can only change during gameplay through specific events; they cannot be manually changed by the player after the initial selection.
	- Progression is based on Time Units (integers starting from 1). 
		- Characters move across a board of Locations (Location 1, Location 2, etc.). Players can split up and visit different locations simultaneously. Each location has a Maximum Capacity (e.g., a room may hold max 4 characters, while a forest can hold up to 2000).
	- A Time Unit ends only when all characters reach zero energy or choose to sleep voluntarily. 
	- Each Time Unit has an associated Weather type, which determines the Movement Cost Modifier.
		- Weather rules are stored in list_weather_rules table. At the start of each new Time Unit, a new weather condition is randomly selected based on specific probability rules.
		- Practical Example
			- Day 1: All characters are at "Location 1: City" and the weather is "Clear". They all choose to sleep.
			- Day 2: A new Time Unit begins; the weather changes to "Rain," and movement costs are updated accordingly.
	- Energy & Exhaustion: A character can perform multiple actions and movements as long as they have energy > 0. If energy reaches 0 or less, they can no longer act and are forced into the SLEEPING state.
		- Sadness (Sad) Threshold: When a character's sad value reaches their current life value, the character loses life points equal to their COS stat. Following this, sad is reset to 0, and the character enters the SLEEPING state immediately.
		- Coma State: If a character's life drops to 0 or less, they enter a COMA. Characters in coma are simultaneously considered SLEEPING.
		- Recovery at Time Start: At the beginning of each Time, characters recover stats based on their current location's Safety Parameter:	
			- In a Safe Location: Gain DES + P energy, COS + P life, and lose INT + P sadness.
			- In an Unsafe Location: Gain only DES energy (no life recovery or sadness reduction).
	- Turn Management & Concurrency (The Turn Loop): The game uses a dynamic turn system managed via WebSockets to ensure real-time updates:
		- Turn sequence: Calculated at the start of every Time Unit using a specific formula. The character with the highest value acts first. In case of a tie, the id_character_match acts as a tie-breaker.
		- Action Flow: Active characters act in sequence. A player can perform multiple actions during their turn as long as they have energy.
		- Players may Pass their turn without spending energy. If all active players pass but still have energy, the loop restarts from the first non-sleeping character.
		- Timeouts & Automation: Each turn has a fixed duration (seconds). If the timer expires (even if the user is offline), the system automatically triggers a Pass action and moves to the next character in the gaming_turn_queue.
		- Infinite Loop Prevention: To prevent deadlocks, each "Pass" increments a counter in the gaming_turn_queue. The available time for subsequent turns may scale based on this counter.
		- Time Unit Completion: A Time Unit ends only when all characters are in the SLEEPING (or COMA) state.
	- Events & Interactions
		- Automatic Time-Start Events: Every new Time Unit triggers a global or location-specific event (e.g., "Characters wake up in the forest as it begins to rain and a deer approaches").
		- Rescue Mechanics: A character in COMA cannot wake up alone. They must be saved by another character in the same location who:
			- Spends 1 energy to grant the comatose character life points equal to the rescuer's COS stat.
			- OR uses a consumable item that restores life.
	- Location Attributes & Rules: Every location in the game is defined by a unique ID, name, description, and visual asset, but its core logic depends on the following attributes:
		- Movement Costs:
			Base Energy Cost: A fixed cost specific to each location.
			Weather Cost: Added dynamically based on the current weather rules.
			Total Cost: Base Location Cost + Current Weather Cost.
		- Automatic Event Triggers (Zero Energy):
			- AUTOMATIC_FIRST_ENTRY: Triggers when a character enters the location for the very first time.
			- AUTOMATIC_SUBSEQUENT_ENTRY: Triggers on every entry from the second time onward.
			- AUTOMATIC_FIRST_IN_LOCATION: Triggers only if the character enters and find the location empty (no other characters present).
			- TIME_START_IN_LOCATION: Triggers automatically at the beginning of a new Time Unit if the character is already there.
			- Optional Interactions: A list of events or encounters that the player can choose to trigger, potentially requiring a specific energy or resource cost.
		- Time-Limited Locations: Some locations feature a initial_time_counter. The counter decrements each Time Unit.
			- When the counter reaches zero, the location becomes "inactive" or "destroyed," only triggering a specific event_if_counter_zero (e.g., a burning building that eventually collapses).
		- Adjacency & Navigation Logic: The game board is a directed graph where movement is explicitly defined:
			- Explicit Neighbors: A character can only move from Location A to Location B if B is listed as a neighbor of A.
			- Registry-Based Pathfinding: Movement between neighbors can be blocked by Registry Conditions.
			- Example: A character is in the "Hallway" which has two doors. The move to "Bedroom" is only enabled if the Registry key BedroomDoorOpen is set to YES. Otherwise, the path is locked.
			- Capacity Limits: Each location has a max_characters constraint (e.g., Room = 4, Forest = 2000).
		- Group Movement (The "Follow" Action)
			- This is a unique mechanic designed to keep the group together and optimize energy:
			- Free Movement: If multiple players are in the same location and one player (the "Leader") moves to an adjacent location, the others can perform a Follow action. Energy Cost: The "Follow" action costs 0 Energy for the followers.
			- Concurrency (Out-of-Turn): Following is the only action allowed when it is not your turn. While the active player is handling their turn, others can accept a movement invitation.
		- Logic Separation: Events and Choices triggered by the movement apply only to the character who initiated the move (the active player), unless specified otherwise by the event scope.
	- Every event has an Energy Cost that a character must spend to trigger it. Automatic events always have a cost of zero. If a character cannot afford the cost or chooses not to spend it, the event ends immediately. An event can perform one or more of the following actions:
		- Requirement: The event requires a specific amount of wealth to execute. If the character lacks sufficient funds, the event cannot be triggered. Wealth is deducted only when the event occurs.
		- Global Variable/registry Update: The event can modify the State Registry (e.g., the "Pick a lock" event sets doorOpen=YES; the "Steal from wallet" event sets Money = Money + 10).
		- Forced Time-End: The event can trigger the end of the current Time Unit, causing all characters to fall asleep (e.g., characters eat poisoned food, feel ill, and pass out).
		- Inventory Management: The event can add or remove a consumable item, provided there is enough capacity in the character's inventory (e.g., opening a drawer reveals a knife, which is added to the character’s inventory).	
		- Narrative Content: Every event includes a description/text to be read (e.g., "You enter the room and notice a locked wardrobe"; "Walking down the road, you find an abandoned cart").
		- Choice Chaining: An event can lead to a Choice after its primary effects are resolved; otherwise, the event ends. (e.g., "You find a drawer. Choice": Open it OR Leave it").
		- Weather Override: An event can change the current weather via the meteo_causato (Caused Weather) field (e.g., a character casts a spell that triggers rain).
		- Forced Relocation: The event can change the characters' position by moving them to another location without paying movement costs (e.g., the floor collapses, and characters find themselves in the basement).
		- Stat Modification: The event can modify life, sad, food, magic, and wealth (positive or negative). Values are clamped to ensure they do not drop below zero or exceed maximum limits (life_max, sad_max, or inventory weight).
		- Trait Management: The event can add or remove character traits (removing them if present, adding them if compatible with the character's class).
		- Target Scope: By default, when an event occurs, it affects all characters currently in that location (e.g., a trap causes damage to everyone in the room).
		- Repeatability: Events are not necessarily unique; they can be triggered multiple times during a match (e.g., a trap can be tripped repeatedly).
	- "Choice" (Decision Logic) If a Location or an Event specifies it, multiple options may be presented to the active character.
		- The active character selects one option from the available list. Each option has an Execution sequence. 
		- For automatic choices, the system evaluates them sequentially: the first one whose conditions are met "wins" and is executed.
		- Each choice results in exactly one outcome, leading to a single follow-up Event.
		- Making a choice does not consume energy (though the Event that triggered the choice might have).
		- Activation Conditions (Requirements): An option is only available if all configured conditions are met. These include:
			- Sadness Limit: Maximum sad threshold; if exceeded, the option is locked.
			- Stat Requirements: Minimum DES, INT, or COS values required.
			- Trait Restrictions:
				- Forbidden Trait: The option is unavailable if the character possesses this trait (e.g., "Steal" is disabled for "Lawful" characters).
				- Mandatory Trait: The option is only available if the character possesses this trait (e.g., "Seduce" is only for "Beautiful" characters).
				- Logical Operators (AND/OR): Multiple conditions (e.g., Item X AND/OR Location Y) are governed by a logic_operator. For a single choice, conditions are either all AND or all OR (no mixed logic within a single choice).
		- Choice Effects & Redirection:
			- When an option is selected, the system evaluates where to redirect the flow (id_event_result) based on:
			- Location Check: If all characters are in a specific location.
			- Registry Check: If a registry key matches a specific value.
			- Inventory Check: If the triggering character possesses a specific consumable item.
			- Class Check: If at least one character of a specific class is present in the current location.
			- Stat Sum Check: If the sum of a specific stat across all characters in the location exceeds a value (e.g., "The Mage is too weak to open this door alone; the Warrior's strength is needed").
			- The "Otherwise" (Fallback) Option: A choice can include one "Otherwise" (otherwise_flag) option. This option has no limits or conditions and serves as a catch-all. Each choice set can have only one "Otherwise" option.
		- User Interface & Timeouts: The client must display only the available choices to the user. A timeout is applied to the decision.
			- If the timeout expires: The system automatically selects the "Otherwise" option if present.
			- If no "Otherwise" option exists, the choice is cancelled and the event chain ends.
	- "Missions" (Quest Management): Missions are handled dynamically through the State Registry and Choice systems.
		- During the story, characters can accept missions. This action updates the State Registry (e.g., accepting a quest to rescue a merchant's daughter sets the registry key merchant_daughter to TO_RESCUE).
		- Through subsequent Events and Choices, the registry value can be updated based on player actions (e.g., merchant_daughter becomes RESCUED or DECEASED).
		- Returning to the quest-giver (the merchant) triggers a conditional Event: if the registry status is RESCUED, the characters receive a reward, such as a consumable item.
		- Mission Definition (list_missions): Defines the global quest, its associated registry key, and the success/failure condition values.
		- Mission Steps (list_missions_steps): An ordered sequence of milestones linked to registry values. Each step includes a description and an optional image to track narrative progression.
4. **Out of Scope** (Future Enhancements) The following features are planned for future versions and must not be taken into consideration for the current implementation:
	- NPCs & Entities: Implementation of wandering or static NPCs (e.g., a permanent Merchant in a Location or a mobile Character NPC).
	- Permadeath & Game Over: Advanced Game Over logic. Currently, only the "Group Coma" triggers a specific end-game event.
	- Anti-Spam Logic (Fatigue): An internal variable that tracks high action density per Time Unit to penalize probability or energy (hidden from the player).
	- Match Seeding: Use of a fixed seed per match to ensure reproducible random events (for debugging, replays, and fairness).
	- Tutorial & Hints: A "Tutorial Overlay" system. The first time a specific event type occurs (e.g., Coma, Trade), an automatic tutorial notification is sent to the players.
	- Multi-Value Registry: Support for registry keys storing arrays/lists (e.g., "Visited Locations") for advanced narrative tracking.
	- Ping System: A rapid signal system ("Follow me", "Danger", "Help needed") for quick player communication without text chat.
	- Silent Events: Events that trigger effects without displaying narrative text.
	- Noise & Stealth: A noise counter per location that increases with loud actions, potentially unlocking negative events (e.g., alerting guards).
	- Group Rituals: Actions requiring multiple characters in the same location to meet a combined stat threshold to unlock special events.
	- Timed Missions: Quests that expire after a specific number of Time Units (beyond simple registry tracking).
	- Voting System: A consensus mechanic for critical events where players in the same location vote on a choice.
	- Location Depletion (Sterility): Locations visited too frequently become "sterile," offering fewer useful events and more "empty" events.
	- Anti-Stall Mechanic: If no actions occur for $N$ minutes, the server generates a micro-event (e.g., "You grow bored... lose 1 energy").
	- Infinite Loop Prevention: Logic to prevent situations where all characters continuously "Pass" despite having energy.
	- Stalemate Warning: If everyone passes except the last player, a notification triggers: "If you pass as well, everyone will lose energy!".
	- Character Equipment: Advanced equipment slots. Currently, all items are considered equipped and usable without restrictions (e.g. only two hands means only two items).
		- Inventory Hands & Free Actions: * A "Hands" system for managing active items and a "Free Action" to swap them.
		- Free Actions: A set number of actions per Time Unit (defined by max_free_actions_per_time) that do not consume energy (e.g., swapping items, trading, group movement).
	- Meta-Progression: Permanent rewards for players after a match (cosmetics, starting XP, account progress).
	- Spectator & Analytics: Spectator mode, story diary export, match ratings, and an "Analyst Mode" to track where players die or which events are never triggered.
	- Status Effects: Temporary modifiers (e.g., "+1 DES for the next 2 actions" or "Paralyzed until Time Unit 5"). The gaming_active_effects table is provided but will be fully utilized in the future.
5. **Additional Notes & Required Parameters**
	These parameters are stored in the `global_runtime_variables` table and control the core logic and timing of the game engine.
	| Parameter | Type | Description |
	| --- | --- | --- |
	| **MatchTurnSequenceFormula** | `Formula` | $$(DES \times 3 + INT \times 2 + COS \times 1) \times 1000 + LIFE \times 10 + ID$$ |
	| **MaxActiveMatches** | `Integer` | Maximum number of matches allowed to run simultaneously on the server. |
	| **SystemStatus** | `Enum` | `OK` or `KO`. Used to block the creation/start of new matches during maintenance. |
	| **TimeoutPlayerPass** | `Seconds` | Base time allowed for a player's turn (e.g., 60s). |
	| **TimeoutPlayerPassPerVolta** | `Seconds` | Additional time added to the timeout for each consecutive "Pass" in the same cycle. |
	| **TimeoutTradesExpire** | `Seconds` | Time before a trade proposal automatically expires. |
	| **TimeoutMovementFollow** | `Seconds` | Time window for players to accept a "Group Movement" invitation. |
	| **TimeoutChoice** | `Seconds` | Time allowed for a player to pick an option during a Choice event. |
	| **TimeBetweenMessages** | `Seconds` | Minimum delay between chat messages to prevent spam. |
	| **TimeoutLockAcquisition** | `Seconds` | |
	| **GracePeriodReconnection** | `Seconds` | |
	| **MaxActionsPerTurn** | `Integer` | |
	| **MinEnergyForAction** | `Integer` | Default value |
	| **DefaultInventoryCapacity** | `Integer` | Default value |
	| **ExpToStatMultiplier**: | `Integer` | Fator|
	| **WebSocketHeartbeatInterval** | `Seconds` | Ping/Pong |
6. Tables  (all table must have timestamp column `ts_insert` and `ts_update` )
	- I wanna add uuid column in all tables, the value will be a generated with a randon value when a row is added in a table, the uuid value will be used in API method (to avoid to use ID value in public http api)
	- `global_game_version`  (id, version=v0.9.0, description)
	1. `global_runtime_variables` (id, type, key, string_value, int_value, description, min_value, max_value, min_version, max_version )
	2. `users` (id, username, password_hash, email_address, google_id_sso, rule (ADMIN/PLAYER), ts_registration, ts_last_access, nickname, state (1=registration, 2=active, 3=blocked, 4=banned, 5=password, 6=guess), language, guest_cookie_token, guest_expires_at, theme_selected
	3. `users_tokens` (id, id_user, refresh_token, expires_at, revoked)
	4. `list_stories` (id, id_card, id_text_title, id_text_description, author, version_min, version_max, id_location_start, id_image. id_location_all_player_coma, id_event_all_player_coma, clock_singular_description (hour), clock_plural_description (hours), id_event_end_game, id_text_copyright, link_copyright, id_creator , category, group, visibility, priority, peghi)
	5. `list_stories_difficulty` (id, id_card, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics , number_max_free_action)
	6. `list_keys` (id, id_card, id_story, name, value, id_text_description, group, priority, visibility)
	7. `list_classes` (id, id_card, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base)
	8. `list_classes_bonus` (id, id_card, id_story, id_class, statistic, value, id_text_name, id_text_description)
	9. `list_traits` (id, id_card, id_story, id_class_permitted, id_class_prohibited, id_text_name, id_text_description, cost_positive, cost_negative)
	10. `list_character_templates` (id_tipo, id_card, id_story, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start ), 
	11. `list_locations` (id, id_card, id_story, id_text_name, id_text_description, id_text_narrative, id_image, is_safe,  (boolean), cost_energy_enter, counter_time, id_event_if_counter_zero, secure_param, id_event_if_character_start_time, id_event_if_character_enter_first_time, id_event_if_first_time, id_event_not_first_time, priority_automatic_event, id_audio, max_characters)
	12. `list_locations_neighbors` (id, id_story, id_location_from, id_location_to, direction=NORTH/SOUTH/EAST/WEST/ABOVE/BELOW/SKY , flag_back (boolean), condition_registry_key, condition_registry_value, energy_cost, id_text_go, id_text_back
	13. `list_items` (id, id_card, id_story, id_text_name, id_text_description, weight, is_consumabile, id_class_permitted, id_class_prohibited)
	14. `list_items_effects` (id, id_story, id_item, id_text_name, id_text_description, effect_code=LIFE, effect_value=2)
	15. `list_weather_rules` (id, id_card, id_story, id_text_name, id_text_description, probability, cost_move_safe_location, cost_move_not_safe_location, condition_key, condition_key_value, time_from, time_to, id_text, active, priority, delta_energy, id_event)
	16. `list_events` (id, id_card, id_story, id_specific_location, id_text_name, id_text_description, type=AUTOMATIC/FIRST/NORMAL, cost_enery, flag_end_time, characteristic_to_add, characteristic_to_remove, key_to_add, key_value_to_add, id_item_to_add, id_weather, id_event_next, coin_cost )
	17. `list_events_effects` (id, id_card, id_story, id_event, statistics (live, energy, exp,...), value, target (ALL,ONLY_ONE), traits_to_add, traits_to_remove, target_class, id_item_target, item_action (REMOVE, ADD)) [example: enter in a room with a trap -> -1 life, meet gandalf -> add  10 enerty, magic trap -> only wizards, arrested -> itemX removed]
	18. `list_choices` (id, id_card, id_story, id_event, id_location, priority, id_text_name, id_text_description, id_text_narrative, id_event_torun, limit_sad, limit_dex, limit_int, limit_cos, otherwise_flag (boolean), is_progress (true -> insert progress ) logic_operator (AND/OR))
	19. `list_choices_conditions` (id, id_story, id_choices, type (KEYS, ITEM, CLASS, LOCATION, ALL_IN_SAME_LOC, traits, statistics, statistics_SUM, ), key, value, operator (= > < !=), id_text_name, id_text_description
	20. `list_choices_effects` (id, id_story, id_choices, id_scelta, flag_group, statistics (life, energy, sad, DEX, COS, INT), value, id_text, key, value_to_add, value_to_remove)
	21. `list_global_random_events` (id, id_card, id_story, condition_key, condition_value, probability, id_text, id_event)
	22. `list_missions` (id, id_card, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description, id_event_completed) 
	23. `list_missions_steps` (id, id_card, id_story, id_mission, step, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description, id_event_completed)
	24. `list_cards`  (id, id_story, id_card, url_immage, id_text_title, id_text_description, id_text_copyright, link_copyright, id_creator, alternative_image, awesome-icon, style_main, style_detail )
	25. `list_texts` (id, id_story, id_text, lang, short_text, long_text, id_text_copyright, link_copyright, id_creator)
	26. `list_creator` (id, id_story, id_text, link, url, url_image , url_emote, url_instagram)
	27. `gaming_match` (id, id_story, name, id_difficulty, exp_cost, status (CREATED, RUNNING, PAUSED, ENDED, GAMEOVER), current_clock, id_current_weather, id_user_creator, timestamp_start, timestamp_lock_expiration, timestamp_gameover, timestamp_end,  id_character_current_turn,secure_location_param, counter_consecutive_pass)
	28. `gaming_character_instance` (id, id_match, id_user, id_character_template, dexterity, intelligence, constitution, energy, life, sad, id_location, is_sleeping, is_coma, clock_in_coma, timestamp_last_pass , counter_consecutive_pass )
	29. `gaming_character_traits` (id, id_match, id_character_match, id_traits, id_event)
	30. `gaming_backpack_resources` (id, id_character_match, food, magic, coin )
	31. `gaming_inventory_items` (id, id_character_match, id_item, amount , state)
	32. `gaming_state_registry` (id, id_match, key, string_value, int_value , id_character, id_event, id_choice, clock, id_mission, id_mission_steps )
	33. `gaming_state_locations` (id, id_match, id_location, flag_already_actived, clock_counter)
	34. `gaming_turn_queue` (id,id_match, id_character_match, clock, timestamp_start, timestamp_end , pass_counter, priority )
	35. `gaming_active_effects` (id, id_match, id_character_match, clock, id_choise, timestamp_start, timestamp_timeout)
	36. `gaming_active_choices`(id, id_match , clock, id_event, id_choise)
	37. `log_choices_executed` (id, id_match , clock, id_event, id_choise, log_message)
	38. `gaming_story_progress` (id, id_match , clock, id_event, id_choise)
	39. `log_events` (id, id_match, id_character_match, timestamp, id_event, id_choise, log_message)
	40. `log_movements` (id, id_match, id_location_from, id_location_to , id_event, id_choise, log_message, energy, )
	41. `log_item_usage` (id, id_match, id_character_match, id_item, counter, effects_json, timestamp)
	42. `log_weather` (id, id_match, clock, id_weatcher, timestamp_start, timestamp_end)
	43. `chat_messages` (id, id_match, id_user, id_character_match, message, timestamp , counter)
	44. `gaming_user_sessions` ( id, id_user, id_match, last_seen, is_online, client_id, ip, device , channel)
	45. `log_lock_history` (id, id_match, id_character_match, lock_start, lock_end, reason, message)
	46. `log_clock_history` (id, id_match, clock, wheater, timestamp_start, timestamp_end, id_event_start, id_event_end)
	47. `gaming_trades` (id, id_match, id_character_match_sender, id_character_match_dest, id_item, id_inventory_items,status, timeout, resource, amount)
	48. `gaming_notification_queue` (id, id_match, id_chat, flag_system_push, timestamp , type , priority)
	49. `gaming_movement_invites` (id, id_match, id_character_match_sender, id_character_match_friend, state=PENDING/ACCEPTED/EXPIRED/CANCELLED, timestamp_send, timestamp_timeout, timestamp_answer, energy_cost)
	50. `system_snapshot` (id, id_story, id_match, timestamp, type=FULL/LIGHT, jsonb_data, file_path , description)
	51. `gaming_temp_variables` (id, id_match, id_character_match, key, value, type=CLOCK/EVENT/LOCATION/RESOURCES,TRAITS,..., timestamp) {note: example for next 2 clock a charater have +2 in DEX, you cannot move for 3 clock}
7. Rest-Api list
	- Notes:
		- All Rest APIs must have the JWT Token in request
		- In all Rest APIs from Jwt token it's possibile load user information
		- Into match and game APIs it's possibile load character information from user information
	- Auth
		- ✅ POST `/auth/guest`: to create a guess user (without JWT TOKEN) and `/resume` method
		- POST `/auth/register/new`: To create a new user (without JWT TOKEN)		
		- POST `/auth/login`: Standard Login (wihtout JWT TOKEN , Token in output)
		- GET  `/auth/me`: User information and statistics
		- POST `/auth/google`: SSO wih Google		
		- POST `/auth/convert/user`: To convert guess user to a normal user
		- POST `/auth/convert/google`: To convert guess user to google user with SSO
	- Stories
		- *REMOVED* GET `/stories/`: Stories list - removed to no implement
		- GET `/stories/category/{category}`: Stories list filtered by category (only title and card information)
		- GET `/stories/categories`: Category list
		- GET `/stories/group/{group}`: Stories list filtered by group (only title and card information)
		- GET `/stories/groups`: Groups list 
		- GET `/stories/{uuid_story}`: All information about a stori (characters list, difficulties, ...)
	- Contents
		- GET `/content/{uuid_story}/cards/{uuid_card}`: Get a card
		- GET `/content/{uuid_story}/text/{uuid_text}/lang/{lang}`: Get a Text
		- GET `/content/{uuid_story}/creator/{uuid_creator}`: Get a creator
	- Matches
		- GET  `/matches/active`: Matches list in status "wait for others players"
		- GET  `/matches/list/{uuid_user}/{status}`: Matches list filtered by status and by user
		- POST `/matches/{uuid_match}/leave`: Leave a matches if not started
		- POST `/matches`: To create a new match (and creator character select)
		- POST `/matches/{uuid_match}/join`: To join into a new match (and select the character)
		- POST `/matches/{uuid_match}/start`: Creator wanna to start a match until max capacity.
	- Match
		- GET `/match/{uuid_match}/info`: Detail of the location where current character is located (events & choices)
			- Note: The method *info* returns so many informations (location, events, choices, registry), in future if the frontend is making too many REST calls to compose a single view, you could consider GraphQL for future versions. 
			- Note: the method *info* is similar to `STATE_SYNC` into WebSocket topic
		- GET `/match/{uuid_match}/players`: Players/characters list (avatar, state, classes, used "WaitingRoomPage")
		- GET `/match/{uuid_match}/characters/{uuid_character}`: Character details with all statistics
		- GET `/match/{uuid_match}/locations`: Location list (only already visited)		
		- GET `/match/{uuid_match}/missions/active`: Active mission list (only active or completed)
		- GET `/match/{uuid_match}/missions/{uuid_mission}/progress`: Mission details with all steps details
		- GET `/match/{uuid_match}/turn-sequence`: Get the turn sequence with all detail (turn_queue) and status.
		- GET `/match/{uuid_match}/events/history/{page}`: Get event list with pagining system
	- Gameplay movements
		- POST `/gameplay/{uuid_match}/movements/start`: To move characters 
		- GET  `/gameplay/{uuid_match}/movements/pending`: Pending invitations list
		- POST `/gameplay/{uuid_match}/movements/confirm-movement-invite`: To confirm a movement invitation 
	- Gameplay actions
		- POST `/gameplay/{uuid_match}/action/ask-help`: To send a message to all characters to ask help
		- POST `/gameplay/{uuid_match}/action/help-player`: To help a player in same location
		- POST `/gameplay/{uuid_match}/action/execute-event`: Execute an event 
		- POST `/gameplay/{uuid_match}/action/select-choice`: Send an choice option selected 
		- POST `/gameplay/{uuid_match}/action/sleep`: Send a sleep *action*
		- POST `/gameplay/{uuid_match}/action/pass`: Send a pass *action* (could run gameover)
		- POST `/gameplay/{uuid_match}/action/use-exp`: To use exp to upgrade a character
	- Gameplay inventory action
		- GET  `/gameplay/{uuid_match}/inventory`: Active character inventory
		- POST `/gameplay/{uuid_match}/inventory/use-item`: To use an item
		- POST `/gameplay/{uuid_match}/inventory/drop-item` To send or drop an item
		- POST `/gameplay/{uuid_match}/inventory/trade-item`: To send an trade message to another character
		- DELETE `/gameplay/{uuid_match}/inventory/trade/{uuid_trade}`: Undo trade invitation
		- GET  `/gameplay/{uuid_match}/inventory/trades/pending`: All trade message pending/active
		- POST `/gameplay/{uuid_match}/inventory/trade/{uuid_trade}/accept-reject`: To accept an trade message
	- Game Chat
		- GET  `/gamechat/{uuid_match}/chat/{page}`: Get all chat history (paginating)
		- POST `/gamechat/{uuid_match}/chat`: send an message into chat (with spam check = TimeBetweenMessages)
		- GET  `/gamechat/{uuid_match}/notifications/{page}`: Get notification list (paginating)
		- GET  `/gamechat/{uuid_match}/notifications/unread`: Get all unred notification
		- POST `/gamechat/{uuid_match}/notifications/{uuid_notification}/mark-read`: Mark as a read a notification
	- Admin
		- GET   `/admin/matches/`: Load all matches informations
		- PATCH `/admin/matches/{uuid_match}`: Delete/terminate a match
		- GET 	`/admin/params`: Get all parameter values
		- GET 	`/admin/match/{uuid_match}/replay` Get all match logs
		- GET 	`/admin/match/{uuid_match}/log/{filter}`: Get all logs with a filter (character, item, ...)
		- GET 	`/admin/match/{uuid_match}/snapshot`: Get snaphots list
		- PUT 	`/admin/match/{uuid_match}/snapshot/{id}`: Get all information from a snapshot match 
		- PUT 	`/admin/match/{uuid_match}/register`: Put a value into the match register
		- POST 	`/admin/match/{uuid_match}/force-unlock`: Force new day and new turn queue (to lock/loop problem)
		- POST 	`/admin/match/{uuid_match}/kick/{uuid_user}`: To Kick/Ban an user and STOP all match
		- POST	`/admin/system/export`: system export all database data into backup (into storage system)
		- POST	`/admin/system/import`: restore all database data from a file (from storage system)
	- Additional API (maybe not necessary)
		- GET `/match/{uuid_match}/stream/{tipo}`: Get passive information (character locations, missions, registry)
		- GET `/match/{uuid_match}/missions-progress`: Get a missions and progress lists (used in "Quest Log").
		- GET `/match/{uuid_match}/events/{uuid_event}/details`: Get detail of single event
	- API to no develop (not in v1 version)
		- POST `/auth/me/change/password`: To change password
		- POST `/auth/me/change/data`: To change data of a user		
8. WebSocket topic: queue and actions (Rest APIS is not in real-time) `/topic/match/{uuid_match}`:
	- `STATE_SYNC`: tecnical method to send all match information to clients (similar to `info` API)
	1.  `PLAYER_JOINED`: New player joins the match
	2.  `PLAYER_LEFT`: A player left the meatch (after starting)
	3.  `MATCH_STARTED`: THe match is stared
	4.  `MATCH_ENDED`: Matches ends (good or game over)
	5.  `CLOCK_STARTED`: New clock begins (ended previous)
	6.  `TURN_STARTED`:	New turn begins (ended previous) with  "consecutive passes counter" 
	7.	`PLAYER_MOVED`	Player moves to location
	8.	`EVENT_TRIGGERED` Event fires
	9.  `CHOICE_AVAILABLE` Choice presented
	10. `CHOICE_TIMEOUT`
	11.	`ITEM_ACQUIRED`	Item gained
	12.	`CHARACTER_UPDATED`	Stats changed
	13.	`WEATHER_CHANGED` Weather changed
	14. `TRADE`: trade notification
	15. `TRADE_EXPIRED`: notification when trade is expired
	16. `CHAT`: chat system to see all real-time messages
	17. `SYSTEM_MESSAGE`: see special messages from system (example coma message)
	18. `PLAYER_DISCONNECTED`: used to send notification to client when a player is disconnected
	19. `PLAYER_RECONNECTED`: used to send notification to client when a player is reconnected
	20. `NOTIFICATION`: game send to players notifications (example it's start to raining, a character moves, ...)
	21. `TURN_TIMEOUT`: used to send when system automatically triggers a *pass action* and select the next character
	22. `REGISTRY_KEY_CHANGED`: used to send to a client when a registry key is updated 
	23. `MOVE_INVITATION`: used to send a move invitation
	24. `MOVE_INVITATION_EXPIRED`: used to send a notification when a move invitation is expired
	25. `CHARACTER_COMA`: When a character enters coma, all players need immediate notification 
	26. `LOCATION_UPDATED`: Location counter changes. Players at that location need real-time notification
	27. `MOVE_DENIED`: Movement validation failed (energy, registry key condition, path blocked).
	28. `FREE_ACTION_USED`
	29. `FREE_ACTION_EXHAUSTED`
	30. `TURN_TIMEOUT_WARNING`
9. Service list : in italian language *traslation coming soon*!

```
- service java (oltre ai CRUD di tutte le tabelle), alcui sono solo di utilità ma servono! (per ogni vediamo quali hanno una API che serve)
	- auth e utenti
	1. userRegister: registra utente: per la registrazione di un utente
		- sottometodo per registrare come guess
		- sottometodo per convertire da guess a utente
		- sottometodo per convertire da guess a google
		- sottometodo per registrare google sso
	2. userListPerMatch
	3. userChangeInformation
	4. userChangePassword
	- games
	5. gamesFormulaOrdine(elenco characters)
	6. gamesNumeroMassimoPartiteAttiveNelloStessoMomento()
	7. gamesTimeoutPlayerPass()
	8. gamesStories (ritorna la lista storie)
	9. gamesStory (ritorna il dettaglio di una storia con metodi specifici per classi, characters, luoghi, oggetti, meteo, eventi)
	10. gamesCards (elenco carte e elenco testi)
	11. gamesStoryValidation(id_storia) Ritorna un report con errori/warning di una storia
	- match
	12. matchCreate inizia partita: per creare riga in gioco_partite e aspettare che vengano create i characters
	13. matchAddPlayer aggiungi character a partita (id_character_tipo_possibile, classe) che influsce IM
	14. matcheStart avvia partita e inizio primo tempo e primo evento!
	15. matchListNonStared : ritorna la lista delle partite CREATA ma non in CORSO ( anche le altre?)
	16. matchListUtente(id_utente, stato) tutte le partite di un utente	 con filtro per stato
	17. matchChageStatus(id_match, stato) la IA propone un metodo per mettere in pausa o far partire/ripartire una partita
	18. matchAquireLock(id_match,id_character) la IA propone scrive nella nella gioco_lock_history, serve per evitare problemi di concorrenza, usata per gestire nel websocket chi sta agendo, acquisisci un lock su Redis (SETNX game:{id}:lock:char:{id} {timestamp} EX 10). Se fallisce, ritorna errore "Azione in corso".
	19. matchReleaseLock(id_match,id_character) la IA propone scrive nella nella gioco_lock_history, serve per evitare problemi di concorrenza usata per gestire nel websocket chi sta agendo
	- registro e missioni
	20. chiaveRegistroAggiungi (id_match, chiave, valore)
	21. chiaveRegistroLista (id_match)	
	22. missionsStatus(id_match): Ritorna JSON con tutte le missioni e loro progressione.
	- character
	23. characterValoriLimiti (id_match, id_character) ritorna INT,DES,COS,CIBO,MAGIA,RICCH,ELENCO_OGGETTI,FLAG e i limiti , flag che indica se il peso è troppo alto! e tutti gli effetti attivi
	24. characterAddValues(id_match, id_character, energia, sad, vita int, des, cos , cibo, magia , ricch) e verifica limiti!
	25. characterAddExp(id_match,id_character,quantita_exp)
	26. characterAddExp(id_match,quantita_exp) aggiunge exp a tutti i characters della partita
	27. characterSpendiEsperienza(id_match,id_character,des,int,cos) sempre in base al esperienzaCosto
	28. characterAddCaratteristica(id_match,id_character, id_caratteristica)
	29. characterRemoveCaratteristica(id_match,id_character, id_caratteristica)
	30. characterHelpCOMA(id_match,id_character_aiutante,id_character_coma,id_oggetto) characters in coma possono essere "salvati" da un altro character nello stesso luogo che usa una energia oppure da oggetti consumabili che danno vita, verifica stesso luogo e che costa energia in base alla difficoltà
	31. characterAddEffetto(id_match,id_character, tipo_effetto, durata_tempo, valore)
	32. characterRemoveEffetto(id_match,id_character, tipo_effetto)
	- inventory
	33. inventoryAdd(id_match, id_character, cibo,magia,ricchezza,id_oggetto)
	34. inventoryRemove(id_match, id_character, cibo,magia,ricchezza,id_oggetto)
	35. inventoryTradingCreate(id_match,id_character_mittente,id_character_destinatario,id_oggetto)
	36. inventoryAccettaScambio(id_match,id_character_mittente,id_character_destinatario,id_oggetto,id_proposta_scambio)
	37. inventoryRifiutaScambio(id_match,id_character_mittente,id_character_destinatario,id_oggetto,id_proposta_scambio)
	38. inventoryUsaOggetto(id_match,id_character,id_oggetto)
	39. inventoryDiscardItem(id_match,id_character,id_oggetto)
	40. inventoryCheckSufficientCapacity(id_match,id_character,id_oggetto) solo di verifica se oggetto prendibile da character
	- matchRunning
	41. matchAddBonusInizioTempo(id_match,id_character,id_meteo,tempo) non serve id_classe perchè se la prende da solo
	42. matcheSpleep(id_match,id_character) un character scegliere di addormentarsi (o ha finito energia)
	43. matchCheckSleep(id_match) verifica se ci sono characters con energia<=0 allora li addormenta
	44. matchGetcharacterAttivo(id_match) per il websocket , ricalcola chi è attivo, se senza energia passa al successivo
	45. matchPass(id_match, id_character) usato per un giocatore che passa, aggiorna il numero_pass e aggiorna prossimo giocatore con timestamp_inizio_turno, timestamp_fine_turno=timestamp_inizio_turno + TimeoutPlayerPass + TimeoutPlayerEveryPass*numero_pass
	46. matchAllEventDisponibile(id_match) in base alla posizione dei characters ritornare l'elenco degli eventi disponibili e l'elenco dei luoghi vicini possibili (e magari anche quelli non disponibili)
	47. matcheSecondarie(id_match) ritorna tutte le missioni attive con i le varie descrizioni e gli stati
	- time
	48. timeStart(id_match,meteo_new) metodo che modifica le tabelle
	49. timeCalculateNewWeather(id_match,giorno_nuovo) calcola un nuovo meteo senza salvare nulla e ritorna meteo_new
	50. timeAddBonusClasse(id_match,id_character) data la classe e tipo aggiunge valori al character
	51. timeAddBonusLuogoInizioGiornata(id_match) per ogni giocatore in luogo sicuro characterAddValues(energia=DES+P,vita=COS+P,sad=-INT-P), se non si trova in luogo sicuro characterAddValues(energia=DES), P=secure_param del luogo in cui si trova
	52. timeEnd(id_match) metodo di utilità quando tutti i characters sono a zero energia o stanno dormento che poi lancia la timeStart()
	53. timeCalculateCharactersSort: svuota tabella gioco_coda_turni (id_match, id_character_match, ordine_turno) e ripopola con elenco characters con ordine determinato da formula_ordine (In caso di parità si aggiunge id_character)
	54. timeStartDayEventiNeiLuoghi (id_match) per ogni luogo con almeno un giocatore eventExec(id_parita,evento_se_giocatore_inizia_day)
	- spazi
	55. spaceMoveIntoCheck(id_match,id_character_principale) verifica se il movimento è possibile (come regole vicini e costo energia e verifica stato precedente), in caso affermativo invia notifica agli altri giocatori che possono accettare o meno di muoversi secondo le regole, poi si chiama il spaceMoveInto
	56. spaceMoveFollow(id_match,id_character_principale,id_character_assieme) da chiamare quando un character sceglie l'azione follow per seguire un movimento
	57. spaceMoveInto(id_match,id_character_principale,id_characters_assieme): execMoveInto 
	58. spaceList(id_match,id_luogo) lista di tutti gli eventi disponibili in questo luogo (se presenti characters) e la lista delle scelte
	59. spaceFindShortestPath(id_match, id_luogo_start, id_luogo_end) "Qual è il percorso più breve da Luogo A a Luogo Z?" (Dijkstra) e AI dei NPC
	- matchCheck
	60. checkIfAllcharactersInLuogo(id_match,id_luogo) verifica se tutti sono in quel luogo e ritorna quelli che ci sono e quelli che non ci sono
	61. checkStatocharacters(id_match) verifica se tutti stanno dormendo, se ci sono a zero di energia imposta addormentati e timeEnd usando la checkIfcharacterExhausted
	62. checkIfcharacterExhausted(id_match,id_character) se zero energia imposta addormentato e ritorna addormentato! usando la checkIfcharactersad
	63. checkIfcharacterSad(id_match,id_character) se sad>vita imposta vita=vita-COS e zero sad
	64. checkIfcharacterComa(id_match,id_character) se vita<0 imposta addormentato e in coma (è considerato in coma ma anche addormentato)
	65. .checkIfAllComa(id_match) se tutti in coma allora immediatamente execEvent(event_all_coma della storia)
	66. checkVerifyIntegrity(id_match) verifica integrità di inventory, energia negativa, dati negativi, 
	67. checkMissionProgress(id_match, id_character): Confronta registro con condizione_valore_finale e aggiorna stati missioni.
	- snapshot
	68. snapshotCreate(id_match, tipo, nome) prende tutte le tabelle e salva le righe con id_match in tabella (tipo json in un mongo)
	69. snapshotRestore(id_match, snapshot_id) snapshotCreate, poi cancella tutte le righe (per id_match) e poi ripristina tutte le righe (per id_match)
	70. snapshotList(id_match, tempo_da, tempo_a)
	- notification
	71. notificationPush(id_match, target_type, target_id, tipo, messaggio, priority)
	72. notificationMarkAsRead(id_utente, notification_id)
	- exec
	73. execEvents (id_match,id_luogo,id_eventi) vedi sotto
	74. execChoice 
	75. execStartNewTime (...)
	- scheduled
	76. @Scheduled matchcharacterPassTimeout(id_match) un giocatore ha un tot di tempo (parametro TimeoutPlayerPass) superato quel tempo si passa  con messaggio TURN_UPDATE
	77. @Scheduled cleanExpiredTrades: cancella i trade scaduti e manda nel WebSocket TRADE_EXPIRED ai giocatori coinvolti in base al parametro TimeoutTradesExpire
	78. @Scheduled checkTimeCleanUpAFKPlayers: controlla gioco_utente_sessioni per utenti inattivi da più di X minuti, li marca come offline e invia WebSocket PLAYER_DISCONNECTED
	79. @Scheduled utilsFullSnapshot: salva uno snapshot completo della partita ogni X tempo (per backup/rollback), Archivia o cancella partite con stato = TERMINATA più vecchie di X tempo
	80. @Scheduled utilsStatistichs Aggiorna statistiche storiche degli utenti (partite giocate, vittorie, tempo sopravvissuti).
	81. @Scheduled utilsSaveLightSnapshotDaily: salva uno snapshot leggero della partita (solo delta) alla fine di ogni tempo
	82. @Scheduled utilsCleanOrphanSessions: Cancella gioco_movimenti_inviti con tempo_validita < tempo_corrente
	83. @Scheduled matchCheckLockExpiration: Controlla se lock_expiration_timestamp è scaduto senza azioni, sblocca la partita forzatamente e logga in gioco_lock_history.
	84. @Scheduled utilsCleanOrphanWebSocketSessions: Rimuove record da gioco_utente_sessioni se la connessione WebSocket non esiste più o il client_id non corrisponde a nessuna sessione attiva.
	85. @Scheduled matcheSendPendingNotifications: Preleva notifiche da gioco_notification_queue, le ordina per priority, deduplica per hash_deduplica, le invia via WebSocket SYSTEM_MESSAGE e le marca come inviate.
	86. @Scheduled matchCleanExpiredMovementInvites: Cancella gioco_movimenti_inviti oltre tempo_validita in base al TimemoutMovementFollow
	87. @Scheduled timeDailyGameProgression: processo tempo di avanzamento = "inizio tempo", analizzare se serve veramente!
	88. @Scheduled checkTimeoutChoise: in caso di timeout di una scelta nella partita si sceglie l'opzione "altrimenti" se presente, altrimenti non si sceglie nulla e l'evento termina
	- exec
	89. execMoveInto sposta i characters calcolando il costo e poi esegue gli eventi con eventExec (evento_se_giocatore_entra_per_primo, evento_se_prima_volta, evento_se_successive_volte) , esecuzione degli eventi con ordine priority_automatic_event
		- verifica se possibile
			- verifica peso del character / dei characters
			- verifica se il movimento è possibile per regole elenco_luoghi_vicini
		- eventExec (evento_se_giocatore_entra_per_primo, evento_se_prima_volta, evento_se_successive_volte) , esecuzione degli eventi con ordine priority_automatic_event
	90. execEvents(id_paritita,id_luogo,id_eventi,id_character)
		- cicla per ogni evento ed esegue la execEvent (si interrompe se il precedente ha ritornato flag interrompi eventi successivi)
	91. execEvent(id_paritita,id_luogo,id_evento,id_character)
	- 91a eventTerminePartita: se id_evento===evento_partita_terminata imposta fine partita e continua
	- 91b eventCostEnergia
		- verifica il costo di energia: se non ha abbastanza energia si l'evento si ferma (si interrompe con un bel return e flag interrompi eventi successivi)
		- verifica il costo in ricchezza (se costo_ricchezza>0): se non ha abbastanza ricchezza l'evento si ferma
		- decremento dell'energia (visto che c'è) e continua
		- decremento della ricchezza (se costo_ricchezza>0)
		- se causa_fine_tempo allora chiamare timeEnd che imposta a zero energia e via! flag interrompi eventi successivi
	- 91c eventApplyEffects
		- se in base alla elenco_eventi_effetti allora characterAddValues
		- se caratteristica_daaggiungere, caratteristica_darimuovere allora characterAddCaratteristica/characterRemoveCaratteristica
	- 91d eventModifyRegistry
		- se registro_chiave, registro_valore allora chiaveRegistroAggiungi
		- se elenco_eventi_effetti="MOVIMENTO" allora spaceMoveInto e space (capire come)
		- se meteo_causato allora timeSet e flag interrompi eventi successivi
	- 91e eventAddObject
		- se id_oggetto_da_aggiungere allora inventoryCheckSufficientCapacity e inventoryAdd
	- 91f eventTriggerChoice		
		- ritorno descrizione/testo, elenco scelte e flag interrompi eventi successivi
	92. execChoice (id_paritita, in base al id_luogo o id_evento, id_Scelta, id_character, ...)
	- nota: se otherwise_flag (è sempre possibile) senza verifiche
	- 92a verifica condizioni limite_sad, limite_des, limite_int, limite_cos, limite_sad, limite_des, limite_int, limite_cos
	- 92b verifica condizione nella elenco_scelte_condizioni e logic_operator (tutte devono essere verificate) altrimenti ritorno non possibile 
	- 92c characterAddValues in base al elenco_scalte_effetti (se effetto_di_gruppo su tutti i characters nel luogo)
	- 92d check is_progresso (se is progresso=true allora insert nella gioco_trama_progresso)
	- 92e eventExec ( id_evento_risultato ) se valorizzato altrimenti return "l'azione termina"
	93. execStartNewTime(id_paritita)
	- 93a checkTerminato (se una partita è terminata ritorna senza fare nulla)
	- 93b regole fine giorno
		- checkAddormentati verifica che tutti i giocatori siano addormentati (zero energia) se non lo sono imposta zero
		- WebSocket DAY_END
		- log salvo snapshot leggero della partita (solo delta)
		- gioco_movimenti_inviti cancella tutto
		- resetto turno_scadenza_ts e id_character_current_turn
	- 93c incrementi/riduzione
		- incremento numero tempo (in memoria e in tabella tempo_corrente in gioco_partite )
		- tutti giocatori recuperano vita, sad, energia in base alle regole
		- Riduce durata_tempo in gioco_effetti_attivi; se arriva a zero, rimuove l'effetto.
		- Riduce counter_tempo dei luoghi ogni tempo; se arriva a zero, scatena event_if_counter_zero (decrementLocationCounters)
		- Applica danni/benefici di gioco_effetti_attivi con trigger_momento = ON_DAY_START ogni inizio tempo (applyDailyEffects) e cancella quelle terminate
		- Aumenta tempo_in_coma per characters in COMA; messaggio in chat che un utente sta morendo (checkComaDeath)
		- resetto counter_consecutive_pass a zero
	- 93d verifiche 
		- Verifica game over: se tutti i characters sono in coma o counter_consecutive_pass > PARAMETRO -> termina partita con stato GAMEOVER
	- 93e nuovi eventi (lista)
		- calcolo nuovo meteo casuale (generateDailyWeather): dalla lista dei meteo validi, applica peso probabilità, aggiorna meteo corrente in gioco_partite_attive e invia GAME_EVENT via WebSocket
		- Verifica condizioni di elenco_global_random_events, lancia dado probabilità, lista eventi add random_Event
		- se il meteo prevede un id_evento_scatenato allora lista eventi add id_evento_scatenato
		- timeStartDayEventiNeiLuoghi per aggiungere alla lista eventi i evento_se_giocatore_inizia_day dei luoghi che hanno almeno un character
		- ricostruisco gioco_coda_turni in base a formula MatchFormulaOrdine delle priorità con calcolo id_character_current_turn
		- ritorno lista eventi e lista turni
	- 93f invio a giocatori
		- WebSocket GAME_EVENT per nuovo meteo e evento inizio tempo
		- WebSocket TURN_UPDATE per il primo giocatore
		- Preleva notifiche da gioco_notification_queue e le invia via WebSocket, deduplica per hash.
		- puliziaPlayer: Rimuove record da gioco_utente_sessioni se last_seen più vecchio di X minuti.
	- additional
	94. un'interfaccia ConditionChecker con implementazioni specifiche (RegistryConditionChecker, StatConditionChecker, etc.) che il service cicla dinamicamente. 
	95. inmporter : processo che da uno json/yaml popola tutte le tabelle "elenco_" mettendo gli id correntti come chiavi esterne!
- possibile frontend-web(react con bootstrap5 e ultima versione di fontawesome) 
	- messaggio iniziale: da dato questo gioco, voglio iniziare a pensare alla parte grafica del frontend-web, dammi la lista dei component che faresti, dammi solo elenco senza pensare al codice
	- idea di base: essendo ispirato ad un librogame voglio farlo a mo di libro e di raccoglitore di carte, tipo raccoglitore di carte magic/pokemon
		- ogni character è un raccoglitore : prima pagina carta character con classe e tipo, le altre pagine sono elenco effetti, elenco caratteristiche, elenco oggetti inventory
		- raccoglitore del registro : lista carte raccolte per ogni voce nel registro
		- raccoglitore di missioni: ogni missione e step ha una carta (una missione carta e una missione per step)
		- la mappa invece è una griglia dove le carte dei luoghi viene posizionata (i luoghi ci sono anche sopra/sotto/cielo)
	- Elenco Componenti Frontend (React)
		- Autenticazione e Utente
		1. LoginForm – Form di login con username/password
		2. RegisterForm – Form di registrazione nuovo utente
		3. GoogleSSOButton – Bottone per login con Google
		4. UserProfile – Schermata profilo utente con statistiche storiche
		5. ChangePassword – Modale per cambio password
		6. ChangeDataModal – Modale per modifica dati utente
		- Lobby e Gestione Partite
		7. GameLobby – Pagina principale con lista partite disponibili
		8. GameList – Lista delle partite attive/non iniziate
		9. GameCreationForm – Form per creare una nuova partita (scelta storia e difficoltà)
		10. GameInfoCard – Card con info partita (titolo, difficoltà, giocatori)
		11. WaitingRoom – Pagina di attesa prima dell'inizio partita
		12. PartyList – Lista giocatori iscritti alla partita con avatar e stato online/offline
		- Selezione character e Classe
		13. CharacterSelection – Componente per scegliere character e classe
		14. CharacterCard – Card singola per visualizzare un character (come carta Magic/Pokemon)
		15. ChooseClass – Componente per scegliere la classe
		16. CharacteristicsSelector – Componente per scegliere caratteristiche (bello, buono, etc.)
		- Gestione sistema card
		17. CardComponent: componente che mostra una carta nel raccoglitore
		18. Segnalibro nel raccoglitore
		- Stato character (Statistiche)
		19. CharacterStatsPanel – Pannello con tutte le carte del character tipo raccoglitore di carte
		20. EnergyLifeSadnessBar – Barra energia e vita e sad (estende/usa CardComponent)
		21. SleepStatus - Mostra lo stato di addormentato (estende/usa CardComponent)
		22. ExperienceBar – esperienza  (usare tipo segnalibro nel raccoglitore)
		23. StatBadge – Badge per DES, INT, COS (estende/usa CardComponent per statistica)
		24. TraitList – Lista caratteristiche del character (legale, buono, etc.) (estende/usa CardComponent per ogni caratteristica)
		25. EffectList – Lista effetti temporanei attivi sul character e che mostra se in un character è addormentato (estende/usa CardComponent per ogni effetto)
		26. ComaStatusBanner – Banner che indica se il character è in coma (estende/usa CardComponent)
		- Inventario e inventory tipo raccoglitore di carte
		27. InventoryPanel – Pannello inventario con cibo, magia, ricchezza, oggetti(estende/usa CardComponent)
		28. ConsumableList – Lista oggetti consumabili nello inventory(estende/usa CardComponent)
		29. WeightIndicator – Indicatore peso attuale/massimo (usare tipo segnalibro nel raccoglitore)
		30. UseItemButton – Bottone per usare un oggetto
		31. DropItemButton – Bottone per scartare un oggetto
		32. SendItemButton – Bottone per inviare un oggetto a un altro giocatore
		- Scambi (Trade) e in futuro altre cose del party
		33. ExchangePanel – Pannello per proporre/accettare scambi
		34. TradeProposalModal – Modale per proporre uno scambio
		35. TradeAcceptRejectButton – Bottoni per accettare/rifiutare scambio
		36. PendingTradesList – Lista scambi in attesa (usare tipo segnalibro nel raccoglitore)
		- Mappa e Luoghi
		37. MapView – Vista mappa con griglia di luoghi (stile tabellone)
		38. LocationCard – Card singola per un luogo (stile carta collezionabile)
		39. LocationGrid – Griglia 3D (sopra/sotto/cielo) per posizionare le carte luoghi
		40. LocationDetailModal – Modale con dettagli completi di un luogo
		41. MovementPanel – Pannello per mostrare luoghi vicini e possibilità di movimento
		42. FollowMovementDialog – Dialogo per accettare invito di movimento di gruppo (tipo carta che compare come modale!?)
		- Eventi e Scelte
		43. EventNotification – Notifica evento (toast/modale) sempre estende/usa CardComponent
		44. EventDescriptionPanel – estende/usa CardComponent con descrizione narrativa dell'evento
		45. ChoicesPanel – Componente tipo mini-raccoglitore che visualizza la lista delle opzioni
		46. ChoiceOption – Singola opzione estende/usa CardComponent se possibile e bottini per scegliere
		47. ChoiceTimeoutIndicator – Timer per scelta con countdown tipo clessidera
		- Registro e Missioni
		48. RegistryViewer – Visualizzazione registro annotazioni (come raccoglitore carte)
		49. RegistryCard – Carta singola per una chiave del registro (che estende/usa CardComponent)
		50. MissionLog – Elista con elenco missioni attive (stile pagine di un libro dove sono scritti gli eventi)
		51. MissionCard – Carta missione con titolo e descrizione (che estende/usa CardComponent)
		52. MissionStepCard – Carta singola per uno step di missione (che estende/usa CardComponent)
		- Turno e Azioni
		53. TurnSequencePanel – Pannello che mostra l'ordine dei turni (chi è il prossimo)  (che estende/usa CardComponent, i characters mostrati come mini-card)
		54. TurnTimer – Timer del turno come clessidera
		55. ActionPanel – Pannello con pulsanti per azioni disponibili (muovi, evento, oggetto, passa, dormi) , ogni azione è una che estende/usa CardComponent)
		56. PassButton – Bottone per passare il turno (card che estende/usa CardComponent)
		57. SleepButton – Bottone per addormentarsi volontariamente (card che estende/usa CardComponent)
		58. InteractEventButton – Bottone per interagire con un evento facoltativo (card che estende/usa CardComponent)
		- Meteo e Tempo
		59. WeatherIndicator – Indicatore meteo corrente con icona (card che estende/usa CardComponent)
		60. DailyEventsPanel – Pannello eventi giornalieri (inizio tempo) (card che estende/usa CardComponent)
		61. DayCounter – Contatore tempo/giorno corrente (card che estende/usa CardComponent)
		62. EndOfDayPanel – Pannello recap fine tempo (card che estende/usa CardComponent)
		- Chat e Comunicazioni
		63. ChatBox – Componente chat completo : questo lo vorrei come una lista di postit dove ogni character scrive un postit, magari usare postit rettangolari e non quadrati
		64. ChatMessageList – Lista messaggi chat , lista di postit
		65. ChatInputBox – Input per inviare messaggi , singolo postit da inviare
		66. GameNotifications – Lista notifiche di sistema (tipo notifiche push) - postit o carta ?
		67. SystemMessageToast – Toast per messaggi di sistema (es. "Piove!") postiti oppure card
		- WebSocket parte1 (Separare logica WebSocket in un custom hook)
		68. WebSocketStatusIndicator – Indicatore connessione WebSocket (online/offline) in alto a destra
		69. ReconnectingBanner – Banner che avvisa che il giocatore si sta riconnettendo (card che estende/usa CardComponent) modale
		70. PlayerDisconnectedBadge – Badge che indica se un giocatore è disconnesso (icona sopra la card del character nel party)
		- Log e Storia
		71. GameLogViewer – Visualizzatore cronologia eventi della partita (come raccoglitore di tante card)
		72. LogEventCard – Card singola per un evento nel log
		73. ActionHistoryPanel – Pannello con storico azioni del character (lista card?
		- Admin e Debug
		74. AdminPanel – Pannello admin per gestione partite e parametri
		75. ReplayViewer – Visualizzatore replay partita
		76. SnapshotViewer – Visualizzatore snapshot partite
		77. RegistryEditorAdmin – Editor registro per admin
		78. ForceUnlockButton – Bottone admin per sbloccare partita
		79. KickPlayerButton – Bottone admin per espellere giocatore
		- Utilità e UI Generici
		80. LoadingSpinner – Spinner di caricamento (non usiamo la card)
		81. ErrorMessage – Messaggio di errore generico (card che estende/usa CardComponent)
		82. ConfirmModal – Modale di conferma generica (card che estende/usa CardComponent)
		83. TooltipWrapper – Wrapper per tooltip con FontAwesome
		84. CardFlipAnimation – Animazione flip carta (stile Pokemon/Magic)
		85. ProgressBar – Barra di progresso generica
		86. Clessidera - usato quando c'è un timeout! da mostrare in barra o in posizione da definire!
		- Componenti Specifici per "Raccoglitore Carte"
		87. CardCollection – Componente raccoglitore carte (visualizzazione griglia)
		88. CardPage – Pagina singola del raccoglitore
		89. FlipCard – Carta con fronte/retro (flip al click)
		90. CardGalleryModal – Modale per visualizzare carta ingrandita
		- Componenti di Layout
		91. AppLayout – Layout principale app
		92. Header – Header con logo e menu
		93. Footer – Footer con info
		94. Sidebar – Sidebar con menu navigazione
		95. ModalContainer – Contenitore generico per modali
		- WebSocket parte2 (Separare logica WebSocket in un custom hook)
		96. Inizializza e gestisce la connessione WebSocket
		97. WebSocketMessageDispatcher Parsing e dispatch messaggi WebSocket
		98. WebSocketMessageHandler Gestisce logica di sincronizzazione automatica
		99. WebSocketHeartbeat Mantiene viva la connessione con PING/PONG
		100. WebSocketReconnectModal Modale di riconnessione in caso di disconnessione
		101. WebSocketMessageQueue Coda messaggi per gestire disconnessioni temporanee
```



# Version Control
- First version created with AI prompt:
    > I want to create a game called PathsGame; given these rules, provide them to me.
    
	> Given this game, without questioning the listed game rules, list the APIs and the WebSocket topics needed (no code).
   
    > Given this game, without questioning the listed game rules, list the services required (no code).
    
	> Given this game, without questioning the listed game rules, I want to start thinking about the frontend-web graphics; give me the list of components you would create, only the list and no code.  
	
	> I wanna add a new logic: player without login but only with cookies save into browser, tell me what do you think?
- **Document Version**: 0.10.12
	- 0.1.0: fist version of file in italian language (February 3, 2026)
	- 0.1.1: added licence and version control sections (February 5, 2026)
	- 0.9.0: traslated and updated roles and table sections (March 13, 2026)
	- 0.9.1: add "play without login" to enable anonymous/guest user (March 16, 2026)
	- 0.10.12: traslated API and WebSocket and updated tables sections (March 19, 2026)
- **Last Updated**: March 16, 2026
- **Status**: In progress, traslation *coming soon*



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




