"""
seed/handler.py — Paths Games AWS Lambda
Dev-only endpoint: inserts (or replaces) the 4 standard test users AND the 2
seed stories that mirror the data defined in:
  code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql
  code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql

POST /api/dev/seed

Returns 403 if ENV != 'dev' so this endpoint is harmless in production deployments.

Fixed deterministic UUIDs — stable across re-runs:
  test_admin   → 00000001-1111-0000-0000-000000000001  (ADMIN)
  test_player1 → 00000002-2222-0000-0000-000000000002  (PLAYER / Alice)
  test_player2 → 00000003-3333-0000-0000-000000000003  (PLAYER / Bob)
  test_player3 → 00000004-4444-0000-0000-000000000004  (PLAYER / Charlie)

Seed stories:
  Tutorial          → a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d  (PUBLIC, tutorial)
  Valvassore Demo 1 → b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e  (PUBLIC, historical)

Access tokens (use in Authorization: Bearer <token> header):
  When ALLOW_MOCK_ACCESS=true (dev default):
    test_admin   → MOCK_ACCESS_00000001-1111-0000-0000-000000000001
    test_player1 → MOCK_ACCESS_00000002-2222-0000-0000-000000000002
    test_player2 → MOCK_ACCESS_00000003-3333-0000-0000-000000000003
    test_player3 → MOCK_ACCESS_00000004-4444-0000-0000-000000000004
  When ALLOW_MOCK_ACCESS=false: real HS256 JWTs are returned in the response body.
"""

import json
import os
import time

from common import db_utils
from common import jwt_utils
from common.response import HEADERS
from common.data_utils import (safe_int as _safe_int,
                               resolve_raw_text as _resolve_raw_text,
                               resolve_card_from_raw as _resolve_card_from_raw)

# ─── constants ────────────────────────────────────────────────────────────────

# Canonical marker tagging rows created by automated (Robot Framework) test
# runs — see POST /api/dev/cleanup below.
ROBOT_TEST_MARKER = "robottest"

# BCrypt hash is loaded from the environment variable SEED_BCRYPT_HASH
# (set via CloudFormation parameter SeedBcryptHash with NoEcho:true)
# Never hardcode password hashes in source code.
BCRYPT_HASH = os.environ.get("SEED_BCRYPT_HASH", "")

# Seed users — mirrors R__insert_dev_test_data.sql exactly
SEED_USERS = [
    {
        "uuid":     "00000001-1111-0000-0000-000000000001",
        "username": "test_admin",
        "email":    "admin@test.local",
        "role":     "ADMIN",
        "state":    2,
        "nickname": "TestAdmin",
        "language": "en",
    },
    {
        "uuid":     "00000002-2222-0000-0000-000000000002",
        "username": "test_player1",
        "email":    "player1@test.local",
        "role":     "PLAYER",
        "state":    2,
        "nickname": "Alice",
        "language": "en",
    },
    {
        "uuid":     "00000003-3333-0000-0000-000000000003",
        "username": "test_player2",
        "email":    "player2@test.local",
        "role":     "PLAYER",
        "state":    2,
        "nickname": "Bob",
        "language": "en",
    },
    {
        "uuid":     "00000004-4444-0000-0000-000000000004",
        "username": "test_player3",
        "email":    "player3@test.local",
        "role":     "PLAYER",
        "state":    2,
        "nickname": "Charlie",
        "language": "it",
    },
]

