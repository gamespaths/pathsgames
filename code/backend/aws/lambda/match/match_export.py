"""v0.41.4 Step 41 H — match export and import on AWS (neutral format v1, decisions 45-66): export = pause,
latest SNAPSHOT#, file, restore, EXPORTED row, resume; import = check, story, users, partition, snapshot, time-start."""
import copy
import json
import os
import time

from common import db_utils
from common import story_cache
from common import test_data_ttl
from match import logbook
from match import neutral
from match import repo
from match import snapshots
from story import exporter as story_exporter
from story import importer as story_importer

BACKEND = 'aws'
MODES = ('AUTO', 'KEEP', 'REPLACE')
MAPPED = 'MAPPED_BY_EMAIL'
_CONFLICTS = ('MATCH_EXISTS', 'STORY_DIFFERS', 'CHARACTER_EXISTS')
STORY_LISTS = {'difficulty': 'difficulties', 'location': 'locations', 'template': 'characterTemplates',
               'class': 'classes', 'trait': 'traits', 'item': 'items', 'event': 'events', 'choice': 'choices',
               'mission': 'missions', 'mission step': 'missionSteps', 'weather': 'weatherRules'}
# DynamoDB BatchWriteItem takes 25 items per call (the import's writes land in ceil(n / 25) calls).
BATCH = 25


def max_bytes():
    """MATCH_EXPORT_MAX_BYTES (default 5000000)."""
    try:
        return int(os.environ.get('MATCH_EXPORT_MAX_BYTES', '5000000') or 5000000)
    except ValueError:
        return 5000000


def app_version():
    return os.environ.get('APP_VERSION') or 'unknown'


def server_name():
    return os.environ.get('ENV', 'dev')


def _h():
    from match import handler
    return handler


def _error(status, code, message, errors=None):
    body = {'error': code, 'message': message, 'timestamp': int(time.time() * 1000)}
    if errors:
        body['errors'] = errors
    return {'statusCode': status, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps(body)}


def _issue(code, message):
    return {'code': code, 'message': message}


# ── export ────────────────────────────────────────────────────────────────────

def export_match(match_uuid):
    """POST /api/admin/matches/{uuid}/export — the neutral file as an attachment (decisions 45, 58)."""
    h = _h()
    match = repo.match(match_uuid) if match_uuid else None
    if match is None:
        return _error(404, 'MATCH_NOT_FOUND', f'Match not found: {match_uuid}')
    rows = snapshots.items(match_uuid)
    if match.get('status') == 'CREATED' or not rows:
        return _error(409, 'NO_SNAPSHOT', 'The match has no time-end snapshot to export')
    latest = rows[0]
    original = match.get('status')
    running = original == 'RUNNING'
    if running:
        match['status'] = 'PAUSED'
    errors = h._verify_snapshot(match, match_uuid, latest)
    if errors:
        match['status'] = original
        return _error(409, 'SNAPSHOT_INTEGRITY_FAILED', 'The snapshot failed its integrity check', errors)
    document = build(match_uuid, latest, snapshots.with_current_owner(match, match_uuid, snapshots.payload_of(latest)))
    text = neutral.canonical(document)
    if len(text.encode('utf-8')) > max_bytes():
        match['status'] = original
        return _error(413, 'EXPORT_TOO_LARGE', f'The export is larger than {max_bytes()} bytes')
    clock = neutral.nz(latest.get('clock'))
    if original not in h.TERMINAL_STATUSES:
        h._restore_to(match, match_uuid, latest)
        logbook.append(match, h.TYPE_ADMIN_ACTION, neutral.nz(match.get('currentClock')),
                       message=f'EXPORTED clock={clock}')
        logbook.persist(match)
        if running:
            h._update_match(match_uuid, 'RUNNING', None, h.ADMIN_RESUME)
    return {'statusCode': 200, 'body': text,
            'headers': {'Content-Type': 'application/json',
                        'Content-Disposition': f'attachment; filename=match-{match_uuid[:8]}-clock-{clock}.json'}}


