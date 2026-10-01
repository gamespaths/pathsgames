"""v0.41.4 Step 41 H — match export/import on AWS: canonical vectors, schema, codecs (uuid ↔ id through the
story), the export sequence, the import (GSI keys, LOG# keys, logSeq/logCount, ttl, rollback, batches)."""
import copy
import json
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import pytest

from match import handler as h
from match import match_export as mx
from match import neutral
from match import repo
from story import exporter
from story import importer
from helpers import FakeTable, make_event, patch_table

FIXTURES = Path(__file__).parent / 'fixtures'
OPENAPI = (Path(__file__).resolve().parents[2] / 'java' / 'adapter-rest' / 'src' / 'main' / 'resources'
           / 'openapi' / 'match-export-v1.schema.json')
MATCH_UUID = '0a0a0a0a-0000-4000-8000-000000000009'
STORY_UUID = '51515151-0000-4000-8000-000000000009'
C1, C2 = 'c4c4c4c4-0000-4000-8000-000000000091', 'c4c4c4c4-0000-4000-8000-000000000092'
PLAYER_UUID, OTHER_UUID = '00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000043'
PK = f'MATCH#{MATCH_UUID}'
ADMIN_TOKEN = {'Authorization': 'Bearer admin'}
PLAYER = {'PK': f'USER#{PLAYER_UUID}', 'SK': 'METADATA', 'uuid': PLAYER_UUID, 'username': 'robottest_p',
          'role': 'PLAYER', 'state': 6, 'is_guest': True, 'guest_token': 'secret-token'}
OTHER = {'PK': f'USER#{OTHER_UUID}', 'SK': 'METADATA', 'uuid': OTHER_UUID, 'username': 'robottest_o',
         'role': 'ADMIN', 'state': 2}
ADMIN = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001', 'username': 'admin',
         'role': 'ADMIN', 'state': 2}


def _with_checksum(doc):
    doc['checksum'] = neutral.sha256({k: v for k, v in doc.items() if k != 'checksum'})
    return doc


def _sample():
    doc = json.loads((FIXTURES / 'match_export_sample.json').read_text(encoding='utf-8'))
    doc['story']['fingerprint'] = mx.fingerprint(doc['story']['data'])
    return _with_checksum(doc)


def _story():
    return {
        'PK': f'STORY#{STORY_UUID}', 'SK': 'METADATA', 'uuid': STORY_UUID, 'id': 9, 'idLocationStart': 1,
        'idTextTitle': 1, 'texts': {'en': {'title': 'RT'}},
        'raw_texts': [{'id': 1, 'idText': 1, 'lang': 'en', 'shortText': 'Round trip'}],
        'difficulties': [{'id': 1, 'uuid': 'd-9', 'energy': 0, 'expCost': 5}],
        'locations': [{'id': 1, 'uuid': 'loc-1', 'idCard': 1, 'costEnergyEnter': 0, 'maxCharacters': 10,
                       'secureParam': 1},
                      {'id': 2, 'uuid': 'loc-2', 'idCard': 2, 'costEnergyEnter': 0, 'maxCharacters': 10,
                       'secureParam': 0}],
        'locationNeighbors': [], 'events': [{'id': 13, 'uuid': 'ev-13', 'type': 'ONCE'}, {'id': 14, 'uuid': 'ev-14'}],
        'eventEffects': [], 'choices': [{'id': 7, 'uuid': 'ch-7'}], 'choiceEffects': [], 'choiceConditions': [],
        'items': [{'id': 5, 'uuid': 'itm-5'}], 'classes': [{'id': 1, 'uuid': 'cls-9'}],
        'characterTemplates': [{'id_tipo': 1, 'uuid': 'tpl-9'}], 'traits': [{'id': 1, 'uuid': 'trt-9'}],
        'missions': [{'id': 1, 'uuid': 'mi-1'}], 'missionSteps': [],
        'weatherRules': [{'id': 1, 'uuid': 'w-1', 'probability': 100, 'active': 1}],
        'raw_cards': [], 'keys': [],
    }


