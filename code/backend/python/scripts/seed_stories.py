import sys
import os
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

# Add app to path (script is run from inside code/backend/python)
sys.path.insert(0, os.getcwd())

from app.adapters.persistence.database import SessionLocal, init_db
from app.adapters.persistence.story.story_persistence_adapter import StoryPersistenceAdapter
from app.core.services.story.story_import_service import StoryImportService

def seed():
    print("Seeding Tutorial and Demo 1 stories...")
    # Relative to this script, the app is in code/backend/python
    # But when running from workspace root, we need to make sure it imports correctly
    
    init_db()
    
    persistence = StoryPersistenceAdapter(SessionLocal)
    import_service = StoryImportService(persistence)
    
    # Story 1: Tutorial
    tutorial_data = {
        "uuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "author": "PathsMaster",
        "category": "tutorial",
        "group": "tutorial",
        "visibility": "PUBLIC",
        "priority": 100,
        "peghi": 0,
        "versionMin": "0.14.0",
        "idTextTitle": 1,
        "idTextDescription": 2,
        "idTextClockSingular": 10,
        "idTextClockPlural": 11,
        "idCard": 1,
        # Step 27.x / 0.25.4 — start location + end-game event so GET
        # /api/match/{uuid}/info exposes a populated locationsActive (with endGame).
        "idLocationStart": 1,
        "idEventEndGame": 1,
        "texts": [
            {"idText": 1, "lang": "en", "shortText": "TUTORIAL"},
            {"idText": 1, "lang": "it", "shortText": "TUTORIAL"},
            {"idText": 10, "lang": "en", "shortText": "turn"},
            {"idText": 10, "lang": "it", "shortText": "turno"},
            {"idText": 11, "lang": "en", "shortText": "turns"},
            {"idText": 11, "lang": "it", "shortText": "turni"},
            {"idText": 2, "lang": "en", "shortText": "A short training adventure."},
            {"idText": 2, "lang": "it", "shortText": "Una breve avventura di addestramento."},
            {"idText": 100, "lang": "en", "shortText": "Welcome Hall"},
            {"idText": 100, "lang": "it", "shortText": "Sala di Benvenuto"},
            {"idText": 200, "lang": "en", "shortText": "Warrior"},
            {"idText": 200, "lang": "it", "shortText": "Guerriero"},
            {"idText": 201, "lang": "en", "shortText": "Academy of Paths"},
            {"idText": 201, "lang": "it", "shortText": "Accademia di Paths"},
            {"idText": 202, "lang": "en", "shortText": "Your training starts here."},
            {"idText": 202, "lang": "it", "shortText": "Il tuo addestramento inizia qui."},
            {"idText": 210, "lang": "en", "shortText": "Fighter"},
            {"idText": 210, "lang": "it", "shortText": "Combattente"},
            {"idText": 300, "lang": "en", "shortText": "Tutorial"},
            {"idText": 300, "lang": "it", "shortText": "Tutorial"},
            {"idText": 400, "lang": "en", "shortText": "Wooden Sword"},
            {"idText": 400, "lang": "it", "shortText": "Spada di Legno"},
            {"idText": 500, "lang": "en", "shortText": "Welcome Event"},
            {"idText": 500, "lang": "it", "shortText": "Evento di Benvenuto"},
            {"idText": 700, "lang": "en", "shortText": "Brave"},
            {"idText": 700, "lang": "it", "shortText": "Coraggioso"}
        ],
        "difficulties": [
            {"uuid": "tut-diff-1", "idTextDescription": 300, "expCost": 1, "maxWeight": 20,
             "life": 120, "energy": 110, "sad": 0, "dexterity": 12, "intelligence": 12, "constitution": 12, "weight": 12,
             # Step 23 — trait cost budgets (None/missing = no limit)
             "traitCostPositiveBudget": 2, "traitCostNegativeBudget": 3}
        ],
        "locations": [
            # Step 26: safe location (isSafe=1 -> secure recovery) carrying a time
            # counter so the location-counter decrement/zero path is exercised.
            # Step 28: neighbor edge (cost 2) to location 2 so movement is testable.
            {"id": 1, "idTextName": 100, "idTextDescription": 100, "isSafe": 1,
             "idCard": 1, "counterTime": 2, "idEventIfCounterZero": 1,
             "neighbors": [{"idLocationTo": 2, "direction": "NORTH", "energyCost": 2,
                            "idCardBack": 1}]},
            # Step 28: a second location to move into.
            # Step 0.28.5: both locations carry idCard so GET /locations resolves
            # a full `card` for each location and neighbor (as Java/AWS seeds do).
            {"id": 2, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1}
        ],
        "events": [
            {"id": 1, "idTextName": 500, "idTextDescription": 500, "type": "FIRST",
             "idSpecificLocation": 1},
            # Step 29 — one event per branch of the check procedure, all bound to the start
            # location (1) so a fresh match already offers them, plus the "unlocker" that makes
            # each blocked one available. Effects carry their own idCard: that card is the
            # narrative the board renders.
            {"id": 10, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "costEnery": 1, "idCard": 1,
             "effects": [
                 {"idCard": 1, "statistics": "exp",  "value": 5,  "target": "ONLY_ONE"},
                 {"idCard": 1, "statistics": "life", "value": -2, "target": "ALL"},
             ]},
            {"id": 11, "idTextName": 500, "idTextDescription": 500, "type": "ONCE",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 7, "target": "ONLY_ONE"}]},
            # NOT_ENOUGH_ENERGY / NOT_ENOUGH_COINS
            {"id": 12, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "costEnery": 999, "idCard": 1},
            {"id": 13, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "coinCost": 999, "idCard": 1},
            # REGISTRY_CONDITION_NOT_MET, until event 20 writes the key
            {"id": 14, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "registryKeyCondition": "STEP29_GATE", "registryValueCondition": "OPEN"},
            # ITEM_CONDITION_NOT_MET, until event 21 grants item 1
            {"id": 15, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1, "idItemCondition": 1},
            # WEATHER_CONDITION_NOT_MET, until event 22 sets weather 3 (the inactive rule, so
            # the roll at time-start can never hand it to us for free)
            {"id": 17, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1, "idWeather": 3},
            # WRONG_LOCATION: bound to the other location
            {"id": 18, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 2, "idCard": 1},
            # The chain: 19 charges, then runs 23. 23 has no location, so it is not listed.
            {"id": 19, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1, "idEventNext": 23,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 1, "target": "ONLY_ONE"}]},
            {"id": 23, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": None, "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 2, "target": "ONLY_ONE"}]},
            # The unlockers: registry key, item, weather.
            {"id": 20, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE",
                          "keyToAdd": "STEP29_GATE", "keyValueToAdd": "OPEN"}]},
            {"id": 21, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE",
                          "idItemTarget": 1, "itemAction": "ADD"}]},
            # Here idWeather is an EFFECT — it SETS the weather; on event 17 it is a CONDITION.
            {"id": 22, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE", "idWeather": 3}]},
            # flagEndTime advances the clock for everyone.
            {"id": 24, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1, "flagEndTime": 1,
             "effects": [{"idCard": 1, "statistics": "energy", "value": -1,
                          "target": "ONLY_ONE"}]},
            # Traits + characteristics, then the backpack resources.
            {"id": 25, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE", "traitsToAdd": "1",
                          "traitsToRemove": "2", "characteristicToAdd": "BRAVE"}]},
            {"id": 26, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [
                 {"idCard": 1, "statistics": "food",  "value": 3, "target": "ONLY_ONE"},
                 {"idCard": 1, "statistics": "magic", "value": 2, "target": "ONLY_ONE"},
                 {"idCard": 1, "statistics": "coin",  "value": 9, "target": "ONLY_ONE"},
             ]},
            # EVENT_NOT_EXECUTABLE_TYPE: listed, never player-triggered.
            {"id": 27, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idSpecificLocation": 1, "idCard": 1},
        ],
        "items": [
            {"idTextName": 400, "idTextDescription": 400, "weight": 1}
        ],
        "classes": [
            {
                "idTextName": 200, "idTextDescription": 200,
                "bonuses": [
                    {"statistic": "life",   "value": 3},
                    {"statistic": "energy", "value": 2},
                ],
            }
        ],
        "traits": [
            {"idTextName": 700, "idTextDescription": 700, "costPositive": 1, "costNegative": 0,
             "life": 2, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 1, "weight": 0},
            # Step 23 — negative-cost trait
            {"idTextName": 700, "idTextDescription": 700, "costPositive": 0, "costNegative": 2,
             "life": -2, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 0, "constitution": 0, "weight": 0}
        ],
        "characterTemplates": [
            {"idTipo": 90001, "idTextName": 210, "idTextDescription": 210,
             "idClassPermitted": None, "idClassProhibited": None}
        ],
        # Step 27 — weather rules: a dominant "clear" weather (no energy delta) and
        # a rarer "storm" that drains energy. With rngSeed=42 the roll is deterministic.
        "weatherRules": [
            {"idTextName": 200, "idCard": 5, "probability": 70, "deltaEnergy": 0, "idEvent": None,
             "costMoveSafeLocation": 0, "costMoveNotSafeLocation": 1,
             "conditionKey": None, "conditionValue": None, "timeStart": None,
             "timeEnd": None, "isActive": 1},
            {"idTextName": 201, "idCard": 6, "probability": 30, "deltaEnergy": -2, "idEvent": None,
             "costMoveSafeLocation": 1, "costMoveNotSafeLocation": 3,
             "conditionKey": None, "conditionValue": None, "timeStart": None,
             "timeEnd": None, "isActive": 1},
            # Step 29 — inactive, so the roll at time-start can never land on it: the event
            # conditioned on this weather is blocked until an effect sets it, in every run.
            {"idTextName": 201, "idCard": 6, "probability": 0, "deltaEnergy": 0, "idEvent": None,
             "costMoveSafeLocation": 0, "costMoveNotSafeLocation": 0,
             "conditionKey": None, "conditionValue": None, "timeStart": None,
             "timeEnd": None, "isActive": 0},
        ],
        "cards": [
            {
                "id": 1,
                "uuid": "card-tutorial-001",
                "idTextTitle": 201,
                "idTextDescription": 202,
                "urlImage": "https://paths.games/assets/cards/tutorial-academy.jpg",
                "awesomeIcon": "fa-graduation-cap",
                "styleMain": "card-tutorial",
                "styleDetail": "card-tutorial-detail"
            },
            # Step 27 — weather cards (referenced by weatherRules.idCard)
            {"id": 5, "uuid": "card-tutorial-weather-clear", "idTextTitle": 200,
             "idTextDescription": 200, "awesomeIcon": "fa-sun", "styleMain": "card-weather"},
            {"id": 6, "uuid": "card-tutorial-weather-storm", "idTextTitle": 201,
             "idTextDescription": 201, "awesomeIcon": "fa-cloud-bolt", "styleMain": "card-weather"},
        ]
    }
    
    # Story 2: Demo 1
    demo1_data = {
        "uuid": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "author": "PathsMaster",
        "category": "fantasy",
        "group": "main",
        "visibility": "PUBLIC",
        "priority": 10,
        "peghi": 5,
        "versionMin": "0.14.0",
        "idTextTitle": 1,
        "idTextDescription": 2,
        "idTextClockSingular": 10,
        "idTextClockPlural": 11,
        "texts": [
            {"idText": 1, "lang": "en", "shortText": "The Valvassor of the March"},
            {"idText": 1, "lang": "it", "shortText": "Il Valvassore di Marca"},
            {"idText": 2, "lang": "en", "shortText": "Travel across medieval Veneto."},
            {"idText": 2, "lang": "it", "shortText": "Viaggia attraverso il Veneto medievale."},
            {"idText": 10, "lang": "en", "shortText": "hour"},
            {"idText": 10, "lang": "it", "shortText": "ora"},
            {"idText": 11, "lang": "en", "shortText": "hours"},
            {"idText": 11, "lang": "it", "shortText": "ore"},
            {"idText": 300, "lang": "en", "shortText": "Merciful Judge"},
            {"idText": 301, "lang": "en", "shortText": "Just Trial"},
            {"idText": 302, "lang": "en", "shortText": "Iron Inquisition"}
        ],
        "difficulties": [
            {"uuid": "demo2-diff-1", "idTextDescription": 300, "expCost": 3, "maxWeight": 20,
             "life": 130, "energy": 120, "sad": 0, "dexterity": 12, "intelligence": 12, "constitution": 14, "weight": 14},
            {"uuid": "demo2-diff-2", "idTextDescription": 301, "expCost": 5, "maxWeight": 12,
             "life": 100, "energy": 100, "sad": 10, "dexterity": 10, "intelligence": 10, "constitution": 10, "weight": 10},
            {"uuid": "demo2-diff-3", "idTextDescription": 302, "expCost": 8, "maxWeight": 8,
             "life": 80,  "energy": 90,  "sad": 20, "dexterity": 8,  "intelligence": 8,  "constitution": 8,  "weight": 8}
        ],
        "locations": [],
        "events": [],
        "items": [],
        "classes": [
            {
                "idTextName": 200, "idTextDescription": 200,
                "bonuses": [
                    {"statistic": "dex", "value": 2},
                ],
            }
        ],
        "traits": [],
        "characterTemplates": [
            {"idTipo": 91001, "idTextName": 210, "idTextDescription": 210,
             "idClassPermitted": None, "idClassProhibited": None}
        ]
    }
    
    import_service.import_story(tutorial_data)
    import_service.import_story(demo1_data)
    print("Seeding completed successfully.")

if __name__ == "__main__":
    seed()