def _audit_rows(match_uuid, seq):
    out = []
    for item in db_utils.query_sk_prefix(f'MATCH#{match_uuid}', logbook.AUDIT_PREFIX, consistent=False) or []:
        if snapshots._seq_of(item.get('SK')) <= seq:
            out += [r for r in (item.get('rows') or []) if isinstance(r, dict)]
    return out


def build(match_uuid, item, payload):
    """The neutral document of one SNAPSHOT# row: payload, LOG#/AUDIT# up to its logSeq, users, story."""
    payload = payload or {}
    meta = neutral.mapping(payload.get('metadata'))
    story_item = _h()._load_story(payload.get('storyUuid') or meta.get('storyUuid')) or {}
    story_data = story_exporter.export_story_item(story_item) or {}
    seq = neutral.nz(payload.get('logSeq'))
    characters = sorted([c for c in payload.get('characters') or [] if isinstance(c, dict)],
                        key=lambda c: neutral.nz(c.get('id')))
    uuid_by_ordinal = {neutral.lng(c.get('id')): c.get('uuid') for c in characters}
    logs = [r for r in db_utils.query_sk_prefix(f'MATCH#{match_uuid}', logbook.LOG_PREFIX, consistent=False) or []
            if snapshots._seq_of(r.get('SK')) <= seq]
    audits = _audit_rows(match_uuid, seq)
    entries = [(neutral.log_section(r), str(r.get('SK'))) for r in logs]
    entries += [(neutral.log_section(dict(r, type='OTHER')), f"~{i:06d}") for i, r in enumerate(audits)
                if r.get('kind') == 'OTHER']
    entries.sort(key=lambda e: (e[0].get('timestamp') or '', e[1]))
    user_uuids = []
    for u in [meta.get('userCreatorUuid')] + [c.get('userUuid') for c in characters]:
        if u and u not in user_uuids:
            user_uuids.append(u)
    users = [db_utils.get_item(f'USER#{u}', consistent=False) for u in user_uuids]
    markers = neutral.mapping(meta.get('eventMarkers'))
    document = {
        'format': neutral.FORMAT, 'formatVersion': neutral.FORMAT_VERSION,
        'source': {'backend': BACKEND, 'dialect': 'dynamodb', 'appVersion': app_version(), 'server': server_name(),
                   'exportedAt': neutral.ms_to_iso(logbook.ts_ms()), 'snapshotUuid': item.get('uuid'),
                   'snapshotClock': neutral.nz(item.get('clock'))},
        'story': {'uuid': story_item.get('uuid') or payload.get('storyUuid'), 'title': _title(story_data),
                  'fingerprint': fingerprint(story_data), 'data': story_data},
        'users': [neutral.user_section(u) for u in users if u],
        'match': neutral.match_section(meta, story_item),
        'characters': [neutral.character_section(c, story_item) for c in characters],
        'state': {
            'registry': [neutral.registry_section(r, uuid_by_ordinal) for r in meta.get('registry') or []
                         if isinstance(r, dict)],
            'locations': [neutral.location_section(ls) for ls in sorted(
                [x for x in meta.get('locations') or [] if isinstance(x, dict)],
                key=lambda x: neutral.nz(x.get('idLocation')))],
            'turns': [neutral.turn_section(t) for t in sorted(
                [t for t in payload.get('turns') or [] if isinstance(t, dict)],
                key=lambda t: neutral.nz(t.get('idCharacter')))],
            'storyProgress': [{'clock': neutral.lng(r.get('clock')), 'eventId': neutral.positive(r.get('idEvent')),
                               'choiceId': neutral.positive(r.get('idChoise'))}
                              for r in audits if r.get('kind') == 'STORY_PROGRESS'],
            'choiceHistory': [{'clock': neutral.lng(r.get('clock')), 'eventId': neutral.positive(r.get('idEvent')),
                               'choiceId': neutral.positive(r.get('idChoise')), 'message': r.get('message'),
                               'timestamp': neutral.ts(r.get('timestampMs')) or neutral.ts(r.get('timestamp'))}
                              for r in audits if r.get('kind') == 'CHOICE_HISTORY'],
        },
        'engine': {'eventMarkers': [{'eventId': int(k), 'executed': neutral.nz(v.get('executed')),
                                     'selected': neutral.nz(v.get('selected'))}
                                    for k, v in sorted(markers.items(), key=lambda kv: neutral.nz(kv[0]))
                                    if neutral.lng(k) is not None and isinstance(v, dict)],
                   'visitedLocationIds': logbook.visited_location_ids(meta)},
        'logs': [dict({'seq': n}, **e[0]) for n, e in enumerate(entries, start=1)],
    }
    document = neutral.drop_nulls(document)
    document['checksum'] = neutral.sha256(document)
    return document