def _match(**over):
    base = {
        'PK': PK, 'SK': 'METADATA', 'uuid': MATCH_UUID, 'name': 'robottest_rt', 'status': 'RUNNING',
        'currentClock': 3, 'userCreatorUuid': PLAYER_UUID, 'storyUuid': STORY_UUID, 'difficultyUuid': 'd-9',
        'tsInsert': 1790244000000, 'rngSeed': 42, 'currentWeatherId': 1, 'currentLocationId': 2,
        'characterTemplateUuid': 'tpl-9', 'classUuid': 'cls-9', 'traitUuids': ['trt-9'], 'singlePlayer': 1,
        'activeCharacterUuid': C1, 'logCount': 0, 'logSeq': 0, 'expCost': 5,
        'GSI1_PK': f'USER_MATCHES#{PLAYER_UUID}', 'GSI1_SK': 'MATCH#1#x',
        'locations': [{'idLocation': 1, 'uuid': 'sl-1', 'flagAlreadyActived': 0, 'flagVisited': 1, 'clockCounter': 0},
                      {'idLocation': 2, 'uuid': 'sl-2', 'flagAlreadyActived': 1, 'flagVisited': 1, 'clockCounter': 3}],
        'registry': [{'id': 1, 'key': 'quest', 'stringValue': 'done', 'idEvent': 14, 'idMission': 1,
                      'idCharacter': 1, 'multiValue': 0}],
        'eventMarkers': {'13': {'executed': 1, 'selected': 0}, '14': {'executed': 1, 'selected': 1}},
        'executedEventIds': [13, 14], 'visitedLocationIds': [1, 2],
    }
    base.update(over)
    return base


def _char(uuid, cid, user, **over):
    base = {'PK': PK, 'SK': f'CHARACTER#{uuid}', 'id': cid, 'uuid': uuid, 'userUuid': user, 'idLocation': 2,
            'dexterity': 3, 'intelligence': 3, 'constitution': 3, 'life': 10, 'energy': 20, 'energyMax': 30,
            'lifeMax': 10, 'sadMax': 5, 'sad': 0, 'isSleeping': 0, 'isComa': 0, 'exp': 0, 'weightMax': 30,
            'food': 1, 'magic': 0, 'coin': 2, 'traitUuids': ['trt-9'], 'classUuid': 'cls-9',
            'characterTemplateUuid': 'tpl-9', 'idCharacterTemplate': 1, 'characteristics': ['brave'],
            'items': [{'uuid': 'inv-1', 'idItem': 5, 'amount': 1}]}
    base.update(over)
    return base


def _logs():
    rows = [('MATCH_LIFECYCLE', 0, {'message': 'CREATED'}), ('WEATHER', 1, {'idWeather': 1}),
            ('MOVEMENT', None, {'characterUuid': C1, 'idLocationFrom': 1, 'idLocationTo': 2, 'energyCost': 2}),
            ('EVENT', 1, {'characterUuid': C1, 'idEvent': 13, 'message': 'EVENT_EXECUTED 13'}),
            ('EVENT', 2, {'characterUuid': C1, 'idEvent': 14, 'message': 'EVENT_EXECUTED 14'}),
            ('CHOICE', 2, {'characterUuid': C1, 'idEvent': 14, 'message': 'CHOICE_SELECTED 14'}),
            ('ITEM_ADD', 2, {'characterUuid': C1, 'idItem': 5, 'itemAction': 'ADD', 'counter': 1, 'foodGain': 1})]
    out = []
    for seq, (type_, clock, fields) in enumerate(rows, start=1):
        ts = 1790244000000 + seq * 1000
        out.append({'PK': PK, 'SK': f'LOG#{ts:013d}#{seq:06d}', 'type': type_, 'clock': clock,
                    'timestamp': neutral.ms_to_iso(ts), 'timestampMs': ts, **fields})
    out.append({'PK': PK, 'SK': 'AUDIT#1790244007000#000008', 'rows': [
        {'kind': 'CHOICE_SELECTED', 'clock': 2, 'idEvent': 14},
        {'kind': 'CHOICE_HISTORY', 'clock': 2, 'idEvent': 14, 'idChoise': 7, 'message': 'CHOICE_SELECTED 7',
         'timestampMs': 1790244007000},
        {'kind': 'STORY_PROGRESS', 'clock': 2, 'idEvent': 14, 'idChoise': 7},
        {'kind': 'OTHER', 'clock': 2, 'message': 'free text', 'timestampMs': 1790244007500}]})
    return out


def _claims(token):
    return {'uuid': 'admin-uuid-001' if token == 'admin' else PLAYER_UUID}


@contextmanager
def _env(items, gsi=None):
    table = FakeTable([PLAYER, OTHER, ADMIN, *items])
    with patch('match.handler.jwt_utils.verify_access_token', side_effect=_claims), \
            patch('match.handler.db_utils.query_gsi', side_effect=lambda *a, **k: (gsi or {}).get(a[1], [])), \
            patch_table(table):
        yield table


