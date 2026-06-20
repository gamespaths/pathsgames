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

# ─── constants ────────────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

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
            {"id": 1, "uuid": "loc-tutorial-1", "name": "Welcome Hall", "counterStart": 0,
             "secureParam": 1, "idEventIfCounterZero": None, "idCard": None,
             "card": {"title": "Welcome Hall", "description": "A bright entrance hall.",
                      "urlImage": None, "awesomeIcon": "fas fa-door-open"}},
            {"id": 2, "uuid": "loc-tutorial-2", "name": "Practice Yard", "counterStart": 2,
             "secureParam": 0, "idEventIfCounterZero": 1, "idCard": None,
             "card": {"title": "Practice Yard", "description": "Where recruits train.",
                      "urlImage": None, "awesomeIcon": "fas fa-dumbbell"}},
        ],
        # Step 27.x — neighbor links between locations (bidirectional 1<->2)
        "neighbors": [
            {"id": 1, "uuid": "nb-tutorial-1", "idLocationFrom": 1, "idLocationTo": 2,
             "direction": "N", "flagBack": 1, "energyCost": 1, "idCard": None,
             "card": {"title": "To the Practice Yard", "description": "A short walk north.",
                      "urlImage": None, "awesomeIcon": "fas fa-arrow-up"}},
        ],
        "keys": [
            {"id": 1, "uuid": "key-tutorial-1", "keyName": "tutorial_intro_done", "keyValue": "0"},
            {"id": 2, "uuid": "key-tutorial-2", "keyName": "training_completed", "keyValue": "no"},
        ],
        # Step 20.1 — events for end-game trigger; Step 27.x — idLocation + card
        "idEventEndGame":    99,
        "events": [
            {"id": 99, "uuid": "evt-tutorial-end", "name": "Tutorial Complete",
             "idLocation": None, "type": "END_GAME", "idCard": None},
            {"id": 1,  "uuid": "evt-tutorial-1",   "name": "Intro Greeting",
             "idLocation": 1, "type": "NORMAL", "idCard": None,
             "card": {"title": "Intro Greeting", "description": "A guard greets you.",
                      "urlImage": None, "awesomeIcon": "fas fa-comment"}},
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
            {"id": 1, "uuid": "loc-demo1-1", "name": "Crossroads", "counterStart": 0,
             "idCard": None,
             "card": {"title": "Crossroads", "description": "Three paths meet here.",
                      "urlImage": None, "awesomeIcon": "fas fa-signs-post"}},
            {"id": 2, "uuid": "loc-demo1-2", "name": "Northern Path", "counterStart": 5,
             "idCard": None,
             "card": {"title": "Northern Path", "description": "A road heading north.",
                      "urlImage": None, "awesomeIcon": "fas fa-road"}},
            {"id": 3, "uuid": "loc-demo1-3", "name": "Southern Cave", "counterStart": 10,
             "idCard": None,
             "card": {"title": "Southern Cave", "description": "A dark cavern mouth.",
                      "urlImage": None, "awesomeIcon": "fas fa-mountain"}},
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
            {"id": 1, "uuid": "key-demo1-1", "keyName": "main_quest_started", "keyValue": "0"},
            {"id": 2, "uuid": "key-demo1-2", "keyName": "found_treasure", "keyValue": "no"},
            {"id": 3, "uuid": "key-demo1-3", "keyName": "ally_count", "keyValue": "0"},
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
        ],
        "raw_cards":    [],
        "raw_creators": [],
    },
]


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
            "locations":                s.get("locations", []),
            # Step 27.x — neighbor links used to enrich GET /api/match/{uuid}/info
            "neighbors":                s.get("neighbors", []),
            "keys":                     s.get("keys", []),
            # Step 20.1 — end-game event trigger (read by PATCH /api/match/{uuid}/end/{uuid_event})
            "idEventEndGame":           s.get("idEventEndGame"),
            "events":                   s.get("events", []),
            # Step 15 fields
            "characterTemplates":       s.get("characterTemplates", []),
            "classes":                  s.get("classes", []),
            "classBonuses":             s.get("classBonuses", []),
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
    """
    deleted_guests = 0
    for user in db_utils.scan_filter("is_guest", True):
        if str(user.get("username", "")).startswith(ROBOT_TEST_MARKER):
            db_utils.delete_item(user["PK"], user.get("SK", "METADATA"))
            deleted_guests += 1

    deleted_matches = 0
    for match in db_utils.scan_pk_prefix("MATCH#"):
        if str(match.get("name") or "").startswith(ROBOT_TEST_MARKER):
            db_utils.delete_item(match["PK"], match.get("SK", "METADATA"))
            deleted_matches += 1

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