def _title(data):
    wanted, fallback = neutral.lng(data.get('idTextTitle')), None
    for t in neutral.items(data.get('texts')):
        if wanted is not None and neutral.lng(t.get('idText')) == wanted:
            value = t.get('shortText') if t.get('shortText') is not None else t.get('longText')
            if t.get('lang') == 'en':
                return value
            fallback = fallback if fallback is not None else value
    return fallback


# ── story fingerprint (H.2.6) ─────────────────────────────────────────────────

_DROPPED = frozenset(('uuid', 'tsInsert', 'tsUpdate', 'idStory'))


def _rank(value):
    if value is None:
        return (0, 0)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return (1, value)
    if isinstance(value, bool):
        return (2, 'true' if value else 'false')
    return (2, str(value))


def _project(value):
    if isinstance(value, dict):
        return {k: _project(v) for k, v in value.items() if v is not None and k not in _DROPPED}
    if isinstance(value, list):
        out = [_project(v) for v in value]
        if all(isinstance(v, dict) for v in out):
            out.sort(key=lambda r: tuple(_rank(r.get(k)) for k in ('id', 'idText', 'lang')) + (neutral.canonical(r),))
        return out
    return value


def fingerprint(story_data):
    root = _project(neutral.drop_nulls(story_data or {}))
    root.pop('id', None)
    return neutral.sha256(root)


# ── import ────────────────────────────────────────────────────────────────────

class Analysis:
    def __init__(self):
        self.doc = None
        self.errors, self.warnings = [], []
        self.match_exists = False
        self.story_status = self.story_action = None
        self.matches_deleted = 0
        self.bundled = {}
        self.target_story = None
        self.users = []          # (user, status, target username, target uuid)
        self.active_matches = []
        self.wanted_markers = None


def analyze(request):
    a = Analysis()
    export = (request or {}).get('export')
    if not isinstance(export, dict):
        a.errors.append(_issue('SCHEMA_INVALID', 'export must be a match export object'))
        return a, None
    a.doc = export
    if neutral.size(export) > max_bytes():
        return a, _error(413, 'IMPORT_TOO_LARGE', f'The export is larger than {max_bytes()} bytes')
    if not _readable(a):
        return a, None
    raw = request.get('storyMode')
    mode = 'AUTO' if raw is None else str(raw).strip().upper()
    if mode not in MODES:
        a.errors.append(_issue('SCHEMA_INVALID', 'storyMode must be AUTO, KEEP or REPLACE'))
        return a, None
    source = neutral.mapping(export.get('source'))
    if source.get('appVersion') != app_version():
        a.warnings.append(_issue('APP_VERSION_DIFFERS',
                                 f"Exported by {source.get('appVersion')}, this server runs {app_version()}"))
    if source.get('backend') != BACKEND:
        a.warnings.append(_issue('CROSS_FAMILY', f"Exported by the {source.get('backend')} backend: the time-start "
                                                 'after the import may roll other weather or random events'))
    _story(a, mode)
    _users(a)
    _match(a, request.get('replace') is True)
    _engine(a)
    return a, None