def _seed():
    return [_story(), _match(logSeq=8, logCount=7), _char(C1, 1, PLAYER_UUID),
            _char(C2, 2, OTHER_UUID, characteristics=[], traitUuids=[], items=[], classUuid=None),
            {'PK': PK, 'SK': f'TURN#{C1}', 'idCharacter': 1, 'characterUuid': C1, 'priority': 2, 'clock': 3,
             'status': 'ACTIVE', 'passCounter': 0},
            {'PK': PK, 'SK': f'TURN#{C2}', 'idCharacter': 2, 'characterUuid': C2, 'priority': 1, 'clock': 3,
             'status': 'WAITING', 'passCounter': 0}, *_logs()]


def _call(method, path, body=None, params=None):
    return h.lambda_handler(make_event(method, path, body=body, headers=dict(ADMIN_TOKEN),
                                       path_params=params or {}), None)


def _snapshot(table):
    """The time-end snapshot of clock 3, written as the engine writes it."""
    repo.begin()
    match = repo.match(MATCH_UUID)
    h._snapshots.write_at_time_end(match, MATCH_UUID)
    repo.flush()


def _export(table):
    _snapshot(table)
    # An action after the snapshot: the export restore takes it away.
    table.put_item({'PK': PK, 'SK': 'LOG#1790244099000#000009', 'type': 'SLEEP', 'clock': 3,
                    'timestampMs': 1790244099000, 'characterUuid': C1})
    meta = table.get_item(PK)
    meta['logSeq'] = 9
    table.put_item(meta)
    return _call('POST', f'/api/admin/matches/{MATCH_UUID}/export', params={'uuidMatch': MATCH_UUID})


def _copy(doc, new_match, c1, c2, extra=()):
    text = neutral.canonical(doc).replace(MATCH_UUID, new_match).replace(C1, c1).replace(C2, c2)
    for old, new in extra:
        text = text.replace(old, new)
    return _with_checksum(json.loads(text))


def _import(body):
    return _call('POST', '/api/admin/matches/import', body=body)


# ── format ────────────────────────────────────────────────────────────────────

def test_shared_vectors_schema_copy_and_sample():
    vectors = json.loads((FIXTURES / 'match_export_canonical_vectors.json').read_text(encoding='utf-8'))['vectors']
    assert len(vectors) == 8
    for v in vectors:
        value = json.loads(v['input'])
        assert neutral.canonical(value) == v['canonical'], v['name']
        assert neutral.sha256(value) == v['sha256'], v['name']
    assert json.loads(neutral.SCHEMA_FILE.read_text()) == json.loads(OPENAPI.read_text())
    assert neutral.SchemaValidator.match_export_v1().validate(_sample()) == []


def test_schema_reports_every_kind_of_problem():
    validator = neutral.SchemaValidator.match_export_v1()
    doc = _sample()
    doc['format'] = 'other'
    doc['extra'] = 1
    del doc['logs']
    doc['match'].update({'uuid': 'NOT-A-UUID', 'difficultyId': 0, 'status': 'LOST', 'singlePlayer': 'yes'})
    doc['users'] = []
    doc['engine']['visitedLocationIds'] = [1, 1]
    text = '\n'.join(validator.validate(doc))
    for part in ('must be paths-games-match-export', 'unknown property extra', 'missing logs', 'does not match',
                 'must be >= 1', 'must be one of', 'must be boolean', 'needs at least 1 items',
                 'items are not unique'):
        assert part in text, part
    doc = _sample()
    doc['logs'] = [{'type': 'NOPE'}] * 30
    assert len(validator.validate(doc)) == 20
    const = neutral.SchemaValidator({'const': 1})
    assert const.validate(1) == [] and len(const.validate(1.0)) == 1
    assert neutral.SchemaValidator({'$ref': 'elsewhere'}).validate('x') == []
    assert neutral._has_type('number', 1.5) and neutral._has_type('null', None)


