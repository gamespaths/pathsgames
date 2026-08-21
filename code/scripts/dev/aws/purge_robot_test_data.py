#!/usr/bin/env python3
"""Purge the leftovers of a Robot Framework run from a PathsGames DynamoDB table.

Why this exists next to POST /api/dev/cleanup: that endpoint removes a robot match with
``delete_item(PK, "METADATA")``, which deletes ONE item. A match partition also holds its
``CHARACTER#…`` rows, so every interrupted — or even every completed — run leaves those
behind, orphaned under a partition whose metadata is gone. This script deletes the WHOLE
partition, and can also sweep the orphans an earlier cleanup already stranded.

What it removes, and nothing else:

  * the seed stories, identified by the uuids in ``SEED_STORIES`` (cascade over STORY#…);
  * the stories the suite IMPORTS and normally deletes at the end — the ``DEMO_*_UUID``
    values declared in the robot variable file, which an interrupted run leaves behind;
  * the matches whose ``name`` starts with the robot marker (cascade over MATCH#…);
  * the guest users whose ``username`` starts with that marker.

Every other story, match and user is left untouched — a story you authored and a match you
are playing carry neither the marker nor a seed uuid, so no rule can reach them.

The identifying rules are READ from the sources of truth rather than copied — the marker
and the seed uuids from ``lambda/seed/handler.py``, the imported-story uuids from the robot
variable file — so adding a story or renaming the marker cannot leave this script behind.

Safe by default: it prints what it would delete and exits. Deleting needs ``--apply``, and
a table whose name looks like production is refused outright.

Usage
-----
    # look, change nothing (the default)
    ./purge_robot_test_data.py --table PathsGamesBackend-test

    # the table name can also come from --env, or from AWS_ENVIRONMENT_NAME_TEST in .env
    ./purge_robot_test_data.py --env test

    # actually delete, after showing the plan and asking
    ./purge_robot_test_data.py --env test --apply

    # also sweep partitions an earlier cleanup left half-deleted
    ./purge_robot_test_data.py --env test --orphans --apply
"""
import argparse
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[4]
LAMBDA_DIR = PROJECT_ROOT / "code" / "backend" / "aws" / "lambda"

# The marker and the seed uuids are the SAME ones the backend writes. Importing them keeps
# this script honest: a new seed story or a renamed marker is picked up automatically.
sys.path.insert(0, str(LAMBDA_DIR))
try:
    from seed.handler import ROBOT_TEST_MARKER, SEED_STORIES
except ImportError as exc:  # pragma: no cover - a broken checkout, not a runtime path
    sys.exit(f"cannot import the seed definitions from {LAMBDA_DIR}: {exc}")

TABLE_PREFIX = "PathsGamesBackend"
#: Where the robot suite declares the stories it imports (and normally deletes again).
ROBOT_VARIABLES = PROJECT_ROOT / "code" / "tests" / "robot" / "variables" / "aws.yaml"
#: Refused outright — this script exists for throwaway data.
PROD_MARKERS = ("prod", "production", "live")


# ── configuration ────────────────────────────────────────────────────────────

def load_dotenv(path):
    """Minimal reader for the repo-root .env, matching what the shell scripts source.

    Only ``KEY=value`` lines are honoured; anything else is ignored rather than guessed at.
    Values already in the environment win, so an explicit export overrides the file.
    """
    if not path.is_file():
        return
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def resolve_table(args):
    """The table to work on: --table, then --env, then TABLE_NAME, then the .env default."""
    if args.table:
        return args.table
    env = args.env or os.environ.get("AWS_ENVIRONMENT_NAME_TEST")
    if env:
        return f"{TABLE_PREFIX}-{env}"
    if os.environ.get("TABLE_NAME"):
        return os.environ["TABLE_NAME"]
    sys.exit("no table to work on: pass --table or --env, or set AWS_ENVIRONMENT_NAME_TEST")


def resolve_region(args):
    return (args.region
            or os.environ.get("AWS_REGION_TEST")
            or os.environ.get("AWS_DEFAULT_REGION")
            or os.environ.get("AWS_REGION")
            or "us-east-2")


