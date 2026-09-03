"""Step 36 — the one place that reads, writes and compares the match registry (AWS)."""
import pytest

from match import registry as r


def _row(key, string_value=None, int_value=None, **extra):
    return {'id': 1, 'uuid': f'u-{key}', 'key': key, 'stringValue': string_value,
            'intValue': int_value, **extra}


def _match(*rows):
    return {'registry': list(rows)}


def _key(name, group=None, priority=None, visibility='PUBLIC', id_card=None, value=None):
    return {'keyName': name, 'keyGroup': group, 'priority': priority,
            'visibility': visibility, 'idCard': id_card, 'keyValue': value}


# ── render / parse are exact inverses ────────────────────────────────────────

def test_render_prefers_the_string_then_the_int():
    assert r.render('WINTER', None) == 'WINTER'
    assert r.render(None, 5) == '5'
    assert r.render(None, None) is None
    assert r.render_row(None) is None


def test_parse_splits_the_two_columns_and_trims_either_way():
    assert r.parse('  42  ') == {'stringValue': None, 'intValue': 42}
    assert r.parse('  hi  ') == {'stringValue': 'hi', 'intValue': None}
    assert r.parse('   ')['stringValue'] == ''
    assert r.parse(None) == {'stringValue': None, 'intValue': None}


@pytest.mark.parametrize('value', ['42', 'hi', '', '0', '-7'])
def test_a_parsed_value_renders_back_to_what_was_written(value):
    parsed = r.parse(value)
    assert r.render(parsed['stringValue'], parsed['intValue']) == value


# ── evaluate ─────────────────────────────────────────────────────────────────

def test_equality_is_textual_and_ordering_needs_numbers():
    assert r.evaluate('=', 'OPEN', 'OPEN')
    assert r.evaluate('!=', 'OPEN', 'SHUT')
    assert r.evaluate('>', '3', '4')
    assert not r.evaluate('>', '3', '3')
    assert r.evaluate('<', '3', '2')
    assert not r.evaluate('>', '3', 'many')


def test_an_absent_key_satisfies_only_not_equals():
    assert r.evaluate('!=', 'OPEN', None)
    assert not r.evaluate('=', 'OPEN', None)


def test_a_null_expected_value_is_never_met():
    assert not r.evaluate('=', None, 'OPEN')
    assert not r.evaluate('!=', None, 'OPEN')


def test_operator_defaults_to_equals_and_unknown_never_matches():
    assert r.evaluate(None, 'OPEN', 'OPEN')
    assert r.evaluate('  ', 'OPEN', 'OPEN')
    assert not r.evaluate('~=', 'OPEN', 'OPEN')


def test_no_condition():
    assert r.no_condition(None) and r.no_condition('   ')
    assert not r.no_condition('GATE')


# ── reads ────────────────────────────────────────────────────────────────────

def test_load_all_renders_every_row_and_skips_a_row_with_no_key():
    match = _match(_row('flag', 'yes'), _row('count', None, 7), _row('empty'), _row(None, 'x'))
    assert r.load_all(match) == {'flag': 'yes', 'count': '7', 'empty': None}


def test_find_returns_none_for_an_absent_key():
    match = _match(_row('count', None, 7))
    assert r.find(match, 'count') == '7'
    assert r.find(match, 'gone') is None
    assert r.find(None, 'gone') is None


def test_condition_met_reads_an_authored_row():
    match = _match(_row('gate', 'OPEN'))
    edge = {'conditionKey': 'gate', 'conditionValue': 'OPEN'}
    assert r.condition_met(edge, 'conditionKey', 'conditionValue',
                           'registryValueOperatorCondition', match)
    # A key with no expected value is never met — the guard the AWS edges used to lack.
    assert not r.condition_met({'conditionKey': 'gate'}, 'conditionKey', 'conditionValue',
                               'registryValueOperatorCondition', match)
    assert r.condition_met({}, 'conditionKey', 'conditionValue',
                           'registryValueOperatorCondition', match)


# ── the story join ───────────────────────────────────────────────────────────

def test_entries_carry_category_priority_and_visibility():
    match = _match(_row('progress', None, 3))
    story = {'keys': [_key('progress', 'tutorial', 2)]}
    entry = r.list_entries(match, story)[0]
    assert entry['category'] == 'tutorial' and entry['priority'] == 2
    assert entry['visible'] is True and entry['intValue'] == 3


def test_anything_but_public_is_hidden_and_dropped_by_default():
    match = _match(_row('shown', 'a'), _row('secret', 'b'))
    story = {'keys': [_key('shown', 'g', 1), _key('secret', 'g', 2, visibility='HIDDEN')]}
    assert [e['key'] for e in r.list_entries(match, story)] == ['shown']
    assert len(r.list_entries(match, story, include_hidden=True)) == 2


def test_a_key_the_story_no_longer_declares_is_kept_but_hidden():
    match = _match(_row('orphan', 'x'))
    assert r.list_entries(match, {'keys': []}) == []
    assert r.list_entries(match, {'keys': []}, include_hidden=True)[0]['visible'] is False