def test_value_helpers():
    from decimal import Decimal
    assert neutral.canonical({'a': None, 'b': Decimal('2'), 'c': Decimal('2.5'), 'd': (1,)}) == '{"b":2,"c":2.5,"d":[1]}'
    assert neutral.size({'é': 1}) == 8
    assert neutral.ts(None) is None and neutral.ts(' ') is None and neutral.ts('junk') == 'junk'
    assert neutral.ts(Decimal(1790244000000)) == '2026-09-24T10:00:00.000Z'
    assert neutral.ts('2026-10-01 10:00:00') == '2026-10-01T10:00:00.000Z'
    assert neutral.ts('2026-10-01T12:00:00+02:00') == '2026-10-01T10:00:00.000Z'
    assert neutral.epoch_ms('2026-09-24T10:00:00Z') == 1790244000000 and neutral.epoch_ms('junk') is None
    assert neutral.ms_to_iso(None) is None
    assert neutral.lng(True) == 1 and neutral.lng(Decimal('3')) == 3 and neutral.lng('x') is None
    assert neutral.lng(' 4 ') == 4 and neutral.lng(None) is None and neutral.positive(0) is None
    assert neutral.boolean('t') and neutral.boolean(Decimal(1)) and not neutral.boolean(None)
    assert neutral.items('x') == [] and neutral.mapping('x') == {}
    assert neutral.id_by_uuid({'x': [{'uuid': 'a', 'id_tipo': 1}, {'id': 2}]}, 'x') == {'a': 1}
    assert neutral.log_section({'type': 'WHAT', 'message': 3})['type'] == 'OTHER'
    assert neutral.reconcile_markers([{'eventId': 1, 'executed': 0, 'selected': 1}, {'x': 1}]) == (
        {'1': {'executed': 0, 'selected': 1}}, [])


def test_story_exporter_and_fingerprint():
    item = _story()
    item['raw_texts'][0]['tsInsert'] = 't'
    data = exporter.export_story_item(item)
    assert data['texts'] == [{'id': 1, 'idText': 1, 'lang': 'en', 'shortText': 'Round trip'}]
    assert data['characterTemplates'][0]['id'] == 1
    assert data['locationNeighbors'] == [] and len(exporter.ENTITY_TYPES) == 22
    assert exporter.export_story_item(None) is None and exporter._as_int('x') is None
    assert mx.fingerprint(data) == mx.fingerprint(copy.deepcopy(data))
    changed = copy.deepcopy(data)
    changed['texts'][0]['shortText'] = 'Other'
    assert mx.fingerprint(changed) != mx.fingerprint(data)
    rows = mx._project({'rows': [{'id': 'b'}, {'id': 2}, {}, {'id': True}]})['rows']
    assert rows == [{}, {'id': 2}, {'id': 'b'}, {'id': True}]
    assert mx._title({'idTextTitle': 1, 'texts': [{'idText': 1, 'lang': 'it', 'longText': 'L'},
                                                  {'idText': 1, 'lang': 'de', 'shortText': 'x'}]}) == 'L'


def test_story_importer_is_the_route_body():
    with patch('story.handler.import_story_data', return_value={'statusCode': 201}) as body:
        assert importer.import_story_data({'uuid': 's'}) == {'statusCode': 201}
    body.assert_called_once_with({'uuid': 's'})


def test_admin_list_keeps_the_template_id():
    from story import handler as sh
    table = FakeTable([ADMIN, _story()])
    with patch('story.handler._require_admin', return_value=(ADMIN, None)), patch_table(table, 'story.handler'):
        rows = json.loads(sh.list_entities({}, STORY_UUID, 'character-templates')['body'])
    assert rows[0]['id'] == 1


# ── export ────────────────────────────────────────────────────────────────────

def test_export_is_valid_restores_the_source_and_resumes_it():
    with _env(_seed()) as table:
        res = _export(table)
        assert res['statusCode'] == 200, res['body']
        assert res['headers']['Content-Disposition'] == 'attachment; filename=match-0a0a0a0a-clock-3.json'
        doc = json.loads(res['body'])
        meta = table.get_item(PK)
        logs = table.logs(MATCH_UUID)
    assert neutral.SchemaValidator.match_export_v1().validate(doc) == []
    assert doc['checksum'] == neutral.sha256({k: v for k, v in doc.items() if k != 'checksum'})
    assert doc['source']['backend'] == 'aws' and doc['source']['dialect'] == 'dynamodb'
    assert 'secret-token' not in res['body']
    assert [e['type'] for e in doc['logs']] == ['MATCH_LIFECYCLE', 'WEATHER', 'MOVEMENT', 'EVENT', 'EVENT', 'CHOICE',
                                                'ITEM_ADD', 'OTHER']
    assert doc['match']['difficultyId'] == 1 and doc['match']['loadout'] == {
        'characterTemplateId': 1, 'classId': 1, 'traitIds': [1]}
    assert doc['characters'][0]['traits'] == [{'traitId': 1}] and doc['characters'][0]['classId'] == 1
    assert doc['engine']['eventMarkers'] == [{'eventId': 13, 'executed': 1, 'selected': 0},
                                             {'eventId': 14, 'executed': 1, 'selected': 1}]
    assert doc['state']['choiceHistory'][0]['choiceId'] == 7 and doc['state']['storyProgress'][0]['eventId'] == 14
    assert doc['users'][0]['guest'] is True
    assert meta['status'] == 'RUNNING'
    assert not any(r['type'] == 'SLEEP' and r['SK'].endswith('000009') for r in logs)
    messages = [r.get('message') for r in logs if r['type'] == 'ADMIN_ACTION']
    assert 'SNAPSHOT_RESTORED clock=3' in messages and 'EXPORTED clock=3' in messages and 'RESUME' in messages


