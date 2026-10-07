import boto3
from collections import defaultdict

table_name = "PathsGamesBackend-test"   # cambia se il nome è diverso
region = "us-east-2"

table = boto3.resource("dynamodb", region_name=region).Table(table_name)


pk_counts = defaultdict(int)
sk_counts = defaultdict(int)
match_sk_counts = defaultdict(int)
match_creator_counts = defaultdict(int)
total_items = 0

last_key = None
while True:
    kwargs = {}
    if last_key:
        kwargs["ExclusiveStartKey"] = last_key

    resp = table.scan(**kwargs)
    for item in resp.get("Items", []):
        total_items += 1

        pk = str(item.get("PK", ""))
        sk = str(item.get("SK", "METADATA"))

        # conti per PK
        if pk.startswith("MATCH#"):
            pk_counts["MATCH#"] += 1
        elif pk.startswith("USER#"):
            pk_counts["USER#"] += 1
        elif pk.startswith("STORY#"):
            pk_counts["STORY#"] += 1
        elif pk.startswith("CARD#"):
            pk_counts["CARD#"] += 1
        else:
            pk_counts["OTHER"] += 1

        # conti per SK
        if sk == "METADATA":
            sk_counts["METADATA"] += 1
        elif sk.startswith("CHARACTER#"):
            sk_counts["CHARACTER#"] += 1
        elif sk.startswith("TURN#"):
            sk_counts["TURN#"] += 1
        elif sk.startswith("LOG#"):
            sk_counts["LOG#"] += 1
        elif sk.startswith("AUDIT#"):
            sk_counts["AUDIT#"] += 1
        elif sk.startswith("SNAPSHOT#"):
            sk_counts["SNAPSHOT#"] += 1
        else:
            sk_counts["OTHER"] += 1

        # dettaglio per match partition
        if pk.startswith("MATCH#"):
            if sk == "METADATA":
                match_sk_counts["MATCH_METADATA"] += 1
                creator = item.get("userCreatorUuid") or "UNKNOWN"
                match_creator_counts[creator] += 1
            elif sk.startswith("CHARACTER#"):
                match_sk_counts["CHARACTER"] += 1
            elif sk.startswith("TURN#"):
                match_sk_counts["TURN"] += 1
            elif sk.startswith("LOG#"):
                match_sk_counts["LOG"] += 1
            elif sk.startswith("AUDIT#"):
                match_sk_counts["AUDIT"] += 1
            elif sk.startswith("SNAPSHOT#"):
                match_sk_counts["SNAPSHOT"] += 1
            else:
                match_sk_counts["OTHER_MATCH_SK"] += 1

    if "LastEvaluatedKey" not in resp:
        break
    last_key = resp["LastEvaluatedKey"]

print("TOTAL ITEMS:", total_items)
print("\nPK counts:")
for k, v in sorted(pk_counts.items()):
    print(f"  {k}: {v}")

print("\nSK counts:")
for k, v in sorted(sk_counts.items()):
    print(f"  {k}: {v}")

print("\nMATCH partition SK breakdown:")
for k, v in sorted(match_sk_counts.items()):
    print(f"  {k}: {v}")

print("\nTOP 10 users with >10 matches created:")
rows = [(user, count) for user, count in match_creator_counts.items() if count > 10]
for user, count in sorted(rows, key=lambda x: (-x[1], x[0]))[:10]:
    print(f"  {user}: {count}")

if not rows:
    print("  None")