def _readable(a):
    doc = a.doc
    version = doc.get('formatVersion')
    if doc.get('format') != neutral.FORMAT or isinstance(version, bool) or version != neutral.FORMAT_VERSION:
        a.errors.append(_issue('FORMAT_UNKNOWN', f"Unknown format {doc.get('format')} version {version}"))
        return False
    a.errors += [_issue('SCHEMA_INVALID', p) for p in neutral.SchemaValidator.match_export_v1().validate(doc)]
    if a.errors:
        return False
    if neutral.sha256({k: v for k, v in doc.items() if k != 'checksum'}) != doc.get('checksum'):
        a.errors.append(_issue('CHECKSUM_MISMATCH', 'The file does not match its checksum'))
        return False
    _references(a)
    return not a.errors


def _references(a):
    def ref(message):
        a.errors.append(_issue('REFERENCE_INVALID', message))

    users = {u.get('uuid') for u in neutral.items(a.doc.get('users'))}
    chars, ordinals = set(), set()
    for c in neutral.items(a.doc.get('characters')):
        if c.get('uuid') in chars:
            ref(f"character {c.get('uuid')} is listed twice")
        chars.add(c.get('uuid'))
        if c.get('ordinal') in ordinals:
            ref(f"ordinal {c.get('ordinal')} is used twice")
        ordinals.add(c.get('ordinal'))
        if c.get('userUuid') not in users:
            ref(f"user {c.get('userUuid')} of character {c.get('uuid')} is not in users")
    match = neutral.mapping(a.doc.get('match'))
    if match.get('creatorUserUuid') not in users:
        ref(f"creator {match.get('creatorUserUuid')} is not in users")

    def check(uuid, where):
        if uuid is not None and uuid not in chars:
            ref(f'{where} names an unknown character {uuid}')

    check(match.get('activeCharacterUuid'), 'match.activeCharacterUuid')
    state = neutral.mapping(a.doc.get('state'))
    for r in neutral.items(state.get('registry')):
        check(r.get('characterUuid'), 'registry')
    turns = set()
    for t in neutral.items(state.get('turns')):
        check(t.get('characterUuid'), 'turns')
        if t.get('characterUuid') in turns:
            ref(f"character {t.get('characterUuid')} has two turns")
        turns.add(t.get('characterUuid'))
    for e in neutral.items(a.doc.get('logs')):
        check(e.get('characterUuid'), 'logs')


def _validate_bundled(a):
    from story import story_validator
    bundled = _story_for_import(a.bundled)
    errors = story_validator.validate_story_uuid(bundled) + story_validator.validate_story_dict(bundled)
    if errors:
        rules = ', '.join(dict.fromkeys(str(e.get('rule') or e.get('code')) for e in errors))
        a.errors.append(_issue('STORY_INVALID', f'The bundled story is refused: {rules}'))


def _story_for_import(data):
    out = neutral.drop_nulls(copy.deepcopy(data))
    out.pop('id', None)
    return out


def _story(a, mode):
    story = neutral.mapping(a.doc.get('story'))
    uuid = story.get('uuid')
    a.bundled = neutral.mapping(story.get('data'))
    existing = _h()._load_story(uuid)
    used = None
    if existing is None:
        a.story_status, a.story_action = 'ABSENT', 'IMPORT'
        _validate_bundled(a)
        used = a.bundled
    else:
        target = story_exporter.export_story_item(existing)
        same = fingerprint(target) == story.get('fingerprint')
        a.story_status = 'SAME' if same else 'DIFFERENT'
        if same or mode == 'KEEP':
            a.story_action, used = ('USE_EXISTING' if same else 'KEEP'), target
        elif mode == 'REPLACE':
            # AWS keeps the matches of a re-imported story (only the STORY# partition is replaced).
            a.story_action, a.matches_deleted = 'REPLACE', 0
            a.warnings.append(_issue('STORY_MATCHES_DELETED', f'0 match(es) of story {uuid} are deleted by the '
                                                              'story re-import (AWS keeps them)'))
            _validate_bundled(a)
            used = a.bundled
        else:
            a.story_action = 'AUTO'
            a.errors.append(_issue('STORY_DIFFERS', f'Story {uuid} exists on this server with other content: '
                                                    'choose storyMode KEEP or REPLACE'))
    if used is not None:
        _story_entities(a, used)