def test_export_refusals_and_statuses():
    with _env(_seed()):
        assert _call('POST', '/api/admin/matches/nope/export', params={'uuidMatch': 'nope'})['statusCode'] == 404
        res = _call('POST', f'/api/admin/matches/{MATCH_UUID}/export', params={'uuidMatch': MATCH_UUID})
        assert res['statusCode'] == 409 and json.loads(res['body'])['error'] == 'NO_SNAPSHOT'
    for status in ('PAUSED', 'ENDED'):
        with _env([_match(status=status, logSeq=8) if i == 1 else x for i, x in enumerate(_seed())]) as table:
            res = _export(table)
            assert res['statusCode'] == 200
            assert table.get_item(PK)['status'] == status
            exported = [r for r in table.logs(MATCH_UUID) if r.get('message') == 'EXPORTED clock=3']
            assert bool(exported) == (status == 'PAUSED')


def test_export_integrity_and_size_cap_put_the_status_back(monkeypatch):
    with _env(_seed()) as table:
        _snapshot(table)
        story = table.get_item(f'STORY#{STORY_UUID}')
        story['locations'] = story['locations'][:1]
        table.put_item(story)
        res = _call('POST', f'/api/admin/matches/{MATCH_UUID}/export', params={'uuidMatch': MATCH_UUID})
        assert res['statusCode'] == 409 and json.loads(res['body'])['errors'][0]['code'] == 'STORY_ENTITY_MISSING'
        assert table.get_item(PK)['status'] == 'RUNNING'
    monkeypatch.setenv('MATCH_EXPORT_MAX_BYTES', '10')
    with _env(_seed()) as table:
        res = _export(table)
        assert res['statusCode'] == 413 and table.get_item(PK)['status'] == 'RUNNING'
    monkeypatch.setenv('MATCH_EXPORT_MAX_BYTES', 'junk')
    assert mx.max_bytes() == 5000000


# ── import ────────────────────────────────────────────────────────────────────

def _exported():
    with _env(_seed()) as table:
        return json.loads(_export(table)['body'])


def test_dry_run_on_the_source_server_says_match_exists():
    doc = _exported()
    with _env(_seed()):
        res = _import({'export': doc, 'dryRun': True})
    check = json.loads(res['body'])
    assert res['statusCode'] == 200 and check['valid'] is False and check['matchExists'] is True
    assert [e['code'] for e in check['errors']] == ['MATCH_EXISTS']
    assert check['story']['status'] == 'SAME' and [u['status'] for u in check['users']] == ['EXISTING', 'EXISTING']


def test_a_copy_is_imported_with_its_keys_logs_and_snapshot(monkeypatch):
    monkeypatch.setenv('ROBOT_TEST_DATA_TTL_HOURS', '1')
    doc = _exported()
    new = '0a0a0a0a-0000-4000-8000-0000000000c1'
    copy_ = _copy(doc, new, 'c4c4c4c4-0000-4000-8000-0000000000c1', 'c4c4c4c4-0000-4000-8000-0000000000c2')
    gsi = {f'USER_MATCHES#{PLAYER_UUID}': [{'uuid': MATCH_UUID, 'storyUuid': STORY_UUID, 'status': 'RUNNING'}]}
    with _env(_seed(), gsi) as table:
        res = _import({'export': copy_})
        assert res['statusCode'] == 201, res['body']
        body = json.loads(res['body'])
        meta = table.get_item(f'MATCH#{new}')
        logs = table.logs(new)
        audits = table.audits(new)
        snaps = table.rows(f'MATCH#{new}', 'SNAPSHOT#')
        chars = table.rows(f'MATCH#{new}', 'CHARACTER#')
        source = table.get_item(PK)
    assert body['status'] == 'IMPORTED' and body['matchStatus'] == 'RUNNING' and body['snapshotClock'] == 3
    assert body['clock'] == 4 and body['storyAction'] == 'USE_EXISTING' and body['usersCreated'] == 0
    assert 'USER_HAS_ACTIVE_MATCH' in [w['code'] for w in body['warnings']]
    assert source['status'] == 'PAUSED'
    assert meta['GSI1_PK'] == f'USER_MATCHES#{PLAYER_UUID}' and meta['GSI2_PK'] == 'MATCH'
    assert meta['GSI1_SK'] == f"MATCH#{meta['tsInsert']:020d}#{new}" and meta['GSI2_SK'].endswith(new)
    assert meta['eventMarkers']['14'] == {'executed': 1, 'selected': 1} and meta['executedEventIds'] == [13, 14]
    assert meta['difficultyUuid'] == 'd-9' and meta['traitUuids'] == ['trt-9'] and meta['currentLocationUuid'] == 'loc-2'
    assert meta['logSeq'] >= len(logs) and meta['ttl']
    assert all(r['SK'].startswith('LOG#') and len(r['SK'].split('#')[1]) == 13 for r in logs)
    assert any(r.get('message') == 'IMPORTED aws-test clock=3' or r.get('message', '').startswith('IMPORTED ')
               for r in logs)
    assert {'CHOICE_SELECTED', 'CHOICE_HISTORY', 'STORY_PROGRESS', 'OTHER'} <= {a['kind'] for a in audits}
    assert snaps[0]['description'] == 'Imported at clock 3' and body['uuidSnapshot'] == snaps[0]['uuid']
    assert {c['characterTemplateUuid'] for c in chars} == {'tpl-9'} and chars[0]['ttl']


