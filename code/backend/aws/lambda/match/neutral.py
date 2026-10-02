"""v0.41.4 Step 41 H — match export v1 on AWS: the canonical JSON (same as java/python, Decimal → int), the
schema keywords of match_export_v1.schema.json, and the DynamoDB items ↔ neutral sections (H.2.3)."""
import datetime
import hashlib
import json
import re
import uuid as uuid_lib
from decimal import Decimal
from pathlib import Path

FORMAT = 'paths-games-match-export'
FORMAT_VERSION = 1
SCHEMA_FILE = Path(__file__).with_name('match_export_v1.schema.json')
RESOURCES = ('energy', 'food', 'magic', 'coin')
STATS = ('dexterity', 'intelligence', 'constitution', 'energy', 'life', 'sad', 'lifeMax', 'energyMax', 'sadMax',
         'weightMax', 'exp')
LOG_TYPES = ('WEATHER', 'MOVEMENT', 'SLEEP', 'CLOCK_ADVANCE', 'RECOVERY', 'EVENT', 'CHOICE', 'COUNTER_ZERO',
             'AUTOMATIC_EVENT', 'RANDOM_EVENT', 'REGISTRY_CHANGE', 'MISSION_CHANGE', 'ITEM_ADD', 'ITEM_USE',
             'ITEM_DROP', 'EXP_USE', 'PASS', 'EDGE_STATE', 'TRAIT_CHANGE', 'MATCH_LIFECYCLE', 'ADMIN_ACTION', 'OTHER')
_MAX_ERRORS = 20
_DEFS = '#/$defs/'


# ── canonical JSON ────────────────────────────────────────────────────────────