# ── classification (pure: no AWS, no I/O) ────────────────────────────────────

SEED_STORY = "seed story"
ROBOT_MATCH = "robot match"
ROBOT_GUEST = "robot guest"
ORPHAN_MATCH = "orphan match partition"


def seed_story_pks():
    """STORY# partitions the backend itself seeds."""
    return {f"STORY#{s['uuid']}" for s in SEED_STORIES}


def imported_story_pks(path=ROBOT_VARIABLES):
    """STORY# partitions the robot suite IMPORTS — the DEMO_*_UUID variables.

    ``14_admin/story_import.robot`` imports these and deletes them again on the way out, so
    they only survive a run that was interrupted. Parsed with a one-line regex instead of a
    yaml dependency: the file is a flat ``KEY: "value"`` list and always has been.
    """
    if not path.is_file():
        return set()
    pattern = re.compile(r'^\s*DEMO_\d+_UUID\s*:\s*["\']?([0-9a-fA-F-]{36})', re.M)
    return {f"STORY#{uuid}" for uuid in pattern.findall(path.read_text(errors="replace"))}


def classify(item, story_pks, marker):
    """The category of ONE scanned item, or None when nothing may touch it.

    Deliberately conservative: an item is only ever claimed by an explicit rule, so
    anything unrecognised — a story you authored, a match you are playing, a real user —
    falls through and survives.
    """
    pk = str(item.get("PK") or "")
    sk = str(item.get("SK") or "")

    if pk in story_pks:
        return SEED_STORY
    if pk.startswith("USER#") and item.get("is_guest") \
            and str(item.get("username") or "").startswith(marker):
        return ROBOT_GUEST
    # Only the METADATA row carries the name; the CHARACTER# rows of the same match come
    # along because the whole partition is deleted, not because they match a rule.
    if pk.startswith("MATCH#") and sk == "METADATA" \
            and str(item.get("name") or "").startswith(marker):
        return ROBOT_MATCH
    return None


def plan_deletions(items, story_pks, marker, include_orphans=False):
    """(partitions to delete, per-category counts, orphan pks).

    Returns PARTITIONS, not items: a match and a story are deleted whole, because half a
    match — metadata gone, characters left — is exactly the state this script cleans up.
    """
    doomed = {}                       # pk -> category
    match_pks = set()
    match_pks_with_metadata = set()

    for item in items:
        pk = str(item.get("PK") or "")
        if pk.startswith("MATCH#"):
            match_pks.add(pk)
            if str(item.get("SK") or "") == "METADATA":
                match_pks_with_metadata.add(pk)
        category = classify(item, story_pks, marker)
        if category:
            doomed[pk] = category

    # A MATCH# partition with no METADATA row cannot be identified by name — its name is
    # in the row that is already gone. It is residue by construction: the backend never
    # creates characters without a match. Opt-in all the same, since it is the one rule
    # that cannot be corroborated.
    orphans = sorted(match_pks - match_pks_with_metadata)
    if include_orphans:
        for pk in orphans:
            doomed.setdefault(pk, ORPHAN_MATCH)

    counts = defaultdict(int)
    for category in doomed.values():
        counts[category] += 1
    return doomed, counts, orphans


# ── DynamoDB ─────────────────────────────────────────────────────────────────

def scan_table(table):
    """Every item, paginated. Only the attributes the rules read are fetched."""
    kwargs = {"ProjectionExpression": "PK, SK, #n, username, is_guest",
              "ExpressionAttributeNames": {"#n": "name"}}
    while True:
        response = table.scan(**kwargs)
        for item in response.get("Items", []):
            yield item
        last = response.get("LastEvaluatedKey")
        if not last:
            return
        kwargs["ExclusiveStartKey"] = last