def test_replace_start_paused_and_cross_family_users(monkeypatch):
    doc = _exported()
    with _env(_seed()) as table:
        res = _import({'export': doc, 'replace': True, 'startPaused': True})
        assert res['statusCode'] == 201, res['body']
        assert table.get_item(PK)['status'] == 'PAUSED'
        assert not any(r['SK'].endswith('#000009') and r['type'] == 'SLEEP' for r in table.logs(MATCH_UUID))
    sample = _sample()
    sample['story']['uuid'] = STORY_UUID
    sample = _with_checksum(sample)
    with _env(_seed()) as table:
        check = json.loads(_import({'export': sample, 'dryRun': True, 'storyMode': 'KEEP'})['body'])
        assert check['story']['action'] == 'KEEP'
        codes = {w['code'] for w in check['warnings']}
        assert 'ROLE_DOWNGRADED' in codes and 'CROSS_FAMILY' not in codes
        assert check['valid'] is False and check['errors'][0]['code'] == 'STORY_ENTITY_MISSING'


def test_new_users_are_created_without_token_and_a_failure_rolls_back():
    doc = _exported()
    copy_ = _copy(doc, '0a0a0a0a-0000-4000-8000-0000000000d1', 'c4c4c4c4-0000-4000-8000-0000000000d1',
                  'c4c4c4c4-0000-4000-8000-0000000000d2',
                  ((PLAYER_UUID, 'abcdef12-0000-4000-8000-000000000042'),
                   (OTHER_UUID, 'fedcba98-0000-4000-8000-000000000043')))
    with _env(_seed()) as table:
        res = _import({'export': copy_})
        assert res['statusCode'] == 201
        guest = table.get_item('USER#abcdef12-0000-4000-8000-000000000042')
        admin = table.get_item('USER#fedcba98-0000-4000-8000-000000000043')
    assert guest['is_guest'] is True and guest['GSI2_PK'] == 'GUEST_LIST' and 'guest_token' not in guest
    assert 'GSI1_PK' not in guest and admin['role'] == 'PLAYER'
    copy2 = _copy(doc, '0a0a0a0a-0000-4000-8000-0000000000e1', 'c4c4c4c4-0000-4000-8000-0000000000e1',
                  'c4c4c4c4-0000-4000-8000-0000000000e2', ((OTHER_UUID, 'fedcba98-0000-4000-8000-0000000000e3'),))
    with _env(_seed()) as table, patch('match.match_export.snapshots.write_at_time_end',
                                       side_effect=RuntimeError('boom')):
        with pytest.raises(RuntimeError):
            _import({'export': copy2})
        assert table.get_item('USER#fedcba98-0000-4000-8000-0000000000e3') is None
        assert table.query_by_pk('MATCH#0a0a0a0a-0000-4000-8000-0000000000e1') == []