def drop_nulls(value):
    """Null-valued object keys removed at any depth; Decimal to int (float when it has a fraction)."""
    if isinstance(value, dict):
        return {str(k): drop_nulls(v) for k, v in value.items() if v is not None}
    if isinstance(value, (list, tuple)):
        return [drop_nulls(v) for v in value]
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def canonical(value):
    """Keys by code point, no whitespace, null keys dropped, minimal escapes (same text as java/python)."""
    return json.dumps(drop_nulls(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def sha256(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def size(value):
    return len(canonical(value).encode('utf-8'))


# ── schema ────────────────────────────────────────────────────────────────────

def is_integer(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _has_type(type_, value):
    checks = {'object': lambda v: isinstance(v, dict), 'array': lambda v: isinstance(v, list),
              'string': lambda v: isinstance(v, str), 'boolean': lambda v: isinstance(v, bool),
              'integer': is_integer,
              'number': lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)}
    return checks.get(type_, lambda v: True)(value)


def _same(expected, value):
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return is_integer(value) and expected == value
    return expected is not None and expected == value


class SchemaValidator:
    """The keywords match_export_v1.schema.json uses; mirrors java/python ``SchemaValidator``."""

    def __init__(self, schema):
        self.root = schema

    @classmethod
    def match_export_v1(cls):
        return cls(json.loads(SCHEMA_FILE.read_text(encoding='utf-8')))

    def validate(self, value):
        errors = []
        self._check(self.root, value, '$', errors)
        return errors

    def _check(self, schema, value, path, errors):
        if len(errors) >= _MAX_ERRORS or schema is None:
            return
        ref = schema.get('$ref')
        if isinstance(ref, str) and ref.startswith(_DEFS):
            self._check(self.root['$defs'].get(ref[len(_DEFS):]), value, path, errors)
            return
        if 'const' in schema and not _same(schema['const'], value):
            errors.append(f"{path}: must be {schema['const']}")
            return
        options = schema.get('enum')
        if isinstance(options, list) and not any(_same(o, value) for o in options):
            errors.append(f'{path}: must be one of {options}')
            return
        if isinstance(schema.get('type'), str) and not _has_type(schema['type'], value):
            errors.append(f"{path}: must be {schema['type']}")
            return
        if isinstance(value, dict):
            for key in schema.get('required') or []:
                if value.get(key) is None:
                    errors.append(f'{path}: missing {key}')
            properties = schema.get('properties') or {}
            for key, item in value.items():
                if item is None:
                    continue
                if isinstance(properties.get(key), dict):
                    self._check(properties[key], item, f'{path}.{key}', errors)
                elif schema.get('additionalProperties') is False:
                    errors.append(f'{path}: unknown property {key}')
        elif isinstance(value, list):
            if is_integer(schema.get('minItems')) and len(value) < schema['minItems']:
                errors.append(f"{path}: needs at least {schema['minItems']} items")
            if schema.get('uniqueItems') is True and len({canonical(v) for v in value}) != len(value):
                errors.append(f'{path}: items are not unique')
            if isinstance(schema.get('items'), dict):
                for i, item in enumerate(value):
                    self._check(schema['items'], item, f'{path}[{i}]', errors)
        elif isinstance(value, str) and isinstance(schema.get('pattern'), str) \
                and not re.search(schema['pattern'], value):
            errors.append(f"{path}: does not match {schema['pattern']}")
        elif is_integer(value) and is_integer(schema.get('minimum')) and value < schema['minimum']:
            errors.append(f"{path}: must be >= {schema['minimum']}")


# ── values ────────────────────────────────────────────────────────────────────

def lng(value):
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, int):
        return value
    if isinstance(value, (float, Decimal)):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def positive(value):
    n = lng(value)
    return n if n is not None and n > 0 else None


def nz(value):
    return lng(value) or 0


def boolean(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in ('true', 't', '1')
    return False


def mapping(value):
    return value if isinstance(value, dict) else {}


def items(value):
    return list(value) if isinstance(value, list) else []


def ms_to_iso(ms):
    if ms is None:
        return None
    moment = datetime.datetime.fromtimestamp(int(ms) / 1000, datetime.timezone.utc)
    return moment.strftime('%Y-%m-%dT%H:%M:%S.') + f'{int(ms) % 1000:03d}Z'


def ts(value):
    """A timestamp (ISO text or epoch milliseconds) as ISO-8601 UTC with milliseconds; other text kept."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, (int, Decimal)) and not isinstance(value, bool):
        return ms_to_iso(int(value))
    text = str(value).strip()
    try:
        moment = datetime.datetime.fromisoformat(text[:-1] + '+00:00' if text.endswith('Z') else text)
    except ValueError:
        return text
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=datetime.timezone.utc)
    moment = moment.astimezone(datetime.timezone.utc)
    return moment.strftime('%Y-%m-%dT%H:%M:%S.') + f'{moment.microsecond // 1000:03d}Z'


def epoch_ms(value):
    iso = ts(value)
    try:
        return None if iso is None else int(datetime.datetime.fromisoformat(iso[:-1] + '+00:00').timestamp() * 1000)
    except ValueError:
        return None


# ── story uuid ↔ id ───────────────────────────────────────────────────────────

def _story_id(row):
    if row.get('id') is not None:
        return lng(row.get('id'))
    return lng(row.get('id_tipo'))


def id_by_uuid(story, key):
    return {r['uuid']: _story_id(r) for r in items((story or {}).get(key))
            if isinstance(r, dict) and r.get('uuid') and _story_id(r) is not None}


def uuid_by_id(story, key):
    return {_story_id(r): r['uuid'] for r in items((story or {}).get(key))
            if isinstance(r, dict) and r.get('uuid') and _story_id(r) is not None}


# ── export ────────────────────────────────────────────────────────────────────

def match_section(meta, story):
    template_ids, class_ids = id_by_uuid(story, 'characterTemplates'), id_by_uuid(story, 'classes')
    trait_ids = id_by_uuid(story, 'traits')
    difficulty = id_by_uuid(story, 'difficulties').get(meta.get('difficultyUuid'))
    return {
        'uuid': meta.get('uuid'), 'name': meta.get('name'), 'difficultyId': difficulty,
        'expCost': lng(meta.get('expCost')), 'rngSeed': lng(meta.get('rngSeed')),
        'singlePlayer': None if meta.get('singlePlayer') is None else boolean(meta.get('singlePlayer')),
        'loadout': {'characterTemplateId': template_ids.get(meta.get('characterTemplateUuid')),
                    'classId': class_ids.get(meta.get('classUuid')),
                    'traitIds': [trait_ids[t] for t in items(meta.get('traitUuids')) if t in trait_ids]},
        'creatorUserUuid': meta.get('userCreatorUuid'), 'clock': nz(meta.get('currentClock')),
        'status': meta.get('status'), 'currentWeatherId': positive(meta.get('currentWeatherId')),
        'activeCharacterUuid': meta.get('activeCharacterUuid'),
        'partyLocationId': positive(meta.get('currentLocationId')),
        'timestampStart': ts(meta.get('timestampStartMs')), 'createdAt': ts(meta.get('tsInsert')),
    }


def character_section(c, story):
    template_ids, class_ids = id_by_uuid(story, 'characterTemplates'), id_by_uuid(story, 'classes')
    trait_ids = id_by_uuid(story, 'traits')
    out = {'uuid': c.get('uuid'), 'ordinal': lng(c.get('id')), 'userUuid': c.get('userUuid'),
           'characterTemplateId': positive(c.get('idCharacterTemplate')) or template_ids.get(c.get('characterTemplateUuid')),
           'classId': class_ids.get(c.get('classUuid')) or positive(c.get('classId'))}
    for name in STATS:
        out[name] = lng(c.get(name))
    out.update({
        'locationId': positive(c.get('idLocation')), 'isSleeping': boolean(c.get('isSleeping')),
        'isComa': boolean(c.get('isComa')), 'clockInComa': lng(c.get('clockInComa')),
        'characteristics': [str(v) for v in items(c.get('characteristics'))],
        'resources': {r: nz(c.get(r)) for r in ('food', 'magic', 'coin')},
        'traits': [{'traitId': trait_ids[t]} for t in items(c.get('traitUuids')) if t in trait_ids],
        'items': [{'itemId': lng(i.get('idItem')), 'amount': lng(i.get('amount')), 'state': i.get('state')}
                  for i in items(c.get('items')) if isinstance(i, dict)],
    })
    return out


def registry_section(r, uuid_by_ordinal):
    return {'key': r.get('key'), 'stringValue': r.get('stringValue'), 'intValue': lng(r.get('intValue')),
            'multiValue': None if r.get('multiValue') is None else boolean(r.get('multiValue')),
            'characterUuid': uuid_by_ordinal.get(lng(r.get('idCharacter'))), 'eventId': positive(r.get('idEvent')),
            'choiceId': positive(r.get('idChoice')), 'clock': lng(r.get('clock')),
            'missionId': positive(r.get('idMission')), 'missionStepId': positive(r.get('idMissionSteps'))}


def location_section(ls):
    return {'locationId': lng(ls.get('idLocation')), 'flagAlreadyActivated': boolean(ls.get('flagAlreadyActived')),
            'flagVisited': boolean(ls.get('flagVisited')), 'clockCounter': lng(ls.get('clockCounter'))}


def turn_section(t):
    return {'characterUuid': t.get('characterUuid'), 'clock': nz(t.get('clock')),
            'status': t.get('status') or 'WAITING', 'priority': nz(t.get('priority')),
            'passCounter': lng(t.get('passCounter')), 'timestampStart': ts(t.get('timestampStart')),
            'timestampEnd': ts(t.get('timestampEnd'))}


def user_section(u):
    state = lng(u.get('state'))
    return {'uuid': u.get('uuid'), 'username': u.get('username'), 'nickname': u.get('nickname'),
            'language': u.get('language'), 'state': state, 'guest': bool(u.get('is_guest')) or state == 6,
            'role': u.get('role'), 'emailAddress': u.get('emailAddress') or u.get('email')}


def log_section(row):
    """A LOG# row (or an AUDIT# OTHER row) as a neutral entry, without seq."""
    type_ = row.get('type') if row.get('type') in LOG_TYPES else 'OTHER'
    entry = {'type': type_, 'clock': lng(row.get('clock')),
             'timestamp': ts(row.get('timestampMs')) or ts(row.get('timestamp')),
             'characterUuid': row.get('characterUuid'), 'eventId': positive(row.get('idEvent')),
             'choiceId': positive(row.get('idChoice') if row.get('idChoice') is not None else row.get('idChoise')),
             'locationFromId': positive(row.get('idLocationFrom')), 'locationToId': positive(row.get('idLocationTo')),
             'weatherId': positive(row.get('idWeather')), 'itemId': positive(row.get('idItem')),
             'itemAction': row.get('itemAction') if row.get('itemAction') in ('ADD', 'USE', 'DROP', 'REMOVE') else None,
             'counter': lng(row.get('counter')), 'effects': row.get('effects') if isinstance(row.get('effects'), str) else None,
             'message': None if row.get('message') is None else str(row.get('message'))}
    cost = {r: nz(row.get(f'{r}Cost')) for r in RESOURCES if row.get(f'{r}Cost') is not None}
    gain = {r: nz(row.get(f'{r}Gain')) for r in RESOURCES if row.get(f'{r}Gain') is not None}
    entry['cost'] = cost or None
    entry['gain'] = gain or None
    return entry


# ── import ────────────────────────────────────────────────────────────────────

def reconcile_markers(markers):
    """engine.eventMarkers as METADATA: eventMarkers dict and executedEventIds."""
    out, executed = {}, []
    for m in items(markers):
        event = lng(mapping(m).get('eventId'))
        if event is None:
            continue
        out[str(event)] = {'executed': nz(m.get('executed')), 'selected': nz(m.get('selected'))}
        if nz(m.get('executed')) > 0:
            executed.append(event)
    return out, executed


def location_item(match_uuid, neutral):
    loc = lng(neutral.get('locationId'))
    return {'idLocation': loc, 'uuid': str(uuid_lib.uuid5(uuid_lib.NAMESPACE_OID, f'{match_uuid}#{loc}')),
            'flagAlreadyActived': 1 if boolean(neutral.get('flagAlreadyActivated')) else 0,
            'flagVisited': 1 if boolean(neutral.get('flagVisited')) else 0, 'clockCounter': nz(neutral.get('clockCounter'))}


def registry_item(r, n, ordinal_by_uuid):
    return {'id': n, 'uuid': str(uuid_lib.uuid4()), 'key': r.get('key'), 'stringValue': r.get('stringValue'),
            'intValue': lng(r.get('intValue')), 'multiValue': 1 if boolean(r.get('multiValue')) else 0,
            'idCharacter': ordinal_by_uuid.get(r.get('characterUuid')), 'idEvent': lng(r.get('eventId')),
            'idChoice': lng(r.get('choiceId')), 'clock': lng(r.get('clock')), 'idMission': lng(r.get('missionId')),
            'idMissionSteps': lng(r.get('missionStepId'))}


def character_item(pk, match_uuid, c, story):
    template_uuids, class_uuids = uuid_by_id(story, 'characterTemplates'), uuid_by_id(story, 'classes')
    trait_uuids, location_uuids = uuid_by_id(story, 'traits'), uuid_by_id(story, 'locations')
    res = mapping(c.get('resources'))
    item = {'PK': pk, 'SK': f"CHARACTER#{c['uuid']}", 'id': lng(c.get('ordinal')), 'uuid': c['uuid'],
            'matchUuid': match_uuid, 'userUuid': c.get('userUuid'),
            'idCharacterTemplate': lng(c.get('characterTemplateId')),
            'characterTemplateUuid': template_uuids.get(lng(c.get('characterTemplateId'))),
            'classUuid': class_uuids.get(lng(c.get('classId'))), 'classId': lng(c.get('classId'))}
    for name in STATS:
        item[name] = nz(c.get(name)) if c.get(name) is not None else (
            1 if name in ('dexterity', 'intelligence', 'constitution', 'life') else 0)
    item.update({
        'idLocation': lng(c.get('locationId')), 'locationUuid': location_uuids.get(lng(c.get('locationId'))),
        'isSleeping': 1 if boolean(c.get('isSleeping')) else 0, 'isComa': 1 if boolean(c.get('isComa')) else 0,
        'clockInComa': nz(c.get('clockInComa')), 'characteristics': [str(v) for v in items(c.get('characteristics'))],
        'traitUuids': [trait_uuids[lng(t.get('traitId'))] for t in items(c.get('traits'))
                       if lng(mapping(t).get('traitId')) in trait_uuids],
        'items': [{'uuid': str(uuid_lib.uuid4()), 'idItem': lng(i.get('itemId')),
                   'amount': 1 if i.get('amount') is None else lng(i.get('amount')), 'state': i.get('state')}
                  for i in items(c.get('items'))],
        'food': nz(res.get('food')), 'magic': nz(res.get('magic')), 'coin': nz(res.get('coin')),
    })
    return item


def turn_item(pk, t, ordinal_by_uuid):
    return {'PK': pk, 'SK': f"TURN#{t['characterUuid']}", 'idCharacter': ordinal_by_uuid.get(t['characterUuid']),
            'characterUuid': t['characterUuid'], 'priority': nz(t.get('priority')), 'clock': nz(t.get('clock')),
            'status': t.get('status'), 'passCounter': nz(t.get('passCounter')),
            'timestampStart': t.get('timestampStart'), 'timestampEnd': t.get('timestampEnd')}


def log_item(entry, fallback_ms):
    """A neutral entry as the LOG# row fields (no PK/SK) in the shape logbook.append writes."""
    ms = epoch_ms(entry.get('timestamp'))
    ms = fallback_ms if ms is None else ms
    row = {'type': entry.get('type'), 'clock': lng(entry.get('clock')), 'timestamp': ms_to_iso(ms), 'timestampMs': ms}
    cost, gain = mapping(entry.get('cost')), mapping(entry.get('gain'))
    for r in RESOURCES:
        row[f'{r}Cost'] = nz(cost.get(r))
        row[f'{r}Gain'] = nz(gain.get(r))
    for source, target in (('characterUuid', 'characterUuid'), ('eventId', 'idEvent'), ('choiceId', 'idChoice'),
                           ('locationFromId', 'idLocationFrom'), ('locationToId', 'idLocationTo'),
                           ('weatherId', 'idWeather'), ('itemId', 'idItem'), ('itemAction', 'itemAction'),
                           ('counter', 'counter'), ('effects', 'effects'), ('message', 'message')):
        if entry.get(source) is not None:
            row[target] = entry[source]
    return row
