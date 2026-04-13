"""
seed/handler.py — Paths Games AWS Lambda
Dev-only endpoint: inserts (or replaces) the 4 standard test users AND the 2
seed stories that mirror the data defined in:
  code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql
  code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql

POST /api/dev/seed

Returns 403 if ENV != 'dev' so this endpoint is harmless in production deployments.

Fixed deterministic UUIDs — stable across re-runs so MOCK_ACCESS tokens don't change:
  test_admin   → 00000001-1111-0000-0000-000000000001  (ADMIN)
  test_player1 → 00000002-2222-0000-0000-000000000002  (PLAYER / Alice)
  test_player2 → 00000003-3333-0000-0000-000000000003  (PLAYER / Bob)
  test_player3 → 00000004-4444-0000-0000-000000000004  (PLAYER / Charlie)

Seed stories:
  Tutorial          → a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d  (PUBLIC, tutorial)
  Valvassore Demo 1 → b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e  (PUBLIC, historical)

Mock access tokens (use in Authorization: Bearer <token> header):
  test_admin   → MOCK_ACCESS_00000001-1111-0000-0000-000000000001
  test_player1 → MOCK_ACCESS_00000002-2222-0000-0000-000000000002
  test_player2 → MOCK_ACCESS_00000003-3333-0000-0000-000000000003
  test_player3 → MOCK_ACCESS_00000004-4444-0000-0000-000000000004
"""

import json
import os
import time

from common import db_utils

# ─── constants ────────────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

# Password hash = BCrypt of 'password123'  (same as SQL seed)
BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

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
            },
        ],
        "difficulty_count": 1,
        "location_count":   8,
        "event_count":      5,
        "item_count":       4,
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
            },
        ],
        "difficulty_count": 3,
        "location_count":   12,
        "event_count":      5,
        "item_count":       5,
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
            # GSI for story listing
            "GSI1_PK":                  "STORY_LIST",
            "GSI1_SK":                  f"STORY#{story_uuid}",
        }
        db_utils.put_item(story_item)
        seeded.append({"uuid": story_uuid, "title": s["texts"]["en"]["title"]})
    return seeded

# ─── handler ─────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    env = os.environ.get("ENV", "dev")
    if env != "dev":
        return {
            "statusCode": 403,
            "headers": HEADERS,
            "body": json.dumps({
                "error":   "FORBIDDEN",
                "message": "Seed endpoint is only available in the dev environment"
            })
        }

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
        inserted.append({
            "uuid":        uid,
            "username":    u["username"],
            "role":        u["role"],
            "accessToken": f"MOCK_ACCESS_{uid}",
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
