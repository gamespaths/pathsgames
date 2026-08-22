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
            {"idText": 700, "lang": "it", "shortText": "Coraggioso"},
            # Step 31 — the choice-events and their options.
            {"idText": 610, "lang": "en", "shortText": "Crossroads Trial"},
            {"idText": 610, "lang": "it", "shortText": "La Prova del Bivio"},
            {"idText": 611, "lang": "en", "shortText": "Sealed Gate"},
            {"idText": 611, "lang": "it", "shortText": "Il Cancello Sigillato"},
            {"idText": 612, "lang": "en", "shortText": "Take the plain road"},
            {"idText": 612, "lang": "it", "shortText": "Prendi la via semplice"},
            {"idText": 613, "lang": "en", "shortText": "Recite the ancient runes"},
            {"idText": 613, "lang": "it", "shortText": "Recita le rune antiche"},
            {"idText": 614, "lang": "en", "shortText": "Bargain with the figure"},
            {"idText": 614, "lang": "it", "shortText": "Contratta con la figura"},
            {"idText": 615, "lang": "en", "shortText": "Shrug and improvise"},
            {"idText": 615, "lang": "it", "shortText": "Alza le spalle e improvvisa"},
            # Step 32 — the resolution test-bed.
            {"idText": 616, "lang": "en", "shortText": "The Fork"},
            {"idText": 616, "lang": "it", "shortText": "Il Bivio"},
            {"idText": 617, "lang": "en", "shortText": "Beyond The Fork"},
            {"idText": 617, "lang": "it", "shortText": "Oltre Il Bivio"},
            {"idText": 618, "lang": "en", "shortText": "Press on alone"},
            {"idText": 618, "lang": "it", "shortText": "Prosegui da solo"},
            {"idText": 619, "lang": "en", "shortText": "Follow the lantern"},
            {"idText": 619, "lang": "it", "shortText": "Segui la lanterna"},
            # The narratives: withheld while the options are pending, revealed on resolution.
            {"idText": 620, "lang": "en", "shortText": "You walk on, and the fork closes behind you."},
            {"idText": 620, "lang": "it", "shortText": "Prosegui, e il bivio si chiude alle tue spalle."},
            {"idText": 621, "lang": "en", "shortText": "The lantern leads you into the grove."},
            {"idText": 621, "lang": "it", "shortText": "La lanterna ti conduce nel bosco."}
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
            # Step 33 — the fuse now points at an AUTOMATIC event that actually does
            # something: Step 26 only ever logged it as pending.
            {"id": 1, "idTextName": 100, "idTextDescription": 100, "isSafe": 1,
             "idCard": 1, "counterTime": 2, "idEventIfCounterZero": 43,
             "priorityAutomaticEvent": 1,
             # flagBack 1 — a two-way door. Without it the edge is one-way and the party
             # can never walk back, which makes every re-entry behaviour untestable.
             "neighbors": [{"idLocationTo": 2, "direction": "NORTH", "energyCost": 2,
                            "idCardBack": 1, "flagBack": 1}]},
            # Step 28: a second location to move into.
            # Step 0.28.5: both locations carry idCard so GET /locations resolves
            # a full `card` for each location and neighbor (as Java/AWS seeds do).
            # Step 33 — the first arrival here and every later one fire different events.
            {"id": 2, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1,
             "idEventIfFirstTime": 40, "idEventNotFirstTime": 41,
             "neighbors": [{"idLocationTo": 4, "direction": "EAST", "energyCost": 0,
                            "idCardBack": 1, "flagBack": 1}]},
            # v0.29.3 — deliberately has NO neighbor edge: only the teleport effect (event 28)
            # can bring a character here, proving the forced movement skips every Step 28 check.
            {"id": 3, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1},
            # v0.33.2 — the two triggers that are NOT history-based, each on a location the
            # party can actually walk to. Location 3 cannot host them: no edge reaches it,
            # and a trigger nobody can walk into is a trigger no end-to-end test can read.
            #   4 — fires when the arriving character finds the room empty (OCCUPANCY, which
            #       in single-player is every arrival).
            {"id": 4, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1,
             "idEventIfCharacterEnterEmptyLocation": 42,
             "neighbors": [{"idLocationTo": 5, "direction": "NORTH", "energyCost": 0,
                            "idCardBack": 1, "flagBack": 1}]},
            #   5 — fires when a time unit BEGINS with somebody standing here, so it is
            #       reported on the sleep that advanced the clock, not on a movement.
            {"id": 5, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1,
             "idEventIfCharacterStartTime": 44, "priorityAutomaticEvent": 2},
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
            # v0.34.0 inventory pair: 50 is gated by item 2, which 51 grants. Because item 2
            # is CONSUMABLE, using it must close 50 again — the step-34 acceptance test.
            # 52 grants the heavy item 4, which is what makes OVERWEIGHT reachable.
            {"id": 50, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1, "idItemCondition": 2},
            {"id": 51, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE", "idItemTarget": 2, "itemAction": "ADD"},
                         {"idCard": 1, "target": "ONLY_ONE", "idItemTarget": 3, "itemAction": "ADD"}]},
            {"id": 52, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE", "idItemTarget": 4, "itemAction": "ADD"}]},
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
            # v0.29.3 — forced movement: its effect teleports the actor to location 3, which is
            # NOT a neighbor of the start — no checks, no movement cost, only the event's own
            # energy cost (2, so the "cost 1" robot lookup keeps meaning event 10).
            {"id": 28, "idTextName": 500, "idTextDescription": 500, "type": "NORMAL",
             "idSpecificLocation": 1, "costEnery": 2, "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE", "idLocation": 3}]},
            # Step 31 — the choice-engine test-bed: executing these answers CHOICES_PENDING
            # (cost paid, marker written, effects withheld). Event 30 even carries an effect
            # that must NEVER run while pending; 31 is ONCE. Cost 2 on 30 keeps the "cost 1"
            # robot lookup unambiguous (it means event 10).
            {"id": 30, "idTextName": 610, "idTextDescription": 610, "type": "NORMAL",
             "idSpecificLocation": 1, "costEnery": 2, "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 99, "target": "ONLY_ONE"}]},
            {"id": 31, "idTextName": 611, "idTextDescription": 611, "type": "ONCE",
             "idSpecificLocation": 1, "costEnery": 1, "idCard": 1},
            # Step 32 — the resolution test-bed. Opening 32 costs 3 (unambiguous for the
            # robot lookup); resolving one of its options costs nothing at all. 33 is the
            # outcome event an option runs: it lives nowhere and costs 9, proving a
            # consequence is neither re-checked nor charged.
            {"id": 32, "idTextName": 616, "idTextDescription": 616, "type": "NORMAL",
             "idSpecificLocation": 1, "costEnery": 3, "idCard": 1},
            {"id": 33, "idTextName": 617, "idTextDescription": 617, "type": "NORMAL",
             "costEnery": 9, "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 7, "target": "ONLY_ONE"}]},
            # Step 33 — the events nobody asks for. Named BY the location, through
            # list_locations.id_event_*, so idSpecificLocation stays absent and /info never
            # offers them as actions. type='AUTOMATIC' is what the {NORMAL, ONCE} allowlist
            # already refuses to players. None owns a choice — an automatic event has nobody
            # to ask and no response to ask in. One recognisable effect each, so a Robot test
            # can tell which trigger fired.
            {"id": 40, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 11, "target": "ONLY_ONE",
                          "keyToAdd": "STEP33_FIRST", "keyValueToAdd": "YES"}]},
            {"id": 41, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 12, "target": "ONLY_ONE",
                          "keyToAdd": "STEP33_SUBSEQUENT", "keyValueToAdd": "YES"}]},
            {"id": 42, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 13, "target": "ONLY_ONE",
                          "keyToAdd": "STEP33_ALONE", "keyValueToAdd": "YES"}]},
            # The counter-zero fuse writes a registry key and nothing else: it must still
            # change the world when it fires in a location nobody is standing in.
            {"id": 43, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idCard": 1,
             "effects": [{"idCard": 1, "target": "ONLY_ONE",
                          "keyToAdd": "STEP33_COUNTER", "keyValueToAdd": "YES"}]},
            # v0.33.2 — the time-start trigger of location 5.
            {"id": 44, "idTextName": 500, "idTextDescription": 500, "type": "AUTOMATIC",
             "idCard": 1,
             "effects": [{"idCard": 1, "statistics": "exp", "value": 14, "target": "ONLY_ONE",
                          "keyToAdd": "STEP33_STARTTIME", "keyValueToAdd": "YES"}]},
        ],
        # Step 31 — the options of the two choice-events above (canonical top-level arrays
        # keyed by idChoices). Event 30: one always-available option, one gated on INT > 99
        # (unavailable), one OR-combined (available via life > 0), one otherwise fallback.
        "choices": [
            {"id": 10, "idEvent": 30, "idCard": 1, "idTextName": 612, "idTextDescription": 612,
             "priority": 2, "otherwiseFlag": 0, "logicOperator": "AND"},
            {"id": 11, "idEvent": 30, "idCard": 1, "idTextName": 613, "idTextDescription": 613,
             "priority": 1, "otherwiseFlag": 0, "logicOperator": "AND"},
            {"id": 12, "idEvent": 30, "idCard": 1, "idTextName": 614, "idTextDescription": 614,
             "priority": 3, "otherwiseFlag": 0, "logicOperator": "OR"},
            {"id": 13, "idEvent": 30, "idCard": 1, "idTextName": 615, "idTextDescription": 615,
             "priority": 4, "otherwiseFlag": 1, "logicOperator": "AND", "limitDex": 99},
            {"id": 14, "idEvent": 31, "idCard": 1, "idTextName": 612, "idTextDescription": 612,
             "priority": 1, "otherwiseFlag": 0, "logicOperator": "AND"},
            {"id": 15, "idEvent": 31, "idCard": 1, "idTextName": 613, "idTextDescription": 613,
             "priority": 2, "otherwiseFlag": 0, "logicOperator": "AND", "limitDex": 99},
            # Step 32 — the three options of event 32, one per thing a resolution can do.
            # idTextNarrative is what Step 31 withholds and the resolution reveals.
            {"id": 20, "idEvent": 32, "idCard": 1, "idTextName": 618, "idTextDescription": 618,
             "idTextNarrative": 620, "priority": 1, "otherwiseFlag": 0, "isProgress": 1,
             "logicOperator": "AND"},
            {"id": 21, "idEvent": 32, "idCard": 1, "idTextName": 619, "idTextDescription": 619,
             "idTextNarrative": 621, "idEventTorun": 33, "priority": 2, "otherwiseFlag": 0,
             "isProgress": 0, "logicOperator": "AND"},
            # Impossible for anyone: proves select-choice re-checks the verdict.
            {"id": 22, "idEvent": 32, "idCard": 1, "idTextName": 613, "idTextDescription": 613,
             "priority": 3, "otherwiseFlag": 0, "isProgress": 0, "logicOperator": "AND",
             "limitDex": 99},
        ],
        "choiceConditions": [
            {"id": 2, "idChoices": 11, "type": "statistics", "key": "int", "value": "99", "operator": ">"},
            {"id": 3, "idChoices": 12, "type": "statistics", "key": "int", "value": "99", "operator": ">"},
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
            # One row, every kind of effect: a registry key, an item, a forced move to
            # location 3 (which no neighbor edge reaches) and the inactive weather 3.
            {"id": 21, "idChoices": 21, "idCard": 1, "key": "STEP32_GATE",
             "valueToAdd": "OPEN", "idItemTarget": 1, "itemAction": "ADD",
             "idLocation": 3, "idWeather": 3},
        ],
        # v0.34.0 — the inventory test-bed. Item 1 is CARRIED ONLY (it gates event 15 and
        # must stay in the bag), item 2 is the consumable that gates event 50, item 3 is
        # restricted to class 1, item 4 is heavy enough to reach OVERWEIGHT.
        # v0.35.0 — flagShowEffects: item 4 keeps its secret (0) while still applying
        # LIFE +1, and item 2 leaves the field unset, which must read as "shown".
        # v0.35.1 — item 3 is capped at ONE (event 51 hands it over every time it runs, so a
        # second run has to be refused without failing the event) and a drop of item 2 puts
        # down TWO. The rest leave the columns unset: no cap, one unit per drop and use.
        "items": [
            {"id": 1, "idCard": 1, "idTextName": 400, "idTextDescription": 400,
             "weight": 1, "isConsumabile": 0, "flagShowEffects": 1},
            {"id": 2, "idCard": 1, "idTextName": 400, "idTextDescription": 400,
             "weight": 1, "isConsumabile": 1, "amountDrop": 2},
            {"id": 3, "idCard": 1, "idTextName": 400, "idTextDescription": 400,
             "weight": 1, "isConsumabile": 1, "idClassPermitted": 1,
             "flagShowEffects": 1, "maxPerCharacter": 1},
            {"id": 4, "idCard": 1, "idTextName": 400, "idTextDescription": 400,
             "weight": 9, "isConsumabile": 1, "flagShowEffects": 0},
        ],
        # v0.34.0 — the canonical TOP-LEVEL array, keyed by idItem, same shape as Java and
        # AWS. SADNESS is the documented alias of the `sad` statistic; traitsToAdd is the
        # same CSV-of-ids format the event effects use.
        "itemEffects": [
            {"id": 1, "idCard": 1, "idItem": 2, "effectCode": "EXP", "effectValue": 5,
             # v0.35.2 — grants the HIDDEN trait: unpickable, but perfectly grantable.
             "traitsToAdd": "3"},
            {"id": 2, "idCard": 1, "idItem": 3, "effectCode": "SADNESS", "effectValue": 1},
            {"id": 3, "idCard": 1, "idItem": 4, "effectCode": "LIFE", "effectValue": 1},
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
             "intelligence": 0, "constitution": 0, "weight": 0},
            # v0.35.2 — the one trait nobody may choose: the scroll (item effect 1) hands it
            # over when used, and only then does it show in the player's trait list.
            {"idTextName": 700, "idTextDescription": 700, "costPositive": 0, "costNegative": 0,
             "life": 0, "energy": 0, "sad": 0, "dexterity": 0,
             "intelligence": 1, "constitution": 0, "weight": 0,
             "hideOnStartMatch": 1}
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
        # No story-level idCard on purpose: this story's summary card stays null, which is
        # exactly what the Step 15 "card field present (even if null)" case documents.
        "idLocationStart": 1,
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
            {"idText": 302, "lang": "en", "shortText": "Iron Inquisition"},
            {"idText": 100, "lang": "en", "shortText": "Castelfranco"},
            {"idText": 100, "lang": "it", "shortText": "Castelfranco"},
            {"idText": 101, "lang": "en", "shortText": "Treviso"},
            {"idText": 101, "lang": "it", "shortText": "Treviso"},
        ],
        "difficulties": [
            {"uuid": "demo2-diff-1", "idTextDescription": 300, "expCost": 3, "maxWeight": 20,
             "life": 130, "energy": 120, "sad": 0, "dexterity": 12, "intelligence": 12, "constitution": 14, "weight": 14},
            {"uuid": "demo2-diff-2", "idTextDescription": 301, "expCost": 5, "maxWeight": 12,
             "life": 100, "energy": 100, "sad": 10, "dexterity": 10, "intelligence": 10, "constitution": 10, "weight": 10},
            {"uuid": "demo2-diff-3", "idTextDescription": 302, "expCost": 8, "maxWeight": 8,
             "life": 80,  "energy": 90,  "sad": 20, "dexterity": 8,  "intelligence": 8,  "constitution": 8,  "weight": 8}
        ],
        # A story with no location cannot host a match at all: POST /api/matches refuses
        # it with STORY_HAS_NO_LOCATIONS, and the Step 19 duplicate-match guard case that
        # needs a SECOND story to create a match on could only skip itself. The Java and
        # AWS seeds ship a real map here; two walkable places are enough to make the same
        # case runnable without transcribing the whole Veneto.
        "locations": [
            {"id": 1, "idTextName": 100, "idTextDescription": 100, "isSafe": 1, "idCard": 1,
             "neighbors": [{"idLocationTo": 2, "direction": "EAST", "energyCost": 1,
                            "idCardBack": 1, "flagBack": 1}]},
            {"id": 2, "idTextName": 101, "idTextDescription": 101, "isSafe": 0, "idCard": 1},
        ],
        "events": [],
        "items": [],
        "cards": [
            {"id": 1, "uuid": "card-demo2-001", "idTextTitle": 100, "idTextDescription": 100,
             "urlImage": "https://paths.games/assets/cards/demo2-castelfranco.jpg",
             "awesomeIcon": "fa-chess-rook", "styleMain": "card-demo2"},
        ],
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