def _story_entities(a, story):
    index = {label: {neutral.lng(r.get('id')) if r.get('id') is not None else neutral.lng(r.get('id_tipo'))
                     for r in neutral.items(story.get(key)) if isinstance(r, dict)}
             for label, key in STORY_LISTS.items()}
    missing = set()

    def need(label, value):
        ident = neutral.lng(value)
        if ident is not None and ident not in index[label]:
            missing.add(f'{label} {ident}')

    match = neutral.mapping(a.doc.get('match'))
    loadout = neutral.mapping(match.get('loadout'))
    need('difficulty', match.get('difficultyId'))
    need('template', loadout.get('characterTemplateId'))
    need('class', loadout.get('classId'))
    for t in neutral.items(loadout.get('traitIds')):
        need('trait', t)
    need('weather', match.get('currentWeatherId'))
    need('location', match.get('partyLocationId'))
    for c in neutral.items(a.doc.get('characters')):
        need('template', c.get('characterTemplateId'))
        need('class', c.get('classId'))
        need('location', c.get('locationId'))
        for t in neutral.items(c.get('traits')):
            need('trait', t.get('traitId'))
            need('event', t.get('eventId'))
        for i in neutral.items(c.get('items')):
            need('item', i.get('itemId'))
    state = neutral.mapping(a.doc.get('state'))
    for r in neutral.items(state.get('registry')):
        need('event', r.get('eventId'))
        need('choice', r.get('choiceId'))
        need('mission', r.get('missionId'))
        need('mission step', r.get('missionStepId'))
    for loc in neutral.items(state.get('locations')):
        need('location', loc.get('locationId'))
    for section in ('storyProgress', 'choiceHistory'):
        for row in neutral.items(state.get(section)):
            need('event', row.get('eventId'))
            need('choice', row.get('choiceId'))
    engine = neutral.mapping(a.doc.get('engine'))
    for m in neutral.items(engine.get('eventMarkers')):
        need('event', m.get('eventId'))
    for loc in neutral.items(engine.get('visitedLocationIds')):
        need('location', loc)
    a.errors += [_issue('STORY_ENTITY_MISSING', f'{m} is not in the story') for m in sorted(missing)]


def _users(a):
    """Existing uuid → EXISTING; else a known email → MAPPED_BY_EMAIL (Scan); else NEW (no username index)."""
    existing = []
    for u in neutral.items(a.doc.get('users')):
        if db_utils.get_item(f"USER#{u.get('uuid')}", consistent=False) is not None:
            a.users.append((u, 'EXISTING', u.get('username'), u.get('uuid')))
            existing.append(u.get('uuid'))
            continue
        target = db_utils.find_user_by_email(u.get('emailAddress')) if u.get('emailAddress') else None
        if target is not None:
            a.users.append((u, MAPPED, target.get('username'), target.get('uuid')))
            existing.append(target.get('uuid'))
            a.warnings.append(_issue('USER_MAPPED_BY_EMAIL', f"User {u.get('username')} is mapped by e-mail "
                                                             f"onto {target.get('username')}"))
            continue
        a.users.append((u, 'NEW', u.get('username'), u.get('uuid')))
        if str(u.get('role') or '').upper() == 'ADMIN':
            a.warnings.append(_issue('ROLE_DOWNGRADED', f"User {u.get('username')} is created as PLAYER"))
    story_uuid = neutral.mapping(a.doc.get('story')).get('uuid')
    match_uuid = neutral.mapping(a.doc.get('match')).get('uuid')
    for user_uuid in existing:
        for m in db_utils.query_gsi('GSI1', f'USER_MATCHES#{user_uuid}') or []:
            if m.get('storyUuid') == story_uuid and m.get('status') in ('CREATED', 'RUNNING') \
                    and m.get('uuid') != match_uuid:
                a.active_matches.append({'uuid': m.get('uuid'), 'status': m.get('status')})
    if a.active_matches:
        names = ', '.join(f"{m['uuid']} ({m['status']})" for m in a.active_matches)
        a.warnings.append(_issue('USER_HAS_ACTIVE_MATCH',
                                 f'These matches of the same story are set to PAUSED by the import: {names}'))