# ─── Seed stories — mirrors R__insert_story_seed_data.sql ─────────────────────
# Story 1: DEMO — Learn to Play Paths Games (Tutorial)
# Story 2: Il Valvassore di Marca
SEED_STORIES = [
    {
        "uuid":       "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "author":     "PathsMaster",
        "category":   "tutorial",
        "group":      "tutorial",
        "visibility": "PUBLIC",
        "priority":   100,
        "peghi":      0,
        "versionMin": "0.14.0",
        "clockSingularDescription": "turn",
        "clockPluralDescription":   "turns",
        "linkCopyright": None,
        "texts": {
            "en": {
                "title":       "TUTORIAL — Learn to Play",
                "description": "A short training adventure in the Academy of Paths. "
                               "Learn movement, energy, items, choices, and missions "
                               "in a safe environment. Perfect for new players.",
            },
            "it": {
                "title":       "TUTORIAL — Impara a Giocare",
                "description": "Una breve avventura di addestramento nell'Accademia di Paths. "
                               "Impara movimento, energia, oggetti, scelte e missioni "
                               "in un ambiente sicuro. Perfetta per i nuovi giocatori.",
            },
        },
        "difficulties": [
            {
                "uuid": "diff-tutorial-001",
                "texts": {
                    "en": {"title": "Tutorial"},
                    "it": {"title": "Tutorial"},
                },
                "expCost": 1, "maxWeight": 20,
                "minCharacter": 1, "maxCharacter": 4,
                "costHelpComa": 1, "costMaxCharacteristics": 1,
                "numberMaxFreeAction": 3,
                "life": 120, "energy": 110, "sad": 0,
                "dexterity": 12, "intelligence": 12, "constitution": 12, "weight": 12,
                # Step 23 — trait cost budgets (None = no limit)
                "traitCostPositiveBudget": 2, "traitCostNegativeBudget": 3,
            },
        ],
        "difficulty_count": 1,
        "location_count":   8,
        "event_count":      5,
        "item_count":       4,
        # Step 19 — runtime seed data: locations and registry keys
        "idLocationStart":   1,
        "locations": [
            # Step 26: location 1 is safe (secureParam > 0) so the start-location
            # recovery exercises the safe branch; location 2 carries a time counter
            # with a counter-zero event for the decrement/flag path.
            # Step 27.x — locations reference a real card via idCard; the card is
            # resolved from raw_cards at seed time (see _seed_stories), so it also
            # appears in the story's card list instead of being an orphan literal.
            # Step 33 — the fuse now points at an AUTOMATIC event that actually does
            # something (Step 26 only ever flagged it as pending).
            # v0.33.2 — the fuse sits on the START location, as it does in the Java and
            # Python seeds. A notice about a place the recipient has never seen is
            # ANONYMOUS and travels stripped of every card — correct fog of war, but then
            # no seed anywhere exercises the FULL branch that carries the three cards.
            {"id": 1, "uuid": "loc-tutorial-1", "name": "Welcome Hall", "counterTime": 2,
             "secureParam": 1, "idEventIfCounterZero": 43, "idCard": 2,
             "priorityAutomaticEvent": 1},
            # Step 33 — the first arrival here differs from every later one.
            {"id": 2, "uuid": "loc-tutorial-2", "name": "Practice Yard", "counterTime": 0,
             "secureParam": 0, "idEventIfCounterZero": None, "idCard": 3,
             "idEventIfFirstTime": 40, "idEventNotFirstTime": 41},
            # v0.29.3 — deliberately has NO neighbor edge: only the teleport effect
            # (event 28) can bring a character here, proving the forced movement
            # skips every Step 28 check. Which is also why it can host no entry
            # trigger: a trigger nobody can walk into is one no end-to-end test reads.
            {"id": 3, "uuid": "loc-tutorial-3", "name": "Hidden Grove", "counterTime": 0,
             "secureParam": 1, "idEventIfCounterZero": None, "idCard": 2},
            # v0.33.2 — the two triggers that are not history-based, each on a walkable
            # location. 4 fires when the arriving character finds the room empty
            # (OCCUPANCY — in single-player, every arrival).
            {"id": 4, "uuid": "loc-tutorial-4", "name": "Empty Cellar", "counterTime": 0,
             "secureParam": 1, "idEventIfCounterZero": None, "idCard": 2,
             "idEventIfCharacterEnterEmptyLocation": 42},
            # 5 fires when a time unit BEGINS with somebody standing here, so it is
            # reported on the sleep that advanced the clock, not on a movement.
            {"id": 5, "uuid": "loc-tutorial-5", "name": "Sundial Court", "counterTime": 0,
             "secureParam": 1, "idEventIfCounterZero": None, "idCard": 2,
             "idEventIfCharacterStartTime": 44, "priorityAutomaticEvent": 2},
        ],
        # Step 27.x — neighbor links between locations (bidirectional 1<->2)
        # v0.33.2 — extended into a walkable chain 1 <-> 2 <-> 4 <-> 5 so the entry
        # triggers of 4 and 5 are reachable on foot.
        "neighbors": [
            {"id": 1, "uuid": "nb-tutorial-1", "idLocationFrom": 1, "idLocationTo": 2,
             "direction": "N", "flagBack": 1, "energyCost": 1, "idCard": None,
             # Step 0.28.2 — optional return card shown when the player stands on
             # locationTo (2); resolves to catalog card 2 (Welcome Hall).
             "idCardBack": 2,
             "card": {"title": "To the Practice Yard", "description": "A short walk north.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-up"}},
            {"id": 2, "uuid": "nb-tutorial-2", "idLocationFrom": 2, "idLocationTo": 4,
             "direction": "E", "flagBack": 1, "energyCost": 0, "idCard": None,
             "idCardBack": 3,
             "card": {"title": "Down to the Cellar", "description": "Nobody has been here in a while.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-right"}},
            {"id": 3, "uuid": "nb-tutorial-3", "idLocationFrom": 4, "idLocationTo": 5,
             "direction": "N", "flagBack": 1, "energyCost": 0, "idCard": None,
             "idCardBack": 2,
             "card": {"title": "Out to the Sundial", "description": "The hours are marked in stone.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-up"}},
        ],
        "keys": [
            {"id": 1, "uuid": "key-tutorial-1", "keyName": "tutorial_intro_done",
             "keyValue": "0", "keyGroup": "tutorial", "visibility": "PUBLIC", "priority": 1},
            {"id": 2, "uuid": "key-tutorial-2", "keyName": "training_completed",
             "keyValue": "0", "keyGroup": "tutorial", "visibility": "PUBLIC", "priority": 2},
        ],
        # Step 20.1 — events for end-game trigger; Step 27.x — idLocation + card
        "idEventEndGame":    99,
        "events": [
            {"id": 99, "uuid": "evt-tutorial-end", "name": "Tutorial Complete",
             "idLocation": None, "type": "END_GAME", "idCard": None},
            # idCard (resolved against raw_cards) instead of an orphan inline literal: this
            # event is NORMAL, so it is offered on /info like any Step 29 one, and the card
            # the board renders is resolved — and localized — from the catalog.
            {"id": 1,  "uuid": "evt-tutorial-1",   "name": "Intro Greeting",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            # Step 29 — one event per branch of the check procedure, all at the start
            # location (1), plus the "unlocker" that makes each blocked one available.
            # costEnery/coinCost/flagEndTime are spelled out even when they are 0: the SQL
            # backends get the 0 from a column default, here the seed IS the schema, and a
            # missing key reads back as null.
            {"id": 10, "uuid": "evt-step29-plain", "name": "Search the Hall",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 1, "costCoin": 0, "flagEndTime": 0},
            {"id": 11, "uuid": "evt-step29-once", "name": "A Single Chance",
             "idSpecificLocation": 1, "type": "ONCE", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 12, "uuid": "evt-step29-noenergy", "name": "Exhausting Deed",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 999, "costCoin": 0, "flagEndTime": 0},
            {"id": 13, "uuid": "evt-step29-nocoins", "name": "Costly Deed",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 999, "flagEndTime": 0},
            # v0.35.3 — the twins of 13 for the two new refusals, plus one an actual
            # backpack can afford.
            {"id": 53, "uuid": "evt-v0353-nofood", "name": "Hungry Work",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "costFood": 999, "costMagic": 0,
             "flagEndTime": 0},
            {"id": 54, "uuid": "evt-v0353-nomagic", "name": "Draining Rite",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "costFood": 0, "costMagic": 999,
             "flagEndTime": 0},
            {"id": 55, "uuid": "evt-v0353-affordable", "name": "A Fair Price",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 1, "costFood": 2, "costMagic": 1,
             "flagEndTime": 0},
            {"id": 14, "uuid": "evt-step29-registry", "name": "Behind the Gate",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0,
             "registryKeyCondition": "STEP29_GATE", "registryValueCondition": "OPEN"},
            {"id": 15, "uuid": "evt-step29-class", "name": "A Warrior's Deed",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0,
             "idClassCondition": 1},
            # Weather 3 is the seed's inactive rule: it is never rolled at time-start, so this
            # event starts blocked in every run and only event 21 can open it.
            {"id": 16, "uuid": "evt-step29-weather", "name": "Under the Storm",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0, "idWeather": 3},
            {"id": 17, "uuid": "evt-step29-elsewhere", "name": "Far Away Deed",
             "idSpecificLocation": 2, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 18, "uuid": "evt-step29-chain", "name": "The First Link",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0, "idEventNext": 19},
            {"id": 19, "uuid": "evt-step29-chain-tail", "name": "The Last Link",
             "idSpecificLocation": None, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 20, "uuid": "evt-step29-open-gate", "name": "Open the Gate",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 21, "uuid": "evt-step29-set-weather", "name": "Call the Storm",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 22, "uuid": "evt-step29-endtime", "name": "Rest Until Dawn",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 1},
            {"id": 23, "uuid": "evt-step29-traits", "name": "Take Heart",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 24, "uuid": "evt-step29-item", "name": "The Locked Chest",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0,
             "idItemCondition": 1},
            {"id": 25, "uuid": "evt-step29-grant-item", "name": "Find the Key",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            # v0.34.0 inventory pair: 50 is gated by item 2, which 51 grants. Because item 2
            # is CONSUMABLE, using it must close 50 again — the step-34 acceptance test.
            {"id": 50, "uuid": "evt-step34-item-gate", "name": "The Scholar's Door",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0,
             "idItemCondition": 2},
            {"id": 51, "uuid": "evt-step34-grant", "name": "Open the Satchel",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 52, "uuid": "evt-step35-grant-heavy", "name": "Lift the Ingot",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 26, "uuid": "evt-step29-resources", "name": "Raid the Pantry",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 27, "uuid": "evt-step29-auto", "name": "The Wind Rises",
             "idSpecificLocation": 1, "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            # v0.29.3 — its effect teleports the actor to the Hidden Grove (3).
            # costEnery 2 keeps the "cost 1" robot lookup unambiguous (it means event 10).
            {"id": 28, "uuid": "evt-step29-teleport", "name": "Secret Passage",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "costEnery": 2, "costCoin": 0, "flagEndTime": 0},
            # Step 33 — the events nobody asks for. Named BY the location, through its
            # idEvent* columns, so idSpecificLocation stays absent and /info never offers
            # them as actions. type AUTOMATIC is what the {NORMAL, ONCE} allowlist already
            # refuses to players, and none of them owns a choice.
            {"id": 40, "uuid": "evt-step33-first", "name": "A Door Left Open",
             "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 41, "uuid": "evt-step33-subsequent", "name": "The Same Door",
             "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 42, "uuid": "evt-step33-alone", "name": "Nobody Here",
             "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            {"id": 43, "uuid": "evt-step33-counter", "name": "The Fuse Burns Out",
             "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            # v0.33.2 — the time-start trigger of location 5.
            {"id": 44, "uuid": "evt-step33-starttime", "name": "The Hour Turns",
             "type": "AUTOMATIC", "idCard": 1,
             "costEnery": 0, "costCoin": 0, "flagEndTime": 0},
            # Step 31 — the choice-engine test-bed: executing these answers
            # CHOICES_PENDING (cost paid, marker written, effects withheld). Event 30
            # even carries an effect row that must NEVER run in Step 31; 31 is ONCE.
            {"id": 30, "uuid": "evt-step31-choices", "name": "Crossroads Trial",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "idTextName": 610, "idTextDescription": 610,
             # cost 2 keeps the "cost 1" robot lookup unambiguous (it means event 10).
             "costEnery": 2, "costCoin": 0, "flagEndTime": 0},
            {"id": 31, "uuid": "evt-step31-once", "name": "Sealed Gate",
             "idSpecificLocation": 1, "type": "ONCE", "idCard": 1,
             "idTextName": 611, "idTextDescription": 611,
             "costEnery": 1, "costCoin": 0, "flagEndTime": 0},
            # Step 32 — the resolution test-bed. Opening 32 costs 3 (unambiguous for the
            # robot lookup); resolving one of its options costs nothing at all.
            {"id": 32, "uuid": "evt-step32-resolve", "name": "The Fork",
             "idSpecificLocation": 1, "type": "NORMAL", "idCard": 1,
             "idTextName": 616, "idTextDescription": 616,
             "costEnery": 3, "costCoin": 0, "flagEndTime": 0},
            # The outcome event an option runs. It lives nowhere (no idSpecificLocation)
            # and costs 9: a consequence is never charged for, and the robot proves it.
            {"id": 33, "uuid": "evt-step32-outcome", "name": "Beyond The Fork",
             "idSpecificLocation": None, "type": "NORMAL", "idCard": 1,
             "idTextName": 617, "idTextDescription": 617,
             "costEnery": 9, "costCoin": 0, "flagEndTime": 0},
        ],
        # Step 31 — the options of the two choice-events above (top-level arrays keyed by
        # idChoices, the canonical shape shared with the SQL backends' seeds).
        "choices": [
            {"id": 10, "uuid": "ch-step31-plain", "idEvent": 30, "priority": 2,
             "idTextName": 612, "idTextDescription": 612, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND"},
            {"id": 11, "uuid": "ch-step31-gated", "idEvent": 30, "priority": 1,
             "idTextName": 613, "idTextDescription": 613, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND"},
            {"id": 12, "uuid": "ch-step31-or", "idEvent": 30, "priority": 3,
             "idTextName": 614, "idTextDescription": 614, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "OR"},
            {"id": 13, "uuid": "ch-step31-otherwise", "idEvent": 30, "priority": 4,
             "idTextName": 615, "idTextDescription": 615, "idCard": 1,
             "otherwiseFlag": 1, "isProgress": 0, "logicOperator": "AND", "limitDex": 99},
            {"id": 14, "uuid": "ch-step31-once-plain", "idEvent": 31, "priority": 1,
             "idTextName": 612, "idTextDescription": 612, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND"},
            {"id": 15, "uuid": "ch-step31-once-limit", "idEvent": 31, "priority": 2,
             "idTextName": 613, "idTextDescription": 613, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND", "limitDex": 99},
            # Step 32 — the three options of event 32, one per thing a resolution can do.
            # idTextNarrative is what Step 31 withholds and the resolution reveals.
            {"id": 20, "uuid": "ch-step32-progress", "idEvent": 32, "priority": 1,
             "idTextName": 618, "idTextDescription": 618, "idTextNarrative": 620,
             "idCard": 1, "otherwiseFlag": 0, "isProgress": 1, "logicOperator": "AND"},
            # Everything at once: a registry key, an item, a forced move, the weather, and
            # an event run inline — so one resolution exercises the whole vocabulary.
            {"id": 21, "uuid": "ch-step32-world", "idEvent": 32, "priority": 2,
             "idTextName": 619, "idTextDescription": 619, "idTextNarrative": 621,
             "idCard": 1, "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND",
             "idEventTorun": 33},
            # Impossible for anyone: proves select-choice re-checks the verdict.
            {"id": 22, "uuid": "ch-step32-locked", "idEvent": 32, "priority": 3,
             "idTextName": 613, "idTextDescription": 613, "idCard": 1,
             "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND", "limitDex": 99},
        ],
        "choiceConditions": [
            {"id": 2, "idChoices": 11, "type": "statistics", "key": "int", "value": "99", "operator": ">"},
            {"id": 3, "idChoices": 12, "type": "KEYS", "key": "STEP29_GATE", "value": "OPEN", "operator": "="},
            {"id": 4, "idChoices": 12, "type": "statistics", "key": "life", "value": "0", "operator": ">"},
        ],
        "choiceEffects": [
            {"id": 5, "idChoices": 10, "statistics": "energy", "value": 1},
            {"id": 6, "idChoices": 11, "statistics": "life", "value": 1},
            {"id": 7, "idChoices": 12, "statistics": "exp", "value": 2},
            {"id": 8, "idChoices": 14, "statistics": "energy", "value": 1},
            {"id": 9, "idChoices": 15, "statistics": "life", "value": 1},
            # Step 32 — what each option does when resolved.
            # idEvent is the EFFECT-level link ("Event to Run (effect)"), distinct from
            # the choice-level idEventTorun option 21 uses: both mechanisms are seeded.
            {"id": 20, "idChoices": 20, "idCard": 1, "statistics": "exp", "value": 5,
             "idEvent": 33},
            {"id": 21, "idChoices": 21, "idCard": 1, "key": "STEP32_GATE",
             "valueToAdd": "OPEN", "idItemTarget": 1, "itemAction": "ADD",
             "idLocation": 3, "idWeather": 3},
        ],
        # Step 29 — the EFFECT side. Each row's own idCard is the narrative the board shows.
        "eventEffects": [
            {"id": 1, "idEvent": 10, "idCard": 1, "statistics": "exp",  "value": 5,  "target": "ONLY_ONE"},
            {"id": 2, "idEvent": 10, "idCard": 1, "statistics": "life", "value": -2, "target": "ALL"},
            {"id": 3, "idEvent": 11, "idCard": 1, "statistics": "exp",  "value": 7,  "target": "ONLY_ONE"},
            {"id": 4, "idEvent": 18, "idCard": 1, "statistics": "exp",  "value": 1,  "target": "ONLY_ONE"},
            {"id": 5, "idEvent": 19, "idCard": 1, "statistics": "exp",  "value": 2,  "target": "ONLY_ONE"},
            # Unlocks event 14 (the registry gate).
            {"id": 6, "idEvent": 20, "idCard": 1, "target": "ONLY_ONE",
             "keyToAdd": "STEP29_GATE", "keyValueToAdd": "OPEN"},
            # Unlocks event 16. Here idWeather is an EFFECT — it SETS the match weather;
            # on the event above it is a CONDITION. Same name, opposite direction.
            {"id": 7, "idEvent": 21, "idCard": 1, "target": "ONLY_ONE", "idWeather": 3},
            {"id": 8, "idEvent": 22, "idCard": 1, "statistics": "energy", "value": -1, "target": "ONLY_ONE"},
            {"id": 9, "idEvent": 23, "idCard": 1, "target": "ONLY_ONE",
             "traitsToAdd": "1", "characteristicToAdd": "BRAVE"},
            # Unlocks event 24 (the item gate).
            {"id": 10, "idEvent": 25, "idCard": 1, "target": "ONLY_ONE",
             "idItemTarget": 1, "itemAction": "ADD"},
            # v0.34.0 — event 51 hands over the two consumables, 52 the heavy ingot.
            {"id": 50, "idEvent": 51, "idCard": 1, "target": "ONLY_ONE",
             "idItemTarget": 2, "itemAction": "ADD"},
            {"id": 51, "idEvent": 51, "idCard": 1, "target": "ONLY_ONE",
             "idItemTarget": 3, "itemAction": "ADD"},
            {"id": 52, "idEvent": 52, "idCard": 1, "target": "ONLY_ONE",
             "idItemTarget": 4, "itemAction": "ADD"},
            # Backpack resources: the three land on one event, and the untouched ones stay put.
            {"id": 11, "idEvent": 26, "idCard": 1, "statistics": "food",  "value": 3, "target": "ONLY_ONE"},
            {"id": 12, "idEvent": 26, "idCard": 1, "statistics": "magic", "value": 2, "target": "ONLY_ONE"},
            {"id": 13, "idEvent": 26, "idCard": 1, "statistics": "coin",  "value": 9, "target": "ONLY_ONE"},
            # Step 32 — the outcome event (33) an option runs: proves the linked chain
            # really applies, and that its own cost was never charged.
            # v0.33.2 — was id 20, which the Step 33 block below reused: a collision nothing
            # noticed while no effect row was ever addressed by its own identity.
            {"id": 16, "idEvent": 33, "idCard": 1, "statistics": "exp", "value": 7,
             "target": "ONLY_ONE"},
            # v0.29.3 — forced movement: sends the actor to the Hidden Grove (3), a location
            # with no neighbor edge at all — no checks, no movement cost, only the event's
            # own energy cost.
            {"id": 14, "idEvent": 28, "idCard": 1, "target": "ONLY_ONE", "idLocation": 3},
            # Step 31 — withheld on CHOICES_PENDING: must never apply while pending.
            {"id": 15, "idEvent": 30, "idCard": 1, "statistics": "exp", "value": 99, "target": "ONLY_ONE"},
            # Step 33 — one recognisable effect per trigger, so a Robot test can tell which
            # one fired. The counter-zero fuse writes a registry key and nothing else: it
            # must still change the world when it fires where nobody is standing.
            {"id": 20, "idEvent": 40, "idCard": 1, "statistics": "exp", "value": 11,
             "target": "ONLY_ONE", "keyToAdd": "STEP33_FIRST", "keyValueToAdd": "YES"},
            {"id": 21, "idEvent": 41, "idCard": 1, "statistics": "exp", "value": 12,
             "target": "ONLY_ONE", "keyToAdd": "STEP33_SUBSEQUENT", "keyValueToAdd": "YES"},
            {"id": 22, "idEvent": 42, "idCard": 1, "statistics": "exp", "value": 13,
             "target": "ONLY_ONE", "keyToAdd": "STEP33_ALONE", "keyValueToAdd": "YES"},
            {"id": 23, "idEvent": 43, "idCard": 1, "target": "ONLY_ONE",
             "keyToAdd": "STEP33_COUNTER", "keyValueToAdd": "YES"},
            {"id": 24, "idEvent": 44, "idCard": 1, "statistics": "exp", "value": 14,
             "target": "ONLY_ONE", "keyToAdd": "STEP33_STARTTIME", "keyValueToAdd": "YES"},
        ],
        # Steps 34 & 35 — the inventory test-bed. Until v0.34.0 the seed named items on the
        # event effects (idItemTarget) without ever declaring them, so nothing had a weight
        # and no card could be resolved. Item 1 is CARRIED ONLY (it gates event 24 and must
        # stay in the bag), item 2 is the consumable that gates event 50, item 3 is
        # restricted to class 1, item 4 is heavy enough to reach OVERWEIGHT.
        # v0.35.0 — flagShowEffects: item 4 keeps its secret (0) while still applying
        # LIFE +1, and item 2 leaves the field unset, which must read as "shown".
        # v0.35.1 — item 3 is capped at ONE (event 51 hands it over every time it runs, so a
        # second run has to be refused without failing the event) and a drop of item 2 puts
        # down TWO. The rest leave the columns unset: no cap, one unit per drop and use.
        "items": [
            {"id": 1, "uuid": "item-tut-sword",  "idCard": 1, "idTextName": 400,
             "idTextDescription": 400, "weight": 1, "isConsumabile": 0,
             "flagShowEffects": 1},
            {"id": 2, "uuid": "item-tut-scroll", "idCard": 1, "idTextName": 400,
             "idTextDescription": 400, "weight": 1, "isConsumabile": 1,
             "amountDrop": 2},
            {"id": 3, "uuid": "item-tut-tonic",  "idCard": 1, "idTextName": 400,
             "idTextDescription": 400, "weight": 1, "isConsumabile": 1,
             "idClassPermitted": 1, "flagShowEffects": 1, "maxPerCharacter": 1},
            {"id": 4, "uuid": "item-tut-ingot",  "idCard": 1, "idTextName": 400,
             "idTextDescription": 400, "weight": 9, "isConsumabile": 1,
             "flagShowEffects": 0},
        ],
        # SADNESS is the documented alias of the `sad` statistic; traitsToAdd is the same
        # CSV-of-ids format the event effects use.
        "itemEffects": [
            {"id": 1, "idCard": 1, "idItem": 2, "effectCode": "EXP", "effectValue": 5,
             # v0.35.2 — grants the HIDDEN trait: unpickable, but perfectly grantable.
             "traitsToAdd": "6"},
            {"id": 2, "idCard": 1, "idItem": 3, "effectCode": "SADNESS", "effectValue": 1},
            {"id": 3, "idCard": 1, "idItem": 4, "effectCode": "LIFE", "effectValue": 1},
        ],
        # Step 15 fields
        "characterTemplates": [
            {"uuid": "ct-tutorial-warrior", "id_tipo": 1, "lifeMax": 12, "energyMax": 12, "sadMax": 8,
             "dexterityStart": 3, "intelligenceStart": 3, "constitutionStart": 3,
             "idCard": None, "texts": {}, "idClassPermitted": None, "idClassProhibited": None},
            {"uuid": "ct-tutorial-mage",    "id_tipo": 2, "lifeMax": 10, "energyMax": 10, "sadMax": 6,
             "dexterityStart": 2, "intelligenceStart": 5, "constitutionStart": 2,
             "idCard": None, "texts": {}, "idClassPermitted": 2, "idClassProhibited": None},
            {"uuid": "ct-tutorial-rogue",   "id_tipo": 3, "lifeMax": 11, "energyMax": 14, "sadMax": 7,
             "dexterityStart": 5, "intelligenceStart": 2, "constitutionStart": 4,
             "idCard": None, "texts": {}, "idClassPermitted": None, "idClassProhibited": 1},
        ],
        "classes": [
            {"uuid": "cl-tutorial-warrior", "id": 1, "weightMax": 12, "dexterityBase": 3,
             "intelligenceBase": 3, "constitutionBase": 3, "idCard": None, "texts": {}},
            {"uuid": "cl-tutorial-mage",    "id": 2, "weightMax": 8,  "dexterityBase": 2,
             "intelligenceBase": 5, "constitutionBase": 2, "idCard": None, "texts": {}},
            {"uuid": "cl-tutorial-rogue",   "id": 3, "weightMax": 10, "dexterityBase": 5,
             "intelligenceBase": 2, "constitutionBase": 4, "idCard": None, "texts": {}},
        ],
        "classBonuses": [
            {"uuid": "cb-tut-1", "idClass": 1, "statistic": "life",   "value": 3},
            {"uuid": "cb-tut-2", "idClass": 1, "statistic": "energy", "value": 3},
            {"uuid": "cb-tut-3", "idClass": 2, "statistic": "int",    "value": 3},
            {"uuid": "cb-tut-4", "idClass": 3, "statistic": "dex",    "value": 3},
        ],
        # Step 27 — weather rules: a dominant "clear" weather (no energy delta) and
        # a rarer "storm" that drains energy. Probabilities make the roll
        # deterministic enough for the rng_seed=42 Robot checks.
        "weatherRules": [
            {"uuid": "we-tut-clear", "id": 1, "idTextName": 800, "idCard": 5, "probability": 70,
             "deltaEnergy": 0, "idEvent": None, "conditionKey": None,
             "conditionValue": None, "timeStart": None, "timeEnd": None, "isActive": 1,
             "costMoveSafeLocation": 0, "costMoveNotSafeLocation": 1},
            {"uuid": "we-tut-storm", "id": 2, "idTextName": 801, "idCard": 6, "probability": 30,
             "deltaEnergy": -2, "idEvent": None, "conditionKey": None,
             "conditionValue": None, "timeStart": None, "timeEnd": None, "isActive": 1,
             "costMoveSafeLocation": 1, "costMoveNotSafeLocation": 3},
            # Step 29 — inactive, so the roll at time-start can never land on it: an event
            # conditioned on this weather is blocked until an effect sets it, in every run.
            {"uuid": "we-tut-arcane", "id": 3, "idTextName": 801, "idCard": 6, "probability": 0,
             "deltaEnergy": 0, "idEvent": None, "conditionKey": None,
             "conditionValue": None, "timeStart": None, "timeEnd": None, "isActive": 0,
             "costMoveSafeLocation": 0, "costMoveNotSafeLocation": 0},
        ],
        # Step 23 — tr-tut-quick permitted only for class 2, tr-tut-resilient
        # prohibited for class 1, tr-tut-frail/tr-tut-weary are negative-cost;
        # tr-tut-brave stays unrestricted (robot loadout default)
        "traits": [
            {"uuid": "tr-tut-brave",  "id": 1, "costPositive": 1, "costNegative": 0,
             "idClassPermitted": None, "idClassProhibited": None,
             "life": 2, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 1, "weight": 0,
             "idCard": None, "texts": {}},
            {"uuid": "tr-tut-quick",  "id": 2, "costPositive": 1, "costNegative": 0,
             "idClassPermitted": 2, "idClassProhibited": None,
             "life": 0, "energy": 2, "sad": 0, "dexterity": 1,
             "intelligence": 0, "constitution": 0, "weight": 0,
             "idCard": None, "texts": {}},
            {"uuid": "tr-tut-resilient", "id": 3, "costPositive": 1, "costNegative": 0,
             "idClassPermitted": None, "idClassProhibited": 1,
             "life": 0, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 2, "constitution": 0, "weight": 1,
             "idCard": None, "texts": {}},
            {"uuid": "tr-tut-frail",  "id": 4, "costPositive": 0, "costNegative": 2,
             "idClassPermitted": None, "idClassProhibited": None,
             "life": -2, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 0, "weight": 0,
             "idCard": None, "texts": {}},
            {"uuid": "tr-tut-weary",  "id": 5, "costPositive": 0, "costNegative": 2,
             "idClassPermitted": None, "idClassProhibited": None,
             "life": 0, "energy": -2, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 0, "weight": 0,
             "idCard": None, "texts": {}},
            # v0.35.2 — the one trait nobody may choose: the scroll (item effect 1) hands it
            # over when used, and only then does it show in the player's trait list.
            {"uuid": "tr-tut-scroll-touched", "id": 6, "costPositive": 0, "costNegative": 0,
             "idClassPermitted": None, "idClassProhibited": None,
             "life": 0, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 1, "constitution": 0, "weight": 0,
             "hideOnStartMatch": 1, "idCard": None, "texts": {}},
        ],
        "card":               None,
        "class_count":        3,
        "template_count":     3,
        "trait_count":        5,
        # idCard points to raw_cards[0].id
        "idCard":             1,
        # Step 16: raw content data for content detail endpoints
        "raw_texts": [
            {"idText": 1, "lang": "en", "shortText": "TUTORIAL", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 1, "lang": "it", "shortText": "TUTORIAL", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # Step 27 — weather names
            {"idText": 800, "lang": "en", "shortText": "Clear Skies", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 800, "lang": "it", "shortText": "Cielo Sereno", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 801, "lang": "en", "shortText": "Storm", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 801, "lang": "it", "shortText": "Tempesta", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # Step 31 — choice-event and option texts (same 610-615 ids as the SQL seeds)
            {"idText": 610, "lang": "en", "shortText": "Crossroads Trial", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 610, "lang": "it", "shortText": "La Prova del Bivio", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 611, "lang": "en", "shortText": "Sealed Gate", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 611, "lang": "it", "shortText": "Il Cancello Sigillato", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 612, "lang": "en", "shortText": "Take the plain road", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 612, "lang": "it", "shortText": "Prendi la via semplice", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 613, "lang": "en", "shortText": "Recite the ancient runes", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 613, "lang": "it", "shortText": "Recita le rune antiche", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 614, "lang": "en", "shortText": "Bargain with the figure", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 614, "lang": "it", "shortText": "Contratta con la figura", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 615, "lang": "en", "shortText": "Shrug and improvise", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 615, "lang": "it", "shortText": "Alza le spalle e improvvisa", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 616, "lang": "en", "shortText": "The Fork", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 616, "lang": "it", "shortText": "Il Bivio", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 617, "lang": "en", "shortText": "Beyond The Fork", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 617, "lang": "it", "shortText": "Oltre Il Bivio", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 618, "lang": "en", "shortText": "Press on alone", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 618, "lang": "it", "shortText": "Prosegui da solo", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 619, "lang": "en", "shortText": "Follow the lantern", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 619, "lang": "it", "shortText": "Segui la lanterna", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # Step 32 — the narratives. Withheld while the options are pending, revealed
            # by the resolution: a robot case asserts exactly that.
            {"idText": 620, "lang": "en",
             "shortText": "You walk on, and the fork closes behind you.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 620, "lang": "it",
             "shortText": "Prosegui, e il bivio si chiude alle tue spalle.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 621, "lang": "en",
             "shortText": "The lantern leads you into the grove.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 621, "lang": "it",
             "shortText": "La lanterna ti conduce nel bosco.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 2, "lang": "en",
             "shortText": "A short training adventure in the Academy of Paths. "
                          "Learn movement, energy, items, choices, and missions "
                          "in a safe environment. Perfect for new players.",
             "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 2, "lang": "it",
             "shortText": "Una breve avventura di addestramento nell'Accademia di Paths. "
                          "Impara movimento, energia, oggetti, scelte e missioni "
                          "in un ambiente sicuro. Perfetta per i nuovi giocatori.",
             "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 3, "lang": "en", "shortText": "Tutorial", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 3, "lang": "it", "shortText": "Tutorial", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 100, "lang": "en", "shortText": "Welcome Hall", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 100, "lang": "it", "shortText": "Sala di Benvenuto", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # card texts
            {"idText": 201, "lang": "en", "shortText": "Academy of Paths", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 201, "lang": "it", "shortText": "Accademia di Paths", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 202, "lang": "en", "shortText": "Your training starts here.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 202, "lang": "it", "shortText": "Il tuo addestramento inizia qui.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # location card texts (idCard 2 = Welcome Hall, idCard 3 = Practice Yard)
            {"idText": 210, "lang": "en", "shortText": "Welcome Hall", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 210, "lang": "it", "shortText": "Sala di Benvenuto", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 211, "lang": "en", "shortText": "A bright entrance hall.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 211, "lang": "it", "shortText": "Un luminoso ingresso.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 212, "lang": "en", "shortText": "Practice Yard", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 212, "lang": "it", "shortText": "Cortile di Addestramento", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 213, "lang": "en", "shortText": "Where recruits train.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 213, "lang": "it", "shortText": "Dove si addestrano le reclute.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
        ],
        "raw_cards": [
            {
                "id":                1,
                "uuid":             "card-tutorial-001",
                "cardType":         "story",
                "idTextTitle":      201,
                "idTextDescription": 202,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         "https://paths.games/assets/cards/tutorial-academy.jpg",
                "alternativeImage": None,
                "awesomeIcon":      "fa-graduation-cap",
                "styleMain":        "card-tutorial",
                "styleDetail":      "card-tutorial-detail",
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            {
                "id":                2,
                "uuid":             "card-tutorial-loc-1",
                "cardType":         "location",
                "idTextTitle":      210,
                "idTextDescription": 211,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-door-open",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            {
                "id":                3,
                "uuid":             "card-tutorial-loc-2",
                "cardType":         "location",
                "idTextTitle":      212,
                "idTextDescription": 213,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-dumbbell",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            # Step 27 — weather cards (referenced by list_weather_rules.idCard)
            {
                "id":                5,
                "uuid":             "card-tutorial-weather-clear",
                "cardType":         "weather",
                "idTextTitle":      800,
                "idTextDescription": 800,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-sun",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            {
                "id":                6,
                "uuid":             "card-tutorial-weather-storm",
                "cardType":         "weather",
                "idTextTitle":      801,
                "idTextDescription": 801,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-cloud-bolt",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
        ],
        "raw_creators": [],
    },
    {
        "uuid":       "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "author":     "PathsMaster",
        "category":   "historical",
        "group":      "main",
        "visibility": "PUBLIC",
        "priority":   10,
        "peghi":      5,
        "versionMin": "0.14.0",
        "clockSingularDescription": "ora",
        "clockPluralDescription":   "ore",
        "linkCopyright": None,
        "texts": {
            "en": {
                "title":       "The Valvassor of the March",
                "description": "Travel across medieval Veneto to save your vassal from an "
                               "unjust death. Navigate feudal politics, gather evidence, "
                               "recruit allies, and face the Inquisition. Every hour counts.",
            },
            "it": {
                "title":       "Il Valvassore di Marca",
                "description": "Viaggia attraverso il Veneto medievale per salvare il tuo "
                               "vassallo da una morte ingiusta. Naviga la politica feudale, "
                               "raccogli prove, recluta alleati e affronta l'Inquisizione. "
                               "Ogni ora conta.",
            },
        },
        "difficulties": [
            {
                "uuid": "diff-valvassore-001",
                "texts": {
                    "en": {"title": "Merciful Judge"},
                    "it": {"title": "Giudice Misericordioso"},
                },
                "expCost": 3, "maxWeight": 20,
                "minCharacter": 1, "maxCharacter": 4,
                "costHelpComa": 2, "costMaxCharacteristics": 2,
                "numberMaxFreeAction": 3,
                "life": 130, "energy": 120, "sad": 0,
                "dexterity": 12, "intelligence": 12, "constitution": 14, "weight": 14,
            },
            {
                "uuid": "diff-valvassore-002",
                "texts": {
                    "en": {"title": "Just Trial"},
                    "it": {"title": "Giusto Processo"},
                },
                "expCost": 5, "maxWeight": 12,
                "minCharacter": 1, "maxCharacter": 4,
                "costHelpComa": 3, "costMaxCharacteristics": 3,
                "numberMaxFreeAction": 1,
                "life": 100, "energy": 100, "sad": 10,
                "dexterity": 10, "intelligence": 10, "constitution": 10, "weight": 10,
            },
            {
                "uuid": "diff-valvassore-003",
                "texts": {
                    "en": {"title": "Iron Inquisition"},
                    "it": {"title": "Inquisizione di Ferro"},
                },
                "expCost": 8, "maxWeight": 8,
                "minCharacter": 2, "maxCharacter": 3,
                "costHelpComa": 5, "costMaxCharacteristics": 5,
                "numberMaxFreeAction": 0,
                "life": 80, "energy": 90, "sad": 20,
                "dexterity": 8, "intelligence": 8, "constitution": 8, "weight": 8,
            },
        ],
        "difficulty_count": 3,
        "location_count":   12,
        "event_count":      5,
        "item_count":       5,
        # Step 19 — runtime seed data
        "idLocationStart":   1,
        "locations": [
            # Step 27.x — locations reference a real card via idCard; resolved from
            # raw_cards at seed time (see _seed_stories) so cards appear in the list.
            {"id": 1, "uuid": "loc-demo1-1", "name": "Crossroads", "counterTime": 0,
             "idCard": 1},
            {"id": 2, "uuid": "loc-demo1-2", "name": "Northern Path", "counterTime": 5,
             "idCard": 2},
            {"id": 3, "uuid": "loc-demo1-3", "name": "Southern Cave", "counterTime": 10,
             "idCard": 3},
        ],
        # Step 27.x — neighbor links: Crossroads connects to both paths
        "neighbors": [
            {"id": 1, "uuid": "nb-demo1-1", "idLocationFrom": 1, "idLocationTo": 2,
             "direction": "N", "flagBack": 1, "energyCost": 1, "idCard": None,
             "card": {"title": "Go North", "description": "Take the northern road.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-up"}},
            {"id": 2, "uuid": "nb-demo1-2", "idLocationFrom": 1, "idLocationTo": 3,
             "direction": "S", "flagBack": 1, "energyCost": 2, "idCard": None,
             "card": {"title": "Go South", "description": "Descend toward the cave.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-down"}},
        ],
        "keys": [
            {"id": 1, "uuid": "key-demo1-1", "keyName": "main_quest_started",
             "keyValue": "0", "keyGroup": "quest", "visibility": "PUBLIC", "priority": 1},
            {"id": 2, "uuid": "key-demo1-2", "keyName": "found_treasure",
             "keyValue": "0", "keyGroup": "quest", "visibility": "PUBLIC", "priority": 2},
            {"id": 3, "uuid": "key-demo1-3", "keyName": "ally_count",
             "keyValue": "0", "keyGroup": "quest", "visibility": "PUBLIC", "priority": 3},
        ],
        # Step 20.1 — events for end-game trigger; Step 27.x — idLocation + card
        "idEventEndGame":    77,
        "events": [
            {"id": 77, "uuid": "evt-valvassore-end", "name": "Final Confrontation",
             "idLocation": None, "type": "END_GAME", "idCard": None},
            {"id": 1,  "uuid": "evt-valvassore-1",   "name": "Lord's Summons",
             "idLocation": 1, "type": "NORMAL", "idCard": None,
             "card": {"title": "Lord's Summons", "description": "A messenger calls for you.",
                      "urlImage": None, "awesomeIcon": "fas fa-scroll"}},
        ],
        # Step 15 fields
        "characterTemplates": [
            {"uuid": "ct-demo1-knight", "id_tipo": 1, "lifeMax": 12, "energyMax": 10, "sadMax": 8,
             "dexterityStart": 3, "intelligenceStart": 3, "constitutionStart": 4,
             "idCard": None, "texts": {}, "idClassPermitted": None, "idClassProhibited": None},
            {"uuid": "ct-demo1-bard",   "id_tipo": 2, "lifeMax": 8,  "energyMax": 8,  "sadMax": 6,
             "dexterityStart": 1, "intelligenceStart": 5, "constitutionStart": 2,
             "idCard": None, "texts": {}, "idClassPermitted": 2, "idClassProhibited": None},
            {"uuid": "ct-demo1-scout",  "id_tipo": 3, "lifeMax": 14, "energyMax": 12, "sadMax": 10,
             "dexterityStart": 4, "intelligenceStart": 1, "constitutionStart": 5,
             "idCard": None, "texts": {}, "idClassPermitted": None, "idClassProhibited": 1},
        ],
        "classes": [
            {"uuid": "cl-demo1-knight", "id": 1, "weightMax": 14, "dexterityBase": 3,
             "intelligenceBase": 2, "constitutionBase": 4, "idCard": None, "texts": {}},
            {"uuid": "cl-demo1-bard",   "id": 2, "weightMax": 8,  "dexterityBase": 2,
             "intelligenceBase": 5, "constitutionBase": 2, "idCard": None, "texts": {}},
        ],
        "classBonuses": [
            {"uuid": "cb-d1-1", "idClass": 1, "statistic": "life",   "value": 4},
            {"uuid": "cb-d1-2", "idClass": 2, "statistic": "energy", "value": 3},
        ],
        "traits": [
            {"uuid": "tr-d1-bold", "id": 1, "costPositive": 3, "costNegative": 0,
             "idClassPermitted": None, "idClassProhibited": None,
             "life": 3, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 2, "weight": 0,
             "idCard": None, "texts": {}},
        ],
        "card":               None,
        "class_count":        2,
        "template_count":     3,
        "trait_count":        1,
        # Step 16: raw content data for content detail endpoints
        "raw_texts": [
            {"idText": 1, "lang": "en", "shortText": "The Valvassor of the March", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 1, "lang": "it", "shortText": "Il Valvassore di Marca", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 2, "lang": "en",
             "shortText": "Travel across medieval Veneto to save your vassal from an "
                          "unjust death. Navigate feudal politics, gather evidence, "
                          "recruit allies, and face the Inquisition. Every hour counts.",
             "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 2, "lang": "it",
             "shortText": "Viaggia attraverso il Veneto medievale per salvare il tuo "
                          "vassallo da una morte ingiusta. Naviga la politica feudale, "
                          "raccogli prove, recluta alleati e affronta l'Inquisizione. "
                          "Ogni ora conta.",
             "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            # location card texts (idCard 1/2/3)
            {"idText": 310, "lang": "en", "shortText": "Crossroads", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 310, "lang": "it", "shortText": "Crocevia", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 311, "lang": "en", "shortText": "Three paths meet here.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 311, "lang": "it", "shortText": "Qui si incontrano tre sentieri.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 312, "lang": "en", "shortText": "Northern Path", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 312, "lang": "it", "shortText": "Sentiero Nord", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 313, "lang": "en", "shortText": "A road heading north.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 313, "lang": "it", "shortText": "Una strada verso nord.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 314, "lang": "en", "shortText": "Southern Cave", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 314, "lang": "it", "shortText": "Caverna Sud", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 315, "lang": "en", "shortText": "A dark cavern mouth.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
            {"idText": 315, "lang": "it", "shortText": "L'imbocco di una caverna buia.", "longText": None,
             "idTextCopyright": None, "linkCopyright": None, "idCreator": None},
        ],
        "raw_cards":    [
            {
                "id":                1,
                "uuid":             "card-demo1-loc-1",
                "cardType":         "location",
                "idTextTitle":      310,
                "idTextDescription": 311,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-signs-post",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            {
                "id":                2,
                "uuid":             "card-demo1-loc-2",
                "cardType":         "location",
                "idTextTitle":      312,
                "idTextDescription": 313,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-road",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
            {
                "id":                3,
                "uuid":             "card-demo1-loc-3",
                "cardType":         "location",
                "idTextTitle":      314,
                "idTextDescription": 315,
                "idTextCopyright":  None,
                "linkCopyright":    None,
                "idCreator":        None,
                "urlImage":         None,
                "alternativeImage": None,
                "awesomeIcon":      "fas fa-mountain",
                "styleMain":        None,
                "styleDetail":      None,
                "styleImageLittle": None,
                "styleImageMedium": None,
                "styleImageLarge":  None,
            },
        ],
        "raw_creators": [],
    },
]


def _enrich_locations_with_cards(locations, raw_cards, raw_texts):
    """Resolve each location's card from its idCard against raw_cards, so the
    stored item carries both idCard and the resolved card — exactly like an
    imported story. Locations no longer hold orphan inline card literals."""
    enriched = []
    for loc in locations:
        loc = dict(loc)
        loc["card"] = _resolve_card_from_raw(raw_cards, raw_texts, loc.get("idCard"))
        enriched.append(loc)
    return enriched


def _ensure_effect_uuids(effects, prefix):
    """Give every effect row a stable uuid, derived from its id.

    An effect row is addressed by uuid on the way OUT: every AppliedEffect the engine
    reports — from execute-event, from a resolved choice, from an automatic event —
    carries `effectUuid`, read straight off the row. The SQL backends get that uuid from
    a column; here the seed IS the schema, and no row ever declared one, so every
    AppliedEffect AWS has ever returned named a null effect.

    Derived from the id rather than random so a reseed does not rename rows that
    already travelled to a client.
    """
    out = []
    for effect in effects:
        effect = dict(effect)
        if not effect.get("uuid"):
            effect["uuid"] = f"{prefix}-{effect.get('id')}"
        out.append(effect)
    return out


def _seed_stories():
    """Insert / replace the seed stories into DynamoDB."""
    seeded = []
    for s in SEED_STORIES:
        story_uuid = s["uuid"]
        # Delete existing story data first (idempotent)
        db_utils.delete_all_by_pk(f"STORY#{story_uuid}")

        story_item = {
            "PK":                       f"STORY#{story_uuid}",
            "SK":                       "METADATA",
            "uuid":                     story_uuid,
            "author":                   s["author"],
            "category":                 s["category"],
            "group":                    s["group"],
            "visibility":               s["visibility"],
            "priority":                 s["priority"],
            "peghi":                    s["peghi"],
            "versionMin":               s.get("versionMin"),
            "versionMax":               s.get("versionMax"),
            "clockSingularDescription": s.get("clockSingularDescription"),
            "clockPluralDescription":   s.get("clockPluralDescription"),
            "linkCopyright":            s.get("linkCopyright"),
            "texts":                    s["texts"],
            "difficulties":             s["difficulties"],
            "difficulty_count":         s["difficulty_count"],
            "location_count":           s["location_count"],
            "event_count":              s["event_count"],
            "item_count":               s["item_count"],
            # Step 19 — runtime data used by POST /api/matches
            "idLocationStart":          s.get("idLocationStart"),
            # Step 27.x — resolve each location's card from idCard against raw_cards
            # so locationsActive returns idCard + a card that exists in the card list.
            "locations":                _enrich_locations_with_cards(
                                            s.get("locations", []),
                                            s.get("raw_cards", []),
                                            s.get("raw_texts", [])),
            # Step 27.x — neighbor links used to enrich GET /api/match/{uuid}/info.
            # Step 0.28.2 — also store them under `locationNeighbors` (the admin-CRUD
            # field): gameplay reads locationNeighbors-first and the admin API lists/edits
            # this same array, so seeded neighbors are both playable AND admin-editable.
            "neighbors":                s.get("neighbors", []),
            "locationNeighbors":        s.get("neighbors", []),
            "keys":                     s.get("keys", []),
            # Step 20.1 — end-game event trigger (read by PATCH /api/match/{uuid}/end/{uuid_event})
            "idEventEndGame":           s.get("idEventEndGame"),
            "events":                   s.get("events", []),
            # Step 29 — the effect side of an event (the event side lives in "events").
            # v0.33.2 — each row gets its uuid here, so every AppliedEffect can name it.
            "eventEffects":             _ensure_effect_uuids(
                                            s.get("eventEffects", []), f"eff-{story_uuid}"),
            # Steps 34 & 35 — the inventory engine reads these off the story item. Without
            # them every carried row resolves to no story item: weight 0, a null
            # isConsumabile, and use-item refusing everything as ITEM_NOT_FOUND.
            "items":                    s.get("items", []),
            "itemEffects":              _ensure_effect_uuids(
                                            s.get("itemEffects", []), f"ieff-{story_uuid}"),
            # Step 31 — the choice engine reads these off the story item.
            "choices":                  s.get("choices", []),
            "choiceConditions":         s.get("choiceConditions", []),
            "choiceEffects":            _ensure_effect_uuids(
                                            s.get("choiceEffects", []), f"cheff-{story_uuid}"),
            # Step 15 fields
            "characterTemplates":       s.get("characterTemplates", []),
            "classes":                  s.get("classes", []),
            "classBonuses":             s.get("classBonuses", []),
            # Step 27 — weather rules embedded on the story item.
            "weatherRules":             s.get("weatherRules", []),
            "traits":                   s.get("traits", []),
            "card":                     s.get("card"),
            "idCard":                   s.get("idCard"),
            "class_count":              s.get("class_count", 0),
            "template_count":           s.get("template_count", 0),
            "trait_count":              s.get("trait_count", 0),
            # Step 16: raw content data for content detail queries
            "raw_texts":                s.get("raw_texts", []),
            "raw_cards":                s.get("raw_cards", []),
            "raw_creators":             s.get("raw_creators", []),
            # GSI for story listing
            "GSI1_PK":                  "STORY_LIST",
            "GSI1_SK":                  f"STORY#{story_uuid}",
        }
        db_utils.put_item(story_item)
        seeded.append({"uuid": story_uuid, "title": s["texts"]["en"]["title"]})
    return seeded

# ─── test-data cleanup ───────────────────────────────────────────────────────

def _handle_cleanup():
    """POST /api/dev/cleanup — removes the data created by automated (Robot
    Framework) test runs: guests whose username starts with the ``robottest``
    marker, matches whose name starts with it, and the seed stories inserted by
    ``_seed_stories`` (the same SEED_STORIES list). Every other item is kept.

    Everything is removed by PARTITION, never row by row. A match is not one item: its
    ``CHARACTER#…`` rows live under the same PK, and deleting only ``METADATA`` — as this
    did until v0.34.0 — left them orphaned under a partition whose name was gone, so no
    later run could recognise them either. The residue that fix cannot reach is reported
    as ``orphanMatches``; ``code/scripts/dev/aws/purge_robot_test_data.py --orphans``
    sweeps it.
    """
    deleted_guests = 0
    for user in db_utils.scan_filter("is_guest", True):
        if str(user.get("username", "")).startswith(ROBOT_TEST_MARKER):
            db_utils.delete_all_by_pk(user["PK"])
            deleted_guests += 1

    # One pass over the MATCH# space: the scan returns EVERY row of every match, so the
    # partitions are collected first and deleted once each. Only the METADATA row carries
    # the name — the character rows come along because the partition goes, not because
    # they match a rule.
    robot_match_pks, match_pks, match_pks_with_metadata = [], set(), set()
    for row in db_utils.scan_pk_prefix("MATCH#"):
        pk = row.get("PK")
        match_pks.add(pk)
        if str(row.get("SK") or "") == "METADATA":
            match_pks_with_metadata.add(pk)
            if str(row.get("name") or "").startswith(ROBOT_TEST_MARKER):
                robot_match_pks.append(pk)

    deleted_matches = 0
    for pk in robot_match_pks:
        db_utils.delete_all_by_pk(pk)
        deleted_matches += 1

    # A partition with no METADATA row cannot be identified: its name is in the row that
    # is already gone. Counted, never deleted — this endpoint runs unattended after every
    # test run, and deleting what it cannot identify is not a thing to do unattended.
    orphan_matches = len(match_pks - match_pks_with_metadata)

    # Remove the seed stories (cascading delete of every item under STORY#{uuid}).
    deleted_stories = 0
    for s in SEED_STORIES:
        if db_utils.delete_all_by_pk(f"STORY#{s['uuid']}") > 0:
            deleted_stories += 1

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({
            "deletedGuests":  deleted_guests,
            "deletedMatches": deleted_matches,
            "deletedStories": deleted_stories,
            # Left behind on purpose; see above.
            "orphanMatches":  orphan_matches,
        })
    }


# ─── handler ─────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    env = os.environ.get("ENV", "dev")
    if env not in ("dev", "test"):
        return {
            "statusCode": 403,
            "headers": HEADERS,
            "body": json.dumps({
                "error":   "FORBIDDEN",
                "message": "Dev endpoints are only available in the dev environment"
            })
        }

    # This function serves both dev-only endpoints: /api/dev/seed (default)
    # and /api/dev/cleanup.
    raw_path = event.get("rawPath") or event.get("path") or ""
    if raw_path.rstrip("/").endswith("/api/dev/cleanup"):
        return _handle_cleanup()

    now = int(time.time() * 1000)
    inserted = []

    # ── Seed users ───
    for u in SEED_USERS:
        uid = u["uuid"]
        item = {
            # ── DynamoDB keys ──
            "PK":  f"USER#{uid}",
            "SK":  "METADATA",
            # ── GSI: allows listing all non-guest users ──
            "GSI1_PK": "USER_LIST",
            "GSI1_SK": f"ROLE#{u['role']}#{u['username']}",
            # ── user fields ──
            "uuid":          uid,
            "username":      u["username"],
            "email":         u["email"],
            "password_hash": BCRYPT_HASH,
            "role":          u["role"],
            "state":         u["state"],
            "nickname":      u["nickname"],
            "language":      u["language"],
            "is_guest":      False,
            "ts_registration": now,
            "ts_last_access":  now,
        }
        db_utils.put_item(item)
        if jwt_utils.ALLOW_MOCK_ACCESS:
            access_token = f"MOCK_ACCESS_{uid}"
        else:
            access_token = jwt_utils.generate_access_token(uid, u["username"], u["role"])

        inserted.append({
            "uuid":        uid,
            "username":    u["username"],
            "role":        u["role"],
            "accessToken": access_token,
        })

    # ── Seed stories ───
    seeded_stories = _seed_stories()

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({
            "status":   "SEEDED",
            "inserted": inserted,
            "stories":  seeded_stories,
            "note":     "Use the accessToken value as: Authorization: Bearer <accessToken>"
        })
    }