def test_a_user_with_a_known_email_is_mapped_onto_the_existing_one():
    with _env(_seed()) as table:
        other = table.get_item(f'USER#{OTHER_UUID}')
        table.put_item(dict(other, email='Boss@X.org'))
        doc = json.loads(_export(table)['body'])
    new, fresh, mapped = ('0a0a0a0a-0000-4000-8000-0000000000f1', 'abcdef12-0000-4000-8000-0000000000f2',
                          'fedcba98-0000-4000-8000-0000000000f3')
    copy_ = json.loads(neutral.canonical(_copy(doc, new, 'c4c4c4c4-0000-4000-8000-0000000000f1',
                                               'c4c4c4c4-0000-4000-8000-0000000000f2',
                                               ((PLAYER_UUID, fresh), (OTHER_UUID, mapped)))))
    copy_['match']['creatorUserUuid'] = mapped
    for u in copy_['users']:
        u['emailAddress'] = 'fresh@x.org' if u['uuid'] == fresh else 'boss@x.org'
    copy_ = _with_checksum(copy_)
    gsi = {f'USER_MATCHES#{OTHER_UUID}': [{'uuid': MATCH_UUID, 'storyUuid': STORY_UUID, 'status': 'RUNNING'}]}
    with _env(_seed(), gsi) as table:
        table.put_item(dict(table.get_item(f'USER#{OTHER_UUID}'), email='Boss@X.org'))
        check = json.loads(_import({'export': copy_, 'dryRun': True})['body'])
        res = _import({'export': copy_})
        assert res['statusCode'] == 201, res['body']
        meta = table.get_item(f'MATCH#{new}')
        chars = table.rows(f'MATCH#{new}', 'CHARACTER#')
        created = table.get_item(f'USER#{fresh}')
        assert table.get_item(f'USER#{mapped}') is None and table.get_item(PK)['status'] == 'PAUSED'
        assert table.get_item(f'USER#{OTHER_UUID}')['username'] == 'robottest_o'
    users = {u['uuid']: u for u in check['users']}
    assert users[mapped]['status'] == 'MAPPED_BY_EMAIL' and users[mapped]['targetUuid'] == OTHER_UUID
    assert users[mapped]['targetUsername'] == 'robottest_o'
    assert users[fresh]['status'] == 'NEW' and users[fresh]['targetUuid'] == fresh
    codes = [w['code'] for w in check['warnings']]
    assert 'USER_MAPPED_BY_EMAIL' in codes and 'USER_HAS_ACTIVE_MATCH' in codes
    assert json.loads(res['body'])['usersCreated'] == 1 and created['email'] == 'fresh@x.org'
    assert meta['userCreatorUuid'] == OTHER_UUID and meta['GSI1_PK'] == f'USER_MATCHES#{OTHER_UUID}'
    assert {c['userUuid'] for c in chars} == {fresh, OTHER_UUID}


def test_a_failing_time_start_answers_500_and_keeps_the_match_paused():
    doc = _exported()
    copy_ = _copy(doc, '0a0a0a0a-0000-4000-8000-0000000000f1', 'c4c4c4c4-0000-4000-8000-0000000000f1',
                  'c4c4c4c4-0000-4000-8000-0000000000f2')
    with _env(_seed()) as table, patch('match.handler._advance_time', side_effect=RuntimeError('boom')):
        res = _import({'export': copy_})
        assert res['statusCode'] == 500 and json.loads(res['body'])['error'] == 'IMPORT_TIME_START_FAILED'
        repo.flush()
        assert table.get_item('MATCH#0a0a0a0a-0000-4000-8000-0000000000f1')['status'] == 'PAUSED'


def test_import_refusals(monkeypatch):
    doc = _exported()
    with _env(_seed()):
        assert _call('POST', '/api/admin/matches/import', body='{bad')['statusCode'] == 400
        assert _call('POST', '/api/admin/matches/import', body='[1]')['statusCode'] == 400
        check = json.loads(_import({'export': 'x', 'dryRun': True})['body'])
        assert check['errors'][0]['code'] == 'SCHEMA_INVALID'
        bad = dict(doc, formatVersion=2)
        res = _import({'export': bad})
        assert res['statusCode'] == 422 and json.loads(res['body'])['errors'][0]['code'] == 'FORMAT_UNKNOWN'
        assert json.loads(_import({'export': dict(doc, extra=1)})['body'])['errors'][0]['code'] == 'SCHEMA_INVALID'
        tampered = dict(doc, checksum='0' * 64)
        assert json.loads(_import({'export': tampered})['body'])['errors'][0]['code'] == 'CHECKSUM_MISMATCH'
        mode = json.loads(_import({'export': doc, 'storyMode': 'MERGE', 'dryRun': True})['body'])
        assert mode['errors'][0]['code'] == 'SCHEMA_INVALID'
        broken = copy.deepcopy(doc)
        broken['characters'][1].update({'ordinal': 1, 'uuid': C1, 'userUuid': '00000000-0000-4000-8000-0000000000ff'})
        broken['match']['creatorUserUuid'] = '00000000-0000-4000-8000-0000000000fe'
        broken['match']['activeCharacterUuid'] = 'c4c4c4c4-0000-4000-8000-0000000000ff'
        broken['state']['turns'].append(broken['state']['turns'][0])
        errors = json.loads(_import({'export': _with_checksum(broken)})['body'])['errors']
        assert {e['code'] for e in errors} == {'REFERENCE_INVALID'}
        assert 'has two turns' in str(errors) and 'listed twice' in str(errors)
    monkeypatch.setenv('MATCH_EXPORT_MAX_BYTES', '10')
    with _env(_seed()):
        assert _import({'export': doc})['statusCode'] == 413


