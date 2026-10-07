"""v0.37.5 — match/repo.py: one read and one write per row per request."""
from unittest.mock import patch

from helpers import FakeTable, patch_table
from match import repo


def _rows():
    return [
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING'},
        {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'energy': 5},
        {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c2', 'uuid': 'c2', 'energy': 7},
        {'PK': 'MATCH#m1', 'SK': 'TURN#c1', 'characterUuid': 'c1', 'status': 'ACTIVE'},
    ]


def _table_calls(table):
    calls = {'get': 0, 'query': 0}
    real_get, real_query = table.get_item, table.query_sk_prefix

    def get_item(*a, **k):
        calls['get'] += 1
        return real_get(*a, **k)

    def query_sk_prefix(*a, **k):
        calls['query'] += 1
        return real_query(*a, **k)

    table.get_item, table.query_sk_prefix = get_item, query_sk_prefix
    return calls


def test_outside_a_request_every_call_reaches_the_table():
    table = FakeTable(_rows())
    calls = _table_calls(table)
    with patch_table(table, module='match.repo'):
        assert repo.match('m1')['uuid'] == 'm1'
        assert repo.match('m1')['uuid'] == 'm1'
        assert [c['uuid'] for c in repo.characters('m1')] == ['c1', 'c2']
        repo.characters('m1')
        assert repo.save({'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'energy': 1}) is True
    assert calls == {'get': 2, 'query': 2}
    assert table.get_item('MATCH#m1', 'CHARACTER#c1')['energy'] == 1  # written at once
    assert repo.active() is False and repo.pending() == 0


def test_inside_a_request_rows_are_read_once_and_flushed_once():
    table = FakeTable(_rows())
    calls = _table_calls(table)
    flushed = []
    with patch_table(table, module='match.repo'), \
         patch('match.repo.db_utils.batch_put_items',
               side_effect=lambda items: flushed.extend(items) or True):
        repo.begin()
        assert repo.active()
        match = repo.match('m1')
        assert repo.match('m1', consistent=False) is match
        chars = repo.characters('m1')
        assert repo.characters('m1') == chars
        assert repo.characters('m1')[0] is chars[0]  # the same dicts every call
        assert repo.character('m1', 'c1') is chars[0]
        assert repo.turns('m1')[0]['characterUuid'] == 'c1'
        assert repo.match('missing') is None
        assert repo.match('missing') is None  # a miss is not cached

        chars[0]['energy'] = 2
        repo.save(chars[0])
        chars[0]['energy'] = 3
        repo.save(chars[0])
        match['status'] = 'ENDED'
        repo.save(match)
        match['status'] = 'PAUSED'  # after the last save: not what gets written
        repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1', 'type': 'SLEEP'})
        assert repo.pending() == 3
        assert repo.flush() is True
    assert calls == {'get': 3, 'query': 2}  # match, missing x2; characters, turns
    by_sk = {r['SK']: r for r in flushed}
    assert set(by_sk) == {'METADATA', 'CHARACTER#c1', 'LOG#1'}
    assert by_sk['CHARACTER#c1']['energy'] == 3
    assert by_sk['METADATA']['status'] == 'ENDED'
    assert repo.active() is False and repo.pending() == 0
    assert repo.flush() is True  # nothing left: no second batch


def test_a_saved_row_joins_the_cached_roster_and_turn_queue():
    table = FakeTable(_rows())
    with patch_table(table, module='match.repo'), \
         patch('match.repo.db_utils.batch_put_items', return_value=True):
        repo.begin()
        repo.characters('m1')
        repo.turns('m1')
        new_char = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c3', 'uuid': 'c3'}
        repo.save(new_char)
        replaced = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'energy': 9}
        repo.save(replaced)
        repo.save({'PK': 'MATCH#m1', 'SK': 'TURN#c3', 'characterUuid': 'c3'})
        roster = repo.characters('m1')
        assert [c['uuid'] for c in roster] == ['c1', 'c2', 'c3']
        assert roster[0] is replaced and roster[2] is new_char
        assert repo.character('m1', 'c3') is new_char
        assert [t['characterUuid'] for t in repo.turns('m1')] == ['c1', 'c3']
        repo.flush()


def test_a_row_read_alone_is_the_same_object_the_roster_holds():
    table = FakeTable(_rows())
    with patch_table(table, module='match.repo'), \
         patch('match.repo.db_utils.batch_put_items', return_value=True):
        repo.begin()
        alone = repo.character('m1', 'c2')
        assert repo.characters('m1')[1] is alone
        repo.flush()


def test_delete_partition_drops_the_queued_rows_and_deletes_at_once():
    table = FakeTable(_rows())
    flushed = []
    with patch_table(table, module='match.repo'), \
         patch('match.repo.db_utils.batch_put_items',
               side_effect=lambda items: flushed.extend(items) or True):
        repo.begin()
        repo.characters('m1')
        repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
        repo.save({'PK': 'MATCH#m2', 'SK': 'METADATA', 'uuid': 'm2'})
        assert repo.delete_partition('MATCH#m1') == 4
        assert repo.match('m1') is None
        assert repo.characters('m1') == []
        repo.flush()
    assert [r['PK'] for r in flushed] == ['MATCH#m2']


def test_begin_forgets_the_previous_request():
    table = FakeTable(_rows())
    with patch_table(table, module='match.repo'), \
         patch('match.repo.db_utils.batch_put_items', return_value=True) as batch:
        repo.begin()
        repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
        repo.begin()
        assert repo.pending() == 0
        repo.flush()
    batch.assert_not_called()


# ── v0.39.1 — every row of a robot match inherits the METADATA ttl ─────────────

def _ttl_env(hours='1'):
    import os
    return patch.dict(os.environ, {'ENV': 'test', 'ROBOT_TEST_DATA_TTL_HOURS': hours})


def _robot_rows():
    rows = _rows()
    rows[0]['ttl'] = 999
    return rows


def test_child_rows_inherit_the_match_ttl_inside_a_request():
    table = FakeTable(_robot_rows())
    flushed = []
    with patch_table(table, module='match.repo'), _ttl_env(), \
         patch('match.repo.db_utils.batch_put_items',
               side_effect=lambda items: flushed.extend(items) or True):
        repo.begin()
        repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
        repo.save({'PK': 'MATCH#m1', 'SK': 'CHARACTER#c3', 'uuid': 'c3'})
        repo.flush()
    assert [r.get('ttl') for r in flushed] == [999, 999]


def test_child_rows_inherit_the_match_ttl_outside_a_request():
    table = FakeTable(_robot_rows())
    with patch_table(table, module='match.repo'), _ttl_env():
        repo.save({'PK': 'MATCH#m1', 'SK': 'TURN#c2', 'characterUuid': 'c2'})
    assert table.get_item('MATCH#m1', 'TURN#c2')['ttl'] == 999


def test_rows_of_a_match_without_ttl_stay_without():
    table = FakeTable(_rows())
    with patch_table(table, module='match.repo'), _ttl_env():
        repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
    assert 'ttl' not in table.get_item('MATCH#m1', 'LOG#1')


def test_no_inheritance_when_disabled_metadata_other_pk_or_own_ttl():
    table = FakeTable(_robot_rows())
    calls = _table_calls(table)
    with patch_table(table, module='match.repo'):
        with _ttl_env('0'):
            repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
        with _ttl_env():
            repo.save({'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1'})
            repo.save({'PK': 'USER#u1', 'SK': 'LOG#2'})
            repo.save({'PK': 'MATCH#m1', 'SK': 'LOG#3', 'ttl': 5})
    assert calls['get'] == 0, 'no METADATA lookup when nothing is to be inherited'
    assert 'ttl' not in table.get_item('MATCH#m1', 'LOG#1')
    assert 'ttl' not in table.get_item('MATCH#m1', 'METADATA')
    assert 'ttl' not in table.get_item('USER#u1', 'LOG#2')
    assert table.get_item('MATCH#m1', 'LOG#3')['ttl'] == 5
