"""V1 step 1 - the registry lock: mode table, visibility filter, checkers, match-info and
pending choices. Mirrors RegistryLockTest (Java) and test_v1_step01_registry_lock (python)."""
import copy
import json
from unittest.mock import patch

import pytest

from match import choices as ch
from match import events as ev
from match import handler as h
from match import registry as rg
from test_match_handler import PLAYER_USER, _player_event
import test_match_handler_execute_event_choices as exc


def _lock(mode, key, op, value, hidden=False, title=None):
    return {'mode': mode, 'hidden': hidden, 'key': key, 'keyTitle': title,
            'operator': op, 'value': value}


# ── the mode table (same rows on Java and Python) ──────────────────────────

@pytest.mark.parametrize('op,expected,actual,mode,operator,value', [
    ('=', 'open', [], 'MISSING', '=', 'open'),
    (None, 'open', [], 'MISSING', '=', 'open'),
    (' ', 'open', ['closed'], 'MISSING', '=', 'open'),
    ('>', '5', ['3'], 'MISSING', '>', '5'),
    ('<', '5', ['7'], 'MISSING', '<', '5'),
    ('!=', 'open', ['OPEN'], 'FORBIDDEN', '!=', 'OPEN'),
    ('!=', 'open', ['a', 'Open'], 'FORBIDDEN', '!=', 'Open'),
])
def test_mode_table(op, expected, actual, mode, operator, value):
    assert rg.lock('gate', op, expected, actual) == _lock(mode, 'gate', operator, value)


@pytest.mark.parametrize('key,op,expected', [
    ('gate', '~', 'open'), ('gate', '=', None), ('gate', '>', 'abc'), ('gate', '<', None),
    (None, '=', 'open'), (' ', '=', 'open'),
])
def test_authoring_error_is_generic(key, op, expected):
    assert rg.lock(key, op, expected, []) == rg.generic_lock()
    assert rg.generic_lock() == _lock('MISSING', None, None, None)


def test_forbidden_falls_back_to_expected_and_trims_key():
    assert rg.lock('k', '!=', ' x ', None)['value'] == 'x'
    assert rg.lock(' k ', '=', 'v', None)['key'] == 'k'


# ── the visibility filter ───────────────────────────────────────────────────

STORY = {
    'keys': [{'keyName': 'gate', 'visibility': ' public ', 'idCard': 4},
             {'name': 'plain', 'visibility': 'PUBLIC'},
             {'keyName': 'secret', 'visibility': 'PRIVATE', 'idCard': 4},
             {'keyName': 'blank'}],
    'raw_cards': [{'id': 4, 'uuid': 'c4', 'idTextTitle': 40}],
    'raw_texts': [{'idText': 40, 'lang': 'en', 'shortText': 'Gate key'},
                  {'idText': 40, 'lang': 'it', 'shortText': 'Chiave'}],
}


def test_public_key_gets_card_title_in_request_language_once():
    calls = []
    view = rg.LockView(STORY, lambda id_card: calls.append(id_card) or 'T')
    raw = rg.lock('gate', '!=', 'open', ['open'])
    assert view.apply(raw) == _lock('FORBIDDEN', 'gate', '!=', 'open', title='T')
    view.apply(raw)
    assert calls == [4]
    assert h._lock_view(STORY, 'it').apply(raw)['keyTitle'] == 'Chiave'
    assert h._lock_view(STORY, 'en').apply(raw)['keyTitle'] == 'Gate key'


def test_public_key_without_card_and_missing_card():
    assert h._lock_view(STORY, 'en').apply(rg.lock('plain', '=', 'x', []))['keyTitle'] is None
    no_cards = dict(STORY, raw_cards=[])
    assert h._lock_view(no_cards, 'en').apply(rg.lock('gate', '=', 'x', []))['keyTitle'] is None