def test_story_modes(monkeypatch):
    doc = _exported()
    differs = copy.deepcopy(doc)
    differs['story']['data']['texts'][0]['shortText'] = 'Changed'
    differs['story']['fingerprint'] = mx.fingerprint(differs['story']['data'])
    differs = _copy(differs, '0a0a0a0a-0000-4000-8000-0000000000a9', 'c4c4c4c4-0000-4000-8000-0000000000a1',
                    'c4c4c4c4-0000-4000-8000-0000000000a2')
    with _env(_seed()):
        res = _import({'export': differs})
        assert res['statusCode'] == 409 and json.loads(res['body'])['error'] == 'STORY_DIFFERS'
        keep = json.loads(_import({'export': differs, 'storyMode': 'KEEP', 'dryRun': True})['body'])
        assert keep['valid'] and keep['story']['action'] == 'KEEP'
        with patch('story.story_validator.validate_story_dict', return_value=[]), \
                patch('match.match_export.story_importer.import_story_data',
                      return_value={'statusCode': 201}) as imported:
            replace = _import({'export': differs, 'storyMode': 'REPLACE'})
            assert replace['statusCode'] == 201, replace['body']
            imported.assert_called_once()
            assert 'id' not in imported.call_args[0][0]
        with patch('story.story_validator.validate_story_dict', return_value=[{'rule': 'R_01'}]):
            invalid = json.loads(_import({'export': differs, 'storyMode': 'REPLACE', 'dryRun': True})['body'])
            assert invalid['errors'][0]['code'] == 'STORY_INVALID' and 'R_01' in invalid['errors'][0]['message']
        with patch('story.story_validator.validate_story_dict', return_value=[]), \
                patch('match.match_export.story_importer.import_story_data',
                      return_value={'statusCode': 400, 'body': 'no'}):
            again = _copy(differs, MATCH_UUID, C1, C2, (('0a0a0a0a-0000-4000-8000-0000000000a9',
                                                           '0a0a0a0a-0000-4000-8000-0000000000aa'),))
            refused = _import({'export': again, 'storyMode': 'REPLACE'})
            assert refused['statusCode'] == 422


def test_an_absent_story_is_imported_through_the_importer():
    sample = _sample()
    holder = {}

    def store_story(data):
        holder['table'].put_item(dict(data, PK=f"STORY#{data['uuid']}", SK='METADATA',
                                      characterTemplates=[{'id_tipo': 1, 'uuid': '7e7e7e7e-0000-4000-8000-000000000001'}]))
        return {'statusCode': 201}

    with _env([]) as table, patch('story.story_validator.validate_story_dict', return_value=[]), \
            patch('match.match_export.story_importer.import_story_data', side_effect=store_story):
        holder['table'] = table
        check = json.loads(_import({'export': sample, 'dryRun': True})['body'])
        assert check['story'] == {'uuid': sample['story']['uuid'], 'status': 'ABSENT', 'action': 'IMPORT',
                                  'matchesDeleted': 0}
        res = _import({'export': sample})
        assert res['statusCode'] == 201, res['body']
        body = json.loads(res['body'])
        meta = table.get_item(f"MATCH#{sample['match']['uuid']}")
    assert body['usersCreated'] == 2 and body['storyAction'] == 'IMPORT'
    assert meta['activeCharacterUuid'] == sample['match']['activeCharacterUuid']


def test_refusal_and_batches_at_the_cap():
    assert json.loads(mx.refusal([{'code': 'STORY_DIFFERS', 'message': 'x'}])['body'])['error'] == 'STORY_DIFFERS'
    mixed = mx.refusal([{'code': 'MATCH_EXISTS', 'message': 'x'}, {'code': 'SCHEMA_INVALID', 'message': 'y'}])
    assert mixed['statusCode'] == 422
    # The biggest file the cap lets in: LOG# rows of ~400 bytes each, 25 per BatchWriteItem.
    rows_at_cap = 5_000_000 // 400
    assert -(-rows_at_cap // mx.BATCH) == 500