def test_ordered_by_category_then_priority_then_key():
    match = _match(_row('zeta'), _row('alpha'), _row('beta'))
    story = {'keys': [_key('zeta', 'tutorial', 2), _key('alpha', 'tutorial', 1),
                      _key('beta', 'evidence', 1)]}
    assert [e['key'] for e in r.list_entries(match, story)] == ['beta', 'alpha', 'zeta']


def test_groups_bucket_the_entries_and_no_group_lands_under_none():
    match = _match(_row('a'), _row('b'))
    story = {'keys': [_key('a', 'tutorial', 1), _key('b', None, 1)]}
    assert [g['category'] for g in r.list_groups(match, story)] == [None, 'tutorial']


# ── writes ───────────────────────────────────────────────────────────────────

def test_seed_writes_one_row_per_key_holding_its_default():
    rows = r.seed({'keys': [_key('n', value='42'), _key('name', value='hi'),
                            _key('blank', value='  '), _key('none')]})
    assert [x['intValue'] for x in rows] == [42, None, None, None]
    assert [x['stringValue'] for x in rows] == [None, 'hi', '', None]
    assert [x['id'] for x in rows] == [1, 2, 3, 4]
    assert all(x['uuid'] for x in rows)


def test_a_blank_key_is_skipped_not_an_error():
    match = _match()
    assert r.upsert(match, None, 'v') is None
    assert r.upsert(match, '   ', 'v') is None
    assert match['registry'] == []
    assert match.get('eventLog') is None


def test_upsert_overwrites_in_place_and_keeps_one_row():
    match = _match(_row('count', 'old'))
    r.upsert(match, 'count', ' 42 ', id_character=3, id_event=12, id_choice=9, clock=5)
    assert len(match['registry']) == 1
    row = match['registry'][0]
    assert row['intValue'] == 42 and row['stringValue'] is None
    assert row['idCharacter'] == 3 and row['idEvent'] == 12
    assert row['idChoice'] == 9 and row['clock'] == 5


def test_a_row_created_at_runtime_is_shaped_like_a_seeded_one():
    """Before Step 36 it carried neither an id nor a uuid, so /info held ragged rows."""
    match = _match(_row('other', 'x'))
    r.upsert(match, 'fresh', 'hello')
    fresh = r.find_row(match, 'fresh')
    assert fresh['id'] == 2 and fresh['uuid']


def test_every_write_leaves_exactly_one_audit_row():
    match = _match(_row('gate', 'SHUT'))
    r.upsert(match, 'gate', 'OPEN', clock=5, character_uuid='c-1')
    assert len(match['eventLog']) == 1
    logged = match['eventLog'][0]
    assert logged['message'].startswith(r.MSG_REGISTRY_CHANGE)
    assert 'gate' in logged['message'] and 'SHUT' in logged['message']
    assert logged['clock'] == 5 and logged['characterUuid'] == 'c-1'


def test_changes_records_the_before_and_after():
    match = _match(_row('gate', 'SHUT'))
    changes = []
    r.upsert(match, 'gate', 'OPEN', changes)
    assert changes == [{'key': 'gate', 'oldValue': 'SHUT', 'newValue': 'OPEN'}]


# ── the chain writes with no actor at all ────────────────────────────────────

def test_a_write_with_no_actor_stamps_a_null_character_instead_of_failing():
    """An automatic event fired at a time-start has no actor: the world changed, but around
    no one."""
    match = _match()

    r.upsert(match, 'gate', 'OPEN', id_character=None, character_uuid=None, clock=4)

    row = r.find_row(match, 'gate')
    assert row['idCharacter'] is None
    assert row['stringValue'] == 'OPEN' and row['clock'] == 4
    assert match['eventLog'][0]['characterUuid'] is None


def test_the_event_chain_survives_a_null_caller_and_writes_the_key():
    """The regression this guards: the chain is entered with caller=None for an automatic
    event, and reading `caller.get(...)` unguarded made /action/sleep answer 500 on AWS.
    Exercised through the real chain, not through upsert alone, because that is where it
    broke."""
    from match import events as _events
    from match import handler as h

    story = {
        'idEventEndGame': None,
        'events': [{'id': 1, 'uuid': 'e-1', 'type': 'AUTOMATIC'}],
        'eventEffects': [{'id': 1, 'idEvent': 1, 'keyToAdd': 'gate', 'keyValueToAdd': 'OPEN'}],
        'keys': [_key('gate', 'g', 1)],
    }
    match = {'uuid': 'm1', 'currentClock': 4, 'registry': []}
    ctx = _events.build_context(match, story, None)

    h._run_event_chain(match, story, story['events'][0], None, [], ctx,
                       {1: story['events'][0]}, h._new_accumulator_no_actor(), {}, {}, 'en')

    row = r.find_row(match, 'gate')
    assert row['stringValue'] == 'OPEN'
    assert row['idCharacter'] is None and row['clock'] == 4
    assert match['eventLog'][0]['characterUuid'] is None
