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
        "texts": [
            {"idText": 1, "lang": "en", "shortText": "TUTORIAL"},
            {"idText": 1, "lang": "it", "shortText": "TUTORIAL"},
            {"idText": 2, "lang": "en", "shortText": "A short training adventure."},
            {"idText": 2, "lang": "it", "shortText": "Una breve avventura di addestramento."},
            {"idText": 100, "lang": "en", "shortText": "Welcome Hall"},
            {"idText": 100, "lang": "it", "shortText": "Sala di Benvenuto"},
            {"idText": 200, "lang": "en", "shortText": "Warrior"},
            {"idText": 200, "lang": "it", "shortText": "Guerriero"},
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
            {"uuid": "tut-diff-1", "idTextDescription": 300, "expCost": 1, "maxWeight": 20}
        ],
        "locations": [
            {"idTextName": 100, "idTextDescription": 100, "isSafe": 1}
        ],
        "events": [
            {"idTextName": 500, "idTextDescription": 500, "type": "FIRST"}
        ],
        "items": [
            {"idTextName": 400, "idTextDescription": 400, "weight": 1}
        ],
        "classes": [
            {"idTextName": 200, "idTextDescription": 200}
        ],
        "traits": [
            {"idTextName": 700, "idTextDescription": 700, "cost": 1}
        ],
        "characterTemplates": [
            {"idTipo": 90001, "idTextName": 210, "idTextDescription": 210}
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
        "texts": [
            {"idText": 1, "lang": "en", "shortText": "The Valvassor of the March"},
            {"idText": 1, "lang": "it", "shortText": "Il Valvassore di Marca"},
            {"idText": 2, "lang": "en", "shortText": "Travel across medieval Veneto."},
            {"idText": 2, "lang": "it", "shortText": "Viaggia attraverso il Veneto medievale."}
        ],
        "difficulties": [],
        "locations": [],
        "events": [],
        "items": [],
        "classes": [],
        "traits": [],
        "characterTemplates": []
    }
    
    import_service.import_story(tutorial_data)
    import_service.import_story(demo1_data)
    print("Seeding completed successfully.")

if __name__ == "__main__":
    seed()