def test_hidden_keys_and_pass_through():
    view = h._lock_view(STORY, 'en')
    for key in ('secret', 'blank', 'undeclared'):
        assert view.apply(rg.lock(key, '!=', 'v', ['v'])) == _lock(
            'FORBIDDEN', None, None, None, hidden=True)
    assert view.apply(None) is None
    assert view.apply(rg.generic_lock()) == rg.generic_lock()
    assert h._lock_view(None, 'en').apply(rg.lock('gate', '=', 'x', []))['hidden'] is True


# ── checkers ────────────────────────────────────────────────────────────────

def test_event_registry_lock_reads_the_context():
    event = {'registryKeyCondition': 'gate', 'registryValueOperatorCondition': '!=',
             'registryValueCondition': 'open'}
    assert ev.registry_lock(event, {'registry': {'gate': ['Open']}}) == _lock(
        'FORBIDDEN', 'gate', '!=', 'Open')
    assert ev.registry_lock(event, None)['value'] == 'open'


def _choice(logic='AND', **over):
    base = {'id': 1, 'otherwiseFlag': 0, 'logicOperator': logic}
    base.update(over)
    return base


def _cond(ctype, key=None, value=None, operator=None):
    return {'type': ctype, 'key': key, 'value': value, 'operator': operator}


def _cctx(registry=None):
    return {'actorStats': {'dex': 3}, 'idClass': 50, 'idLocation': 100, 'ownedItemIds': set(),
            'traitIds': set(), 'registry': registry or {}, 'partyLocations': [100],
            'partyStatSums': {}}


def test_choice_and_first_failure():
    ok, why, lock = ch.check_choice_with_lock(_choice(), [
        _cond('KEYS', 'day', '1', '>'), _cond('KEYS', 'gate', 'open', '!='),
        _cond('KEYS', 'bell', 'rung', '=')], _cctx({'day': ['2'], 'gate': ['open']}))
    assert (ok, why) == (False, ch.CONDITION_KEYS_NOT_MET)
    assert lock == _lock('FORBIDDEN', 'gate', '!=', 'open')


def test_choice_and_other_type_blank_key_or_and_no_lock_cases():
    assert ch.check_choice_with_lock(_choice(), [_cond('ITEM', None, '9', '='),
                                                 _cond('KEYS', 'gate', 'x', '=')], _cctx())[2] \
        is None
    assert ch.check_choice_with_lock(_choice(), [_cond('KEYS', ' ', 'x', '=')], _cctx())[2] \
        == rg.generic_lock()
    ok, why, lock = ch.check_choice_with_lock(
        _choice('or'), [_cond('ITEM', None, '9', '='), _cond('KEYS', 'gate', 'x', '=')], _cctx())
    assert why == ch.CONDITIONS_NOT_MET and lock == rg.generic_lock()
    assert ch.check_choice_with_lock(_choice('OR'), [_cond('ITEM', None, '9', '=')],
                                     _cctx())[2] is None
    assert ch.check_choice_with_lock(_choice(limitDex=9), [], _cctx())[2] is None
    assert ch.check_choice_with_lock(None, [], _cctx()) == (False, ch.CONDITIONS_NOT_MET, None)
    assert ch.check_choice_with_lock(_choice(otherwiseFlag=1), [], _cctx()) == (True, None, None)
    assert ch.check_choice_with_lock(_choice(), [], _cctx()) == (True, None, None)
    assert ch.check_choice(_choice(), [_cond('KEYS', 'gate', 'x', '=')], _cctx()) \
        == (False, ch.CONDITION_KEYS_NOT_MET)


def test_edge_lock_reads_both_field_spellings():
    registry = [{'key': 'gate', 'stringValue': 'Open'}]
    assert h._edge_lock({'conditionKey': 'gate', 'conditionValue': 'open',
                         'registryValueOperatorCondition': '!='}, registry) \
        == _lock('FORBIDDEN', 'gate', '!=', 'Open')
    assert h._edge_lock({'conditionRegistryKey': 'gate', 'conditionRegistryValue': 'x'},
                        None) == _lock('MISSING', 'gate', '=', 'x')


# ── match-info through the handler ──────────────────────────────────────────