def _match(a, replace):
    match_uuid = neutral.mapping(a.doc.get('match')).get('uuid')
    a.match_exists = repo.match(match_uuid, consistent=False) is not None
    if a.match_exists and not replace:
        a.errors.append(_issue('MATCH_EXISTS', f'Match {match_uuid} already exists on this server: use replace=true'))


def _engine(a):
    engine = neutral.mapping(a.doc.get('engine'))
    a.wanted_markers = neutral.reconcile_markers(engine.get('eventMarkers'))


def check_body(a):
    source = neutral.mapping((a.doc or {}).get('source'))
    return {'valid': not a.errors, 'errors': a.errors, 'warnings': a.warnings,
            'source': {k: source.get(k) for k in ('backend', 'dialect', 'appVersion', 'server', 'snapshotClock')},
            'matchExists': a.match_exists,
            'story': {'uuid': neutral.mapping((a.doc or {}).get('story')).get('uuid'), 'status': a.story_status,
                      'action': a.story_action, 'matchesDeleted': a.matches_deleted},
            'users': [{'uuid': u.get('uuid'), 'username': u.get('username'), 'targetUsername': target,
                       'targetUuid': target_uuid, 'status': status} for u, status, target, target_uuid in a.users]}


def refusal(errors):
    """409 with the conflict code when only conflicts are left, 422 IMPORT_INVALID otherwise."""
    if all(e['code'] in _CONFLICTS for e in errors):
        return _error(409, errors[0]['code'], errors[0]['message'], errors)
    return _error(422, 'IMPORT_INVALID', 'The match export cannot be imported', errors)


