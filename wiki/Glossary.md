# Glossary

Domain terms used across code, API and design docs, in one place so they stay consistent.
Deeper detail is linked from the relevant `documentation_vN/StepNN_*.md` file.

| Term | Meaning |
|---|---|
| Admin port | Dedicated port (`8044`) serving only `/api/admin/**`; the public port 404s those paths. See [Security](./Security.md). |
| Card | The visual/illustration unit attached to a location, event, weather state or item. |
| Character instance | `gaming_character_instance` row: one player's live character in one match — stats, exp, coma flag. |
| Character template | `list_character_templates` row: base-stat archetype a player picks at join, gated by class. |
| Choice | A player-facing option opened by a choice-owning event; resolved via `select-choice`, applying its `list_choices_effects`. |
| Class (character) | A category gating which templates and traits a player may pick (`id_class_permitted`/`id_class_prohibited`). |
| Clock | The match's shared time counter, advanced by each time-start/time-end cycle. |
| Coma | An edge state: a character that can no longer act until it recovers (safe-location rest) or the party wakes it. |
| Counter | A per-location countdown (`list_locations.counter_time`, seeded into `gaming_state_locations.clock_counter`), decremented at each time-start. |
| Counter-zero | The moment a location's counter reaches `0`; its `id_event_if_counter_zero` is logged as a pending automatic event. |
| Difficulty | A `list_stories_difficulty` row: per-story tier bounding stat budgets, trait-cost budgets and exp costs. |
| Effect | A stat, registry, item, movement or weather change applied by an event, a choice or an item use. |
| Event | A story node (`list_events`) triggered by a player (normal event) or automatically (location entry, counter-zero, random). |
| Exp | `gaming_character_instance.exp`; earned during play, spent via `use-exp` to raise DEX/INT/COS. |
| Flag_visited | `gaming_state_locations` column marking a location as already reached by the party; gates `FIRST_ENTRY` vs `SUBSEQUENT_ENTRY` triggers. |
| Fog-of-war | Hides map/neighbor detail for locations the party has not yet visited (gated by the visited-locations set, not `flag_visited` alone). |
| Guest | The only identity type in V0: an anonymous player identified by a JWT plus a `guestCookieToken`, no password account. |
| Hotfix | A `hotfix/{name}` git branch for a critical production fix; post-launch patch releases (`X.42.z`) are logged in a version's `Hotfixes.md`, outside the roadmap. |
| Location | A story node (`list_locations`) with neighbors, a counter, a safety flag and entry triggers. |
| Match | One played session of a story (`gaming_match`): players, characters, turn state, clock. |
| Mission | A projection of registry condition keys into an `AVAILABLE` → `ACTIVE` → `COMPLETED`/`FAILED` status machine — no separate operator or state table. |
| Pass | A turn-cycle action that ends a player's turn without taking another action. |
| Random event | One `list_global_random_events` row that may fire at each time-start (after weather), party-wide, by absolute-percentage odds. |
| Registry | The match's shared key/value state, rendered/parsed/evaluated by one `RegistryService` using `∃`/`∄`/`∀` operators. |
| Registry key | One named entry in the registry, written by events/choices/items and read by triggers, missions and weather rules. |
| Sadness | A character's stress/negative stat; overflowing it is what puts a character into coma. |
| Secure_param | The "is this location safe" signal on `list_locations` (Java's `is_safe`; Python renamed the column to `secure_param`). |
| Sleep | A player action that runs time-start recovery for their character (stat recovery, clock decrement, possible coma wake). |
| Stage | A version's own deployed environment (AWS stack, bucket, site), named after the Greek alphabet — see [Environments §3](./Environments.md). |
| Step | One roadmap unit; a step is a minor version (step N of version X is `X.N.0`). |
| Story | The top-level narrative package: locations, events, cards, texts, characters, difficulty settings. |
| Text | A localized string (`list_texts`) attached to a card, location or event, keyed by language. |
| Time | The match's shared game-time dimension, advanced by the time-start/time-end cycle. |
| Time-end | The close of a turn cycle, right before the next time-start. |
| Time-start | The start of a new game-time tick: weather roll, random-event roll, counter decrement, per-character recovery. |
| Trait | A `list_traits` row: a stat-delta modifier a character can carry, granted at creation, by class, or by an item/event. |
| Trigger | The condition (registry, counter, entry) that fires an automatic event. |
| Turn | One player's action slot within the turn-cycle engine. |
| Version | A major release line (V0, V1, …), containing exactly 42 steps — see `wiki/VersionTemplate.md`. |
| Weather | A per-clock, weighted-random environmental state affecting energy costs, rolled and logged at time-start. |

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared list of game and system words | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