def _info(match_item, story_item, character):
    def get_side(pk, sk='METADATA', consistent=True):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return match_item
        if pk == 'STORY#story-uuid-1':
            return story_item
        return None

    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}), \
         patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_sk_prefix', return_value=[character]):
        result = h.lambda_handler(event, {})
    assert result['statusCode'] == 200
    return json.loads(result['body'])['locationsActive'][0]


def _story(keys, edge):
    base_edge = {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N', 'flagBack': 1,
                 'energyCost': 1}
    base_edge.update(edge)
    return {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [{'id': 1, 'uuid': 'loc-1'}, {'id': 2, 'uuid': 'loc-2'}],
        'neighbors': [base_edge],
        'events': [
            {'id': 5, 'uuid': 'e-gated', 'idSpecificLocation': 1, 'type': 'NORMAL',
             'costEnery': 0, 'registryKeyCondition': 'gate',
             'registryValueCondition': 'open'},
            {'id': 6, 'uuid': 'e-free', 'idSpecificLocation': 1, 'type': 'NORMAL',
             'costEnery': 0},
        ],
        'keys': keys, 'raw_cards': STORY['raw_cards'], 'raw_texts': STORY['raw_texts'],
    }


def _match(registry=None):
    return {'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'n',
            'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
            'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100, 'locations': [],
            'registry': registry or []}


def _character(**over):
    c = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'player-uuid-001',
         'idLocation': 1, 'energy': 100, 'weightMax': 50, 'isComa': 0, 'isSleeping': 0}
    c.update(over)
    return c


def test_match_info_event_and_edge_carry_the_lock():
    story = _story([{'keyName': 'gate', 'visibility': 'PUBLIC', 'idCard': 4}],
                   {'conditionKey': 'gate', 'conditionValue': 'open',
                    'registryValueOperatorCondition': '!='})
    loc = _info(_match([{'key': 'gate', 'stringValue': 'Open'}]), story, _character())
    events = {e['uuid']: e for e in loc['events']}
    # the gated event is met by "Open", the free one never had a lock
    assert events['e-gated']['registryLock'] is None and events['e-free']['registryLock'] is None
    edge = loc['neighbors'][0]
    assert edge['reason'] == 'MOVEMENT_CONDITION_NOT_MET'
    assert edge['registryLock'] == _lock('FORBIDDEN', 'gate', '!=', 'Open', title='Gate key')

    loc = _info(_match(), story, _character())
    assert {e['uuid']: e for e in loc['events']}['e-gated']['registryLock'] == _lock(
        'MISSING', 'gate', '=', 'open', title='Gate key')


def test_match_info_hidden_key_and_other_reason():
    story = _story([], {'conditionKey': 'gate', 'conditionValue': 'open'})
    loc = _info(_match(), story, _character())
    assert loc['neighbors'][0]['registryLock'] == _lock('MISSING', None, None, None, hidden=True)
    assert loc['events'][0]['registryLock']['hidden'] is True
    loc = _info(_match(), story, _character(isComa=1))
    assert loc['neighbors'][0]['reason'] == 'COMA'
    assert loc['neighbors'][0]['registryLock'] is None
    assert loc['events'][0]['registryLock'] is None


# ── execute-event pending choices ───────────────────────────────────────────

def test_pending_choices_carry_the_lock():
    story = copy.deepcopy(exc.STORY)
    story['choiceConditions'] = [{'id': 1, 'idChoices': 11, 'type': 'KEYS', 'key': 'gate',
                                  'value': 'open', 'operator': '='}]
    story['keys'] = [{'keyName': 'gate', 'visibility': 'PUBLIC'}]

    def get_side(pk, sk='METADATA', consistent=True):
        return story if pk.startswith('STORY#') else exc._get_side(pk, sk)

    with exc._jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_sk_prefix', return_value=[dict(exc.CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = exc._call(exc._event('evt-choices'))
    gated, plain = json.loads(result['body'])['pendingChoices']
    assert gated['reason'] == 'CONDITION_KEYS_NOT_MET'
    assert gated['registryLock'] == _lock('MISSING', 'gate', '=', 'open')
    assert plain['registryLock'] is None