def import_match(body):
    """POST /api/admin/matches/import — dryRun answers the check; otherwise 201 with the import."""
    a, early = analyze(body)
    if early is not None:
        return early
    if body.get('dryRun') is True:
        return {'statusCode': 200, 'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(check_body(a), default=str)}
    if a.errors:
        return refusal(a.errors)
    doc = a.doc
    story_uuid = neutral.mapping(doc.get('story')).get('uuid')
    if a.story_action in ('IMPORT', 'REPLACE'):
        answer = story_importer.import_story_data(_story_for_import(a.bundled))
        if neutral.nz(answer.get('statusCode')) >= 300:
            return _error(422, 'IMPORT_INVALID', 'The bundled story was refused',
                          [_issue('STORY_INVALID', str(answer.get('body')))])
        story_cache.clear()
    story = _h()._load_story(story_uuid) or {}
    created = []
    try:
        result = _write(a, story, body, created)
    except ImportTimeStartFailed as exc:
        return _error(500, 'IMPORT_TIME_START_FAILED',
                      f'The match was imported (PAUSED) but its time-start failed: {exc}')
    except Exception:
        repo.delete_partition(f"MATCH#{neutral.mapping(doc.get('match')).get('uuid')}")
        for user_uuid in created:
            db_utils.delete_item(f'USER#{user_uuid}')
        raise
    return {'statusCode': 201, 'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(result, default=str)}


def _write(a, story, body, created):
    h = _h()
    doc = a.doc
    m = neutral.mapping(doc.get('match'))
    match_uuid = m['uuid']
    pk = f'MATCH#{match_uuid}'
    if a.match_exists:
        repo.delete_partition(pk)
    now_ms = logbook.ts_ms()
    target_of = {u.get('uuid'): target_uuid for u, _s, _t, target_uuid in a.users}
    for u, status, _target, _uuid in a.users:
        if status != 'NEW':
            continue
        created.append(u['uuid'])
        db_utils.put_item(_user_item(u, now_ms))
    created_ms = neutral.epoch_ms(m.get('createdAt')) or now_ms
    location_uuids = neutral.uuid_by_id(story, 'locations')
    ordinal_by_uuid = {c['uuid']: neutral.lng(c.get('ordinal')) for c in neutral.items(doc.get('characters'))}
    characters = [dict(c, userUuid=target_of.get(c.get('userUuid'), c.get('userUuid')))
                  for c in neutral.items(doc.get('characters'))]
    creator = target_of.get(m.get('creatorUserUuid'), m.get('creatorUserUuid'))
    party = neutral.lng(m.get('partyLocationId'))
    if party is None:
        first = min(characters, key=lambda c: neutral.nz(c.get('ordinal')))
        party = neutral.lng(first.get('locationId'))
    markers, executed = a.wanted_markers
    state = neutral.mapping(doc.get('state'))
    engine = neutral.mapping(doc.get('engine'))
    difficulties = neutral.uuid_by_id(story, 'difficulties')
    loadout = neutral.mapping(m.get('loadout'))
    match = {
        'PK': pk, 'SK': 'METADATA', 'uuid': match_uuid, 'storyUuid': story.get('uuid'),
        'difficultyUuid': difficulties.get(neutral.lng(m.get('difficultyId'))), 'name': m.get('name'),
        'singlePlayer': 0 if m.get('singlePlayer') is False else 1,
        'characterTemplateUuid': neutral.uuid_by_id(story, 'characterTemplates').get(
            neutral.lng(loadout.get('characterTemplateId'))),
        'classUuid': neutral.uuid_by_id(story, 'classes').get(neutral.lng(loadout.get('classId'))),
        'traitUuids': [neutral.uuid_by_id(story, 'traits')[t] for t in neutral.items(loadout.get('traitIds'))
                       if t in neutral.uuid_by_id(story, 'traits')],
        'status': 'PAUSED', 'currentClock': neutral.nz(m.get('clock')), 'rngSeed': neutral.lng(m.get('rngSeed')),
        'currentWeatherId': neutral.lng(m.get('currentWeatherId')), 'logCount': 0, 'logSeq': 0,
        'executedEventIds': executed, 'eventMarkers': markers,
        'visitedLocationIds': [neutral.lng(v) for v in neutral.items(engine.get('visitedLocationIds'))],
        'expCost': neutral.nz(m.get('expCost')) if m.get('expCost') is not None else 5,
        'userCreatorUuid': creator, 'tsInsert': created_ms,
        'currentLocationId': party, 'currentLocationUuid': location_uuids.get(party),
        'activeCharacterUuid': m.get('activeCharacterUuid'),
        'locations': [neutral.location_item(match_uuid, ls) for ls in neutral.items(state.get('locations'))
                      if neutral.boolean(ls.get('flagAlreadyActivated')) or neutral.boolean(ls.get('flagVisited'))
                      or neutral.nz(ls.get('clockCounter')) != 0],
        'registry': [neutral.registry_item(r, n, ordinal_by_uuid)
                     for n, r in enumerate(neutral.items(state.get('registry')), start=1)],
        'GSI1_PK': f'USER_MATCHES#{creator}', 'GSI1_SK': f'MATCH#{created_ms:020d}#{match_uuid}',
        'GSI2_PK': 'MATCH', 'GSI2_SK': f'{created_ms:020d}#{match_uuid}',
    }
    start_ms = neutral.epoch_ms(m.get('timestampStart'))
    if start_ms is not None:
        match['timestampStartMs'] = start_ms
    expires_at = test_data_ttl.expiry() if test_data_ttl.is_robot_name(match['name']) else None
    if expires_at:
        match[test_data_ttl.TTL_ATTRIBUTE] = expires_at
    extra = {test_data_ttl.TTL_ATTRIBUTE: expires_at} if expires_at else {}
    repo.characters(match_uuid)
    repo.turns(match_uuid)
    for c in characters:
        repo.save({**neutral.character_item(pk, match_uuid, c, story), **extra})
    for t in neutral.items(state.get('turns')):
        repo.save({**neutral.turn_item(pk, t, ordinal_by_uuid), **extra})
    fallback_ms = neutral.epoch_ms(neutral.mapping(doc.get('source')).get('exportedAt')) or now_ms
    seq, log_count, audits = 0, 0, []
    for entry in neutral.items(doc.get('logs')):
        row = neutral.log_item(entry, fallback_ms)
        if entry.get('type') == 'OTHER':
            audits.append(dict(row, kind='OTHER'))
            continue
        seq += 1
        log_count += 1
        repo.save({'PK': pk, 'SK': f"LOG#{row['timestampMs']:013d}#{seq:06d}", **row, **extra})
        if entry.get('type') == 'CHOICE':
            audits.append({'kind': 'CHOICE_SELECTED', 'clock': row['clock'], 'timestamp': row['timestamp'],
                           'timestampMs': row['timestampMs'], 'characterUuid': entry.get('characterUuid'),
                           'idEvent': entry.get('eventId'), 'message': entry.get('message')})
    for kind, section in (('CHOICE_HISTORY', 'choiceHistory'), ('STORY_PROGRESS', 'storyProgress')):
        for r in neutral.items(state.get(section)):
            stamp = neutral.epoch_ms(r.get('timestamp')) or fallback_ms
            audits.append({'kind': kind, 'clock': neutral.lng(r.get('clock')), 'timestamp': neutral.ms_to_iso(stamp),
                           'timestampMs': stamp, 'idEvent': neutral.lng(r.get('eventId')),
                           'idChoise': neutral.lng(r.get('choiceId')), 'message': r.get('message')})
    if audits:
        seq += 1
        first = audits[0]
        repo.save({'PK': pk, 'SK': f"AUDIT#{neutral.nz(first.get('timestampMs')):013d}#{seq:06d}",
                   'clock': first.get('clock'), 'timestamp': first.get('timestamp'),
                   'timestampMs': first.get('timestampMs'), 'rows': audits, **extra})
    match['logSeq'], match['logCount'] = seq, log_count
    repo.save(match)
    match = repo.match(match_uuid)
    for other in a.active_matches:
        h._update_match(other['uuid'], 'PAUSED', None, h.ADMIN_PAUSE)
    clock = neutral.nz(m.get('clock'))
    server = neutral.mapping(doc.get('source')).get('server')
    logbook.append(match, h.TYPE_ADMIN_ACTION, clock, message=f'IMPORTED {server} clock={clock}')
    snapshot = snapshots.write_at_time_end(match, match_uuid, description=f'Imported at clock {clock}', force=True)
    try:
        h._advance_time(match, match_uuid, snapshot=False)
    except Exception as exc:  # noqa: BLE001 — the imported match stays, PAUSED
        match['status'] = 'PAUSED'
        logbook.persist(match)
        raise ImportTimeStartFailed(str(exc)) from exc
    status = 'PAUSED' if body.get('startPaused') is True else 'RUNNING'
    match['status'] = status
    logbook.persist(match)
    return {'status': 'IMPORTED', 'uuidMatch': match_uuid, 'snapshotClock': clock,
            'clock': neutral.nz(match.get('currentClock')), 'matchStatus': status,
            'uuidSnapshot': (snapshot or {}).get('uuid'), 'storyAction': a.story_action,
            'usersCreated': len(created), 'logsImported': log_count + len(audits), 'warnings': a.warnings}


class ImportTimeStartFailed(Exception):
    """The match was imported (PAUSED) but its time-start failed: 500 IMPORT_TIME_START_FAILED."""


def _user_item(u, now_ms):
    guest = bool(u.get('guest'))
    item = {'PK': f"USER#{u['uuid']}", 'SK': 'METADATA', 'uuid': u['uuid'], 'username': u.get('username'),
            'nickname': u.get('nickname'), 'language': u.get('language'), 'role': 'PLAYER',
            'state': neutral.lng(u.get('state')) if u.get('state') is not None else (6 if guest else 1),
            'email': u.get('emailAddress'), 'is_guest': guest, 'ts_registration': now_ms, 'ts_last_access': now_ms,
            'token_version': 0}
    if guest:
        item['GSI2_PK'], item['GSI2_SK'] = 'GUEST_LIST', f"USER#{u['uuid']}"
        item['summary'] = {k: item[k] for k in ('uuid', 'username', 'nickname', 'role', 'state', 'language',
                                                'ts_registration', 'ts_last_access') if item.get(k) is not None}
    return {k: v for k, v in item.items() if v is not None}
