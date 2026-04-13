"""
seed/handler.py — Paths Games AWS Lambda
Dev-only endpoint: inserts (or replaces) the 4 standard test users that mirror
the data defined in:
  code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql

POST /api/dev/seed

Returns 403 if ENV != 'dev' so this endpoint is harmless in production deployments.

Fixed deterministic UUIDs — stable across re-runs so MOCK_ACCESS tokens don't change:
  test_admin   → 00000001-1111-0000-0000-000000000001  (ADMIN)
  test_player1 → 00000002-2222-0000-0000-000000000002  (PLAYER / Alice)
  test_player2 → 00000003-3333-0000-0000-000000000003  (PLAYER / Bob)
  test_player3 → 00000004-4444-0000-0000-000000000004  (PLAYER / Charlie)

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

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({
            "status":   "SEEDED",
            "inserted": inserted,
            "note":     "Use the accessToken value as: Authorization: Bearer <accessToken>"
        })
    }