def keys_of_partition(table, pk):
    """The (PK, SK) of every row under one partition."""
    keys, kwargs = [], {
        "KeyConditionExpression": "PK = :pk",
        "ExpressionAttributeValues": {":pk": pk},
        "ProjectionExpression": "PK, SK",
    }
    while True:
        response = table.query(**kwargs)
        keys.extend((i["PK"], i["SK"]) for i in response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            return keys
        kwargs["ExclusiveStartKey"] = last


def delete_partitions(table, partitions):
    """Cascade-delete each partition. Returns the number of ROWS removed."""
    removed = 0
    with table.batch_writer() as batch:
        for pk in partitions:
            for key_pk, key_sk in keys_of_partition(table, pk):
                batch.delete_item(Key={"PK": key_pk, "SK": key_sk})
                removed += 1
    return removed


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Remove Robot Framework leftovers (seed stories, robot matches and "
                    "robot guests) from a PathsGames DynamoDB table. Real data is never "
                    "touched. Prints the plan and exits unless --apply is given.")
    parser.add_argument("--table", help="table name; wins over --env")
    parser.add_argument("--env", help=f"environment suffix, i.e. {TABLE_PREFIX}-<env>")
    parser.add_argument("--region", help="AWS region (default: AWS_REGION_TEST from .env)")
    parser.add_argument("--profile", help="AWS credentials profile")
    parser.add_argument("--apply", action="store_true",
                        help="actually delete; without it nothing is written")
    parser.add_argument("--yes", action="store_true",
                        help="skip the confirmation prompt (for unattended runs)")
    parser.add_argument("--orphans", action="store_true",
                        help="also delete MATCH# partitions whose METADATA row is already "
                             "gone — the residue an interrupted run leaves behind")
    parser.add_argument("--keep-stories", action="store_true",
                        help="leave the seed stories in place, remove only matches/guests")
    args = parser.parse_args()

    load_dotenv(PROJECT_ROOT / ".env")
    table_name = resolve_table(args)
    region = resolve_region(args)

    lowered = table_name.lower()
    if any(m in lowered for m in PROD_MARKERS):
        sys.exit(f"refusing to touch {table_name!r}: it looks like a production table")

    try:
        import boto3
    except ImportError:
        sys.exit("boto3 is not installed — activate the project venv first")

    session = boto3.Session(profile_name=args.profile) if args.profile else boto3.Session()
    table = session.resource("dynamodb", region_name=region).Table(table_name)

    seeded = seed_story_pks()
    imported = imported_story_pks()
    story_pks = set() if args.keep_stories else (seeded | imported)

    print(f"table   : {table_name}  (region {region})")
    print(f"marker  : {ROBOT_TEST_MARKER!r}")
    if args.keep_stories:
        print("stories : kept (--keep-stories)")
    else:
        print(f"stories : {len(seeded)} seeded + {len(imported)} imported by the suite")
        if not imported:
            print(f"          (no DEMO_*_UUID found in {ROBOT_VARIABLES})")
    print("scanning…")

    items = list(scan_table(table))
    doomed, counts, orphans = plan_deletions(
        items, story_pks, ROBOT_TEST_MARKER, include_orphans=args.orphans)

    print(f"\n{len(items)} rows scanned")
    for category in (SEED_STORY, ROBOT_MATCH, ROBOT_GUEST, ORPHAN_MATCH):
        if counts.get(category):
            print(f"  {counts[category]:5d}  {category}")
    if orphans and not args.orphans:
        print(f"\n  {len(orphans)} MATCH# partitions have no METADATA row (residue of an "
              f"interrupted run).\n  They are LEFT ALONE — pass --orphans to remove them too.")

    if not doomed:
        print("\nnothing to remove.")
        return 0

    print(f"\n{len(doomed)} partitions would be deleted, with everything under them.")
    for pk, category in sorted(doomed.items())[:20]:
        print(f"    {pk}   ({category})")
    if len(doomed) > 20:
        print(f"    … and {len(doomed) - 20} more")

    if not args.apply:
        print("\nDRY RUN — nothing was written. Re-run with --apply to delete.")
        return 0

    if not args.yes:
        answer = input(f"\ndelete {len(doomed)} partitions from {table_name}? [y/N] ")
        if answer.strip().lower() not in ("y", "yes"):
            print("aborted, nothing was written.")
            return 1

    removed = delete_partitions(table, doomed)
    print(f"\ndeleted {removed} rows across {len(doomed)} partitions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